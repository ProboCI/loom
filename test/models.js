'use strict';

/* eslint guard-for-in: 0 */

var through = require('through2');
var bl = require('bl');
var temp = require('temp').track();

var ArrayStreamStorage = require('../lib/models').ArrayStreamStorage;
var RethinkStorage = require('../lib/models').RethinkStorage;
var FileSystemStorage = require('../lib/models').FileSystemStorage;

function testStorage(Storage, storageConfig) {
  function read(streamid, storage) {
    return (storage || new Storage(storageConfig)).createReadStream(streamid);
  }

  function write(streamid, storage) {
    return (storage || new Storage(storageConfig)).createWriteStream(streamid);
  }

  describe('Storage: ' + Storage.name, function() {
    before(function* reset() {
      if (Storage === RethinkStorage || Storage === FileSystemStorage) {
        // configure and reset DB
        var config = {
          db: process.env.DB_NAME || 'test',
        };
        var rethink = require('../lib/rethink');
        rethink.connect(config);
        yield [rethink.models.Logs.delete(), rethink.models.Meta.delete()];
      }
    });

    describe('storage basics', function() {
      var streams = {
        'stream 1': {some: 'data'},
        'stream 2': {more: 'data'},
      };

      it('creates streams', function* () {
        var storage = new Storage(storageConfig);
        for (var streamid in streams) {
          yield storage.saveStream(streamid, streams[streamid]);
        }
      });

      it('loads streams', function* () {
        var storage = new Storage(storageConfig);
        var meta = yield storage.loadStream(Object.keys(streams)[0]);
        meta.should.eql({some: 'data'});
      });

      it('stream 1 writes then reads', function(done) {
        var storage = new Storage(storageConfig);
        var list = bl();
        list.append('some data');
        list.append('more data');

        var streamid = 'stream 1';
        var writer = write(streamid, storage);
        list.duplicate().pipe(writer);

        writer.on('finish', function() {
          var reader = read(streamid, storage);
          reader.pipe(bl(function(err, data) {
            if (err) return done(err);
            data.should.eql(list.slice(), 'reader on same storage as writer works');
          }));

          reader.on('end', function() {
            read(streamid).pipe(bl(function(err, data) {
              if (err) return done(err);
              data.should.eql(list.slice(), 'reader on different storage than writer works');

              done();
            }));
          });
        });
      });

      it('stream 2 writes and reads async', function(done) {
        var expected;
        var num = 10;
        var interval = 100;
        var producer = makeProducer(num, interval, function finishedProducing(data) {
          expected = data;
        });

        producer.pipe(write('stream 2'));

        var immediateFinished = false;
        var delayedFinished = false;

        // reader that starts reading immediately (full stream mode)
        read('stream 2').pipe(bl(function(err, data) {
          // console.log("expected:", expected.toString())
          // console.log("found   :", data.toString())

          data.toString().should.eql(expected.toString());
          immediateFinished = true;

          if (delayedFinished && immediateFinished) {
            done();
          }
        }));

        // reader that starts listenting half way (partial stream mode)
        // gets existing data, then listens for changes
        setTimeout(function() {
          read('stream 2').pipe(bl(function(err, data) {
            // console.log("expected:", expected.toString())
            // console.log("found   :", data.toString())

            data.toString().should.eql(expected.toString());

            delayedFinished = true;

            if (delayedFinished && immediateFinished) {
              done();
            }
          }));
        }, num * interval / 2);
      });
    });
  });
}

testStorage(ArrayStreamStorage);
testStorage(RethinkStorage);
testStorage(FileSystemStorage, {
  dataDir: temp.mkdirSync(),
  // keep tail timeout low so that we don't time out the test
  tailTimeout: 1000,
});

function makeProducer(numpushes, interval, finished) {
  numpushes = numpushes || 2;
  interval = interval || 100;

  var producer = through();

  var data = [];

  var pushed = 0;
  var _i = setInterval(function() {
    if (pushed >= numpushes) {
      clearInterval(_i);
      producer.end();
    }
    else {
      var d = new Buffer('data ' + ++pushed);
      data.push(d);
      producer.write(d);
    }
  }, interval);

  if (finished) {
    producer.on('finish', function() {
      if (finished) { finished(Buffer.concat(data)); }
    });
  }
  return producer;
}
