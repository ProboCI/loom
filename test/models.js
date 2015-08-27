var through = require('through2')
var Stream = require('../lib/models').Stream
var ArrayStreamStorage = require('../lib/models').ArrayStreamStorage

describe.only("models", function(){
  describe("arraystream", function(){
    it("gives stored data", function (done){
      var consumer = new ArrayStreamStorage()

      var data = []
      consumer.write("data 1")
      consumer.write("data 2")

      consumer.on('readable', function() {
        var chunk
        while (null !== (chunk = consumer.read())) {
          // console.log("<<== got data from consumer: [" + chunk.toString() + "]")
          data.push(chunk)
        }
      });

      setTimeout(function(){
        consumer.write("data delayed 1")

        setTimeout(function(){
          consumer.write("data delayed 2")
          consumer.end()
        }, 500)
      }, 500)

      // note: all data must be consumed for 'end' to fire
      consumer.on("end", function(){
        // console.log(consumer._array_buffer)
        Buffer.concat([new Buffer("data 1"), new Buffer("data 2"),
                       new Buffer("data delayed 1"), new Buffer("data delayed 2")]).toString()
          .should.eql(Buffer.concat(data).toString())

        // make sure we can reset the stream too
        var consumer2 = consumer.createReadableStream()

        true.should.eql(consumer.getBuffer() === consumer2.getBuffer())

        var data2 = []
        consumer2.on('readable', function() {
          var chunk
          while (null !== (chunk = consumer2.read())) {
            // console.log("<<== got data from consumer2: [" + chunk.toString() + "]")
            data2.push(chunk)
          }
        });

        setTimeout(function(){
          consumer2.write("moar data")
          consumer2.end()
        }, 100)

        consumer2.on("end", function(){
          Buffer.concat([Buffer.concat(data), new Buffer("moar data")]).toString()
                        .should.eql(Buffer.concat(data2).toString())
          done()
        })
      })
    })
  })

  describe.only("Stream", function(){
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
          .should.eql(stream._storage.getBuffer())

        done()
      })
      stream.setProducerStream(producer)
    })

    it("gives stored data", function (done){
      var consumer = stream.createConsumerStream()

      var data = []

      consumer.on('readable', function() {
        var chunk
        while (null !== (chunk = consumer.read())) {
          // console.log(chunk.toString())
          data.push(chunk)
        }
      });

      consumer.on("end", function(){
        Buffer.concat([new Buffer("data 1"), new Buffer("data 2")])
          .should.eql(Buffer.concat(data))
        done()
      })
    })

    it("gives stored and live data", function (done){
      var liveStream = new Stream()

      // push a few things onto storage
      liveStream._storage.write("stored 1")
      liveStream._storage.write("stored 2")

      // add in a live producer
      // only start producer after a delay
      setTimeout(function(){
        liveStream.setProducerStream(makeProducer(5, 50))
      }, 100)

      var consumer = liveStream.createConsumerStream()
      var data = []

      consumer.on('readable', function() {
        var chunk
        while (null !== (chunk = consumer.read())) {
          // console.log("live chunk read:", chunk.toString())
          data.push(chunk)
        }
      });

      consumer.on("end", function(){
        // console.log(consumer.getBuffer())

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
