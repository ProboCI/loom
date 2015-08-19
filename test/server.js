var util = require('util')
var http = require('http')
var url = require('url')

// var should = require('should')

var server = require('../lib/api/server')

var numChunks = 5
var consumerWait = 2000

function start(cb){
  server.listen(0, function() {
    server.url = `http://:::${server.address().port}`
    server.log.info('%s listening at %s', server.name, server.url)

    cb && cb()
  });
}

describe("server", function(){
  before("server starts", function (done){
    start(done)
  })

  describe("producer", function(){
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
        var streamId = res.headers['x-stream-id']
        setTimeout(function(){
          start_consumer(streamId)
        }, consumerWait)
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
        if(--chunks > 0){
          producer.write("chunks written " + chunks)
          console.log("producer sending data", chunks)
        } else {
          clearInterval(i)
          producer.end()
        }
      }, 1000)


      function start_consumer(id){
        console.log("starting consumer")

        var consumer_handler = function(res){
          console.log('CONSUMER STATUS: ' + res.statusCode);
          console.log('CONSUMER HEADERS: ' + JSON.stringify(res.headers));
          res.setEncoding('utf8');
          res.on('data', function (chunk) {
            console.log('CONSUMER BODY: ' + chunk);
          });
          res.on("end", function(){
            console.log("CONSUMER has read the full stream")
            setTimeout(done, 1000)
          })
        }

        var consumer = http.request({
          hostname: url.parse(server.url).hostname,
          port: url.parse(server.url).port,
          path: '/stream/' + id
        }, consumer_handler)
        consumer.end()
      }
    })
  })
})
