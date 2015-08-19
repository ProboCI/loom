var through = require('through2')
var Stream = require('../lib/models').Stream

describe.only("models", function(){
  describe("Stream", function(){
    var stream = new Stream()

    function makeProducer(pushes, interval, finished){
      pushes = pushes || 2
      interval = interval || 100

      var producer = through()

      var pushed = 0
      var _i = setInterval(function(){
        if(pushed >= pushes){
          clearInterval(_i)
          producer.end()
        } else {
          producer.write("data " + ++pushed)
        }
      }, interval)

      if(finished){
        producer.on('finish', finished)
      }
      return producer
    }

    it("accepts data", function (done){
      var producer = makeProducer(2, 100, function finished(){
        [new Buffer("data 1"), new Buffer("data 2")]
          //.should.eql(stream._storage._readableState.buffer)
          .should.eql(stream._storage.buffer)

        done()
      })
      stream.setProducerStream(producer)
    })

    it("gives stored data", function (done){
      var consumer = stream.createConsumerStream()

      var data = []

      consumer.on("data", function(chunk){
        data.push(chunk)
      })
      consumer.on("end", function(){
        Buffer.concat([new Buffer("data 1"), new Buffer("data 2")])
          .should.eql(Buffer.concat(data))
        done()
      })
    })

    it.only("gives stored and live data", function (done){
      var liveStream = new Stream()

      // push a few things onto storage
      liveStream._storage.write("stored 1")
      liveStream._storage.write("stored 2")

      // add in a live producer
      var producer = makeProducer(5, 1000)
      // only start producer after a delay
      // setTimeout(function(){
        liveStream.setProducerStream(producer)
      // }, 1000)

      var consumer = liveStream.createConsumerStream()

      var data = []

      consumer.on("data", function(chunk){
        console.log(chunk.toString())
        data.push(chunk)
      })
      consumer.on("end", function(){
        Buffer.concat([
          new Buffer("stored 1"),
          new Buffer("stored 2"),
          new Buffer("data 1"),
          new Buffer("data 2"),
          new Buffer("data 3"),
          new Buffer("data 4"),
          new Buffer("data 5"),
        ]).toString()
          .should.eql(Buffer.concat(data).toString())

        done()
      })
    })
  })
})
