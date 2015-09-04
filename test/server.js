var util = require('util')
var http = require('http')
var url = require('url')

// var should = require('should')

var config = require('../lib/config')
var server = require('../lib/api/server')
var rethink = require('../lib/rethink')

var numChunks = 4
var consumerWait = 2000

function start(cb){
  server.listen(0, function() {
    server.url = `http://:::${server.address().port}`
    server.log.info('%s listening at %s', server.name, server.url)

    console.log(config)
    rethink.connect(config.db).ready().then(function(){
      cb && cb()
    })
  });
}

describe("server", function(){
  before("clear database", function* (){
    yield rethink.r.dbDrop(config.db.db)
  })

  before("server starts", function (done){
    start(done)
  })

  describe("producer", function(){
    var streamId

    function start_consumer(id, cb){
      console.log("starting consumer")

      var data = []

      var consumer_handler = function(res){
        console.log('CONSUMER STATUS: ' + res.statusCode);
        console.log('CONSUMER HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          console.log('CONSUMER BODY: ' + chunk);
          data.push(chunk)
        });
        res.on("end", function(){
          console.log("CONSUMER has read the full stream")

          data.should.eql([
            'chunks written 4',
            'chunks written 3',
            'chunks written 2',
            'chunks written 1'
          ])

          setTimeout(cb, 1000)
        })
        res.on("error", function(err){
          console.log("CONSUMER error", err)
          cb(err)
        })
      }

      var consumer = http.request({
        hostname: url.parse(server.url).hostname,
        port: url.parse(server.url).port,
        path: '/stream/' + id
      }, consumer_handler)
      consumer.end()
    }

    it("feeds data", function (done){
      var producer_handler = function(res){
        console.log('PRODUCER STATUS: ' + res.statusCode);
        console.log('PRODUCER HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          console.log('PRODUCER BODY: ' + chunk);
        });
        // res.on("end", done)

        // start the consumer for our stream id
        streamId = res.headers['x-stream-id']
        setTimeout(function(){
          start_consumer(streamId, done)
        }, consumerWait)

        console.log(`
curl -vi --no-buffer http://:::${server.address().port}/stream/${streamId}
`)
      }

      var producer = http.request({
        hostname: url.parse(server.url).hostname,
        port: url.parse(server.url).port,
        method: 'post',
        path: '/stream',
        headers: {
          connection: 'keep-alive',
          'x-stream-metadata': JSON.stringify({test_stream: true})
        }
      }, producer_handler)

      // stream some data
      var chunks = numChunks
      var i = setInterval(function(){
        if(chunks > 0){
          producer.write("chunks written " + chunks)
          console.log("producer sending data", chunks)
          chunks--
        } else {
          clearInterval(i)
          producer.end()
        }
      }, 1000)
    })

    it("has complete data", function (done){
      start_consumer(streamId, done)
    })
  })
})
