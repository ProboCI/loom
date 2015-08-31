return

var through = require('through2')
var Stream = require('../lib/models').Stream
var ArrayStreamStorage = require('../lib/models').ArrayStreamStorage

describe.skip("models", function(){
  describe("arraystream", function(){
    it("gives stored data", function (done){
      var storage = new ArrayStreamStorage()

      var data = []
      storage.write(new Buffer("data 1"))
      storage.write(new Buffer("data 2"))

      storage.on('readable', function() {
        var chunk = storage.read()
        console.log("<<== got data from storage: [" + chunk.toString() + "]")
        data.push(chunk)
      });

      setTimeout(function(){
        storage.write(new Buffer("data delayed 1"))

        setTimeout(function(){
          storage.write(new Buffer("data delayed 2"))

          setTimeout(function(){
            storage.end()
            storage_write_finished()
          }, 100)
        }, 500)
      }, 500)

      function storage_write_finished(){
        console.log(storage._array_buffer.slice(0, 4))

        // console.log(consumer._array_buffer)
        [new Buffer("data 1"), new Buffer("data 2"),
         new Buffer("data delayed 1"), new Buffer("data delayed 2")]
          .should.eql(storage._array_buffer.slice(0, 4))

        // make sure we can reset the stream too
        var storage2 = new ArrayStreamStorage(storage)

        true.should.eql(storage.getBuffer() === storage2.getBuffer())

        var data2 = []
        storage2.on('readable', function() {
          var chunk = storage.read()
          // console.log("<<== got data from storage2: [" + chunk.toString() + "]")
          data.push(chunk)
        });

        setTimeout(function(){
          storage2.write("moar data")
          storage2.end()

          Buffer.concat([Buffer.concat(data), new Buffer("moar data")]).toString()
            .should.eql(Buffer.concat(data2).toString())
          done()
        }, 100)

        // storage2.on("end", function(){

        // })
      }
    })
  })

  describe("Stream", function(){
    var storage = new ArrayStreamStorage()
    var stream = new Stream(storage)

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
        [new Buffer("data 1"), new Buffer("data 2")].join()
          .should.eql(stream._storage.getBuffer().join())

        done()
      })
      producer.pipe(stream)
    })

    it("gives stored data", function (done){
      var consumer = new Stream(new ArrayStreamStorage(stream._storage))

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
      var liveStream = new Stream(new ArrayStreamStorage())

      // push a few things onto storage
      liveStream._storage.write("stored 1")
      liveStream._storage.write("stored 2")

      // add in a live producer
      // only start producer after a delay
      setTimeout(function(){
        makeProducer(5, 50).pipe(liveStream)
      }, 100)

      var consumer = new Stream(new ArrayStreamStorage(liveStream._storage))
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
