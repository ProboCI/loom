var through = require('through2')
var bl = require('bl')
var ArrayStreamStorage = require('../lib/models').ArrayStreamStorage
var RethinkStorage = require('../lib/models').RethinkStorage

function test_storage(Storage){
  function read(streamid, storage){
    return (storage || new Storage()).createReadStream(streamid)
  }

  function write(streamid, storage){
    return (storage || new Storage()).createWriteStream(streamid)
  }

  describe("Storage: " + Storage.name, function (){
    before(function* reset(){
      if(Storage === RethinkStorage){
        // configure and reset DB
        var config = {
          db: process.env.DB_NAME || "test"
        }
        var rethink = require('../lib/rethink')
        try {
          yield rethink.r.dbDrop(config.db)
        } catch (e){
          //console.log("warning:", e.message)
        }
        rethink.connect(config)
        yield rethink.ready()
      }
    })

    describe("storage basics", function (){
      var streams = {
        'stream 1': {some: 'data'},
        'stream 2': {more: 'data'}
      }

      it("creates streams", function* (){
        var storage = new Storage()
        for(var streamid in streams){
          var meta = yield storage.saveStream(streamid, streams[streamid])
          // switch(streamid){
          // case 'stream 1':
          //   meta.should.eql({some: "data"})
          //   break;
          // case 'stream 2':
          //   meta.should.eql({more: "data"})
          //   break;
          // }
        }
      })

      it("loads streams", function* (){
        var storage = new Storage()
        var meta = yield storage.loadStream(Object.keys(streams)[0])
        meta.should.eql({some: "data"})
      })

      it("stream 1 writes then reads", function(done){
        var storage = new Storage()
        var list = bl()
        list.append("some data")
        list.append("more data")

        var streamid = 'stream 1'
        var writer = write(streamid, storage)
        list.duplicate().pipe(writer)

        writer.on("finish", function(){
          var reader = read(streamid, storage)
          reader.pipe(bl(function(err, data){
            if(err) return done(err)
            data.should.eql(list.slice(), 'reader on same storage as writer works')
          }))

          reader.on('end', function(){
            read(streamid).pipe(bl(function(err, data){
              if(err) return done(err)
              data.should.eql(list.slice(), 'reader on different storage than writer works')

              done()
            }))
          })
        })
      })

      it("stream 2 writes and reads async", function(done){
        var expected, num = 10, interval = 100
        var producer = makeProducer(num, interval, function finished_producing(data){
          expected = data
        })

        producer.pipe(write('stream 2'))

        var immediate_finished = false
        var delayed_finished = false

        // reader that starts reading immediately (full stream mode)
        read('stream 2').pipe(bl(function(err, data){
          // console.log("expected:", expected.toString())
          // console.log("found   :", data.toString())

          data.toString().should.eql(expected.toString())
          immediate_finished = true

          if(delayed_finished && immediate_finished)
            done()
        }))

        // reader that starts listenting half way (partial stream mode)
        // gets existing data, then listens for changes
        setTimeout(function(){
          read('stream 2').pipe(bl(function(err, data){
            // console.log("expected:", expected.toString())
            // console.log("found   :", data.toString())

            data.toString().should.eql(expected.toString())

            delayed_finished = true

            if(delayed_finished && immediate_finished)
              done()
          }))
        }, num*interval/2)
      })
    })
  })
}

test_storage(ArrayStreamStorage)
test_storage(RethinkStorage)

function makeProducer(numpushes, interval, finished){
  numpushes = numpushes || 2
  interval = interval || 100

  var producer = through()

  var data = []

  var pushed = 0
  var _i = setInterval(function(){
    if(pushed >= numpushes){
      clearInterval(_i)
      producer.end()
    } else {
      var d = new Buffer("data " + ++pushed)
      data.push(d)
      producer.write(d)
    }
  }, interval)

  if(finished){
    producer.on('finish', function(){
      finished && finished(Buffer.concat(data))
    })
  }
  return producer
}
