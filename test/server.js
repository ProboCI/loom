'use strict';

var http = require('http');
var url = require('url');

// var should = require('should')

var Server = require('../lib/api/server');
var rethink = require('../lib/rethink');

var numChunks = 4;
var consumerWait = 2000;
var server = null;

var temp = require('temp').track();

var testConf = {
  tokens: ['tik', 'tok'],
  server: {
    host: 'localhost',
    port: 3060,
  },
  db: {
    host: 'localhost',
    port: 28015,
    db: 'test',
  },
  storage: {
    logsTable: 'logs',
    metaTable: 'meta',
    dataDir: temp.mkdirSync(),
    tailTimeout: '1.5s',
    compress: false,

    // compression buffers small chunks of data, which doesn't update mtime
    // so to test with compression on, up time tailTimeout:
    // compress: true,
    // tailTimeout: '4s',
  },
};

function start(cb) {
  var loom = new Server(testConf);
  // Get a reference to the restify server.
  server = loom.server;
  loom.listen(0, '127.0.0.1', function() {
    server.log.info('%s listening at %s', server.name, server.url);
    return cb && cb();
  });
}

describe('Server:', function() {
  before('clear database', function* () {
    rethink.connect(testConf.db);
    yield [rethink.models.Logs.delete(), rethink.models.Meta.delete()];
  });

  before('server starts', function(done) {
    start(done);
  });

  describe('producer', function() {
    var streamId;

    function startConsumer(id, cb) {
      console.log('starting consumer');

      var data = [];

      var consumerHandler = function(res) {
        console.log('CONSUMER STATUS: ' + res.statusCode);
        console.log('CONSUMER HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          console.log('CONSUMER BODY: ' + chunk);
          data.push(chunk);
        });
        res.on('end', function() {
          console.log('CONSUMER has read the full stream');

          data.join('').should.eql([
            'chunks written 4',
            'chunks written 3',
            'chunks written 2',
            'chunks written 1',
          ].join(''));

          setTimeout(cb, 1000);
        });
        res.on('error', function(err) {
          console.log('CONSUMER error', err);
          cb(err);
        });
      };

      var consumer = http.request({
        hostname: 'localhost',
        port: url.parse(server.url).port,
        path: '/stream/' + id,
        headers: {
          authorization: 'bearer tik',
        },
      }, consumerHandler);
      consumer.end();
    }

    it('feeds data', function(done) {
      var producerHandler = function(res) {
        console.log('PRODUCER STATUS: ' + res.statusCode);
        console.log('PRODUCER HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          console.log('PRODUCER BODY: ' + chunk);
        });
        // res.on("end", done)

        // start the consumer for our stream id
        streamId = res.headers['x-stream-id'];
        setTimeout(function() {
          startConsumer(streamId, done);
        }, consumerWait);

        console.log(`
curl -vi --no-buffer http://:::${server.address().port}/stream/${streamId}
`);
      };

      var producer = http.request({
        hostname: 'localhost',
        port: url.parse(server.url).port,
        method: 'post',
        path: '/stream',
        headers: {
          'authorization': 'bearer tik',
          'connection': 'keep-alive',
          'x-stream-metadata': JSON.stringify({test_stream: true}),
        },
      }, producerHandler);

      // stream some data
      var chunks = numChunks;
      var i = setInterval(function() {
        if (chunks > 0) {
          producer.write('chunks written ' + chunks);
          console.log('producer sending data', chunks);
          chunks--;
        }
        else {
          clearInterval(i);
          producer.end();
        }
      }, 1000);
    });

    it('has complete data', function(done) {
      startConsumer(streamId, done);
    });
  });
});
