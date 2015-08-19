var models = require('../lib/models')

describe.only("models", function(){
  describe("MemoryStream", function(){
    it("accepts data", function (done){
      var stream = new models.MemoryStream()

      var pushes = 2
      var _i = setInterval(function(){
        if(pushes <= 0){
          clearInterval(_i)
          stream.end()
        } else {
          stream.write("data " + pushes--)
        }
      }, 100)

      stream.on('finish', function(){
        [new Buffer("data 2"), new Buffer("data 1")]
          .should.eql(stream._storage._readableState.buffer)

        done()
      })
    })

    it("gives data", function (done){
      var stream = new models.MemoryStream()

      stream.write("data 1")
      stream.write("data 2")

      // test reading data before it's finished

      stream.on('finish', function(){
        [new Buffer("data 2"), new Buffer("data 1")]
          .should.eql(stream._storage._readableState.buffer)

        done()
      })
    })
  })
})
