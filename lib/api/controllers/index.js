var co = require('co');

var ArrayStreamStorage = require('../../models').ArrayStreamStorage
var RethinkStorage = require('../../models').RethinkStorage

Storage = RethinkStorage
//Storage = ArrayStreamStorage

var active_streams = (function(){
  var active =  new (require("events").EventEmitter)()
  active.streams = []
  active.on("added", function(id){
    active.streams.push(id)
  })
  active.on("removed", function(id){
    var i = active.streams.indexOf(id)
    if(i >= 0){
      active.streams.splice(i, 1)
    }
  })

  var color_index = 0
  active.get_color = function(obj){
    var colors = [
      "black", "red", "green", "yellow", "blue", "gray", "magenta", "cyan", "white",
      //"bgBlack", "bgRed", "bgGreen", "bgYellow", "bgBlue", "bgMagenta", "bgCyan", "bgWhite"
    ]
    return colors[color_index++ % colors.length];
  }

  return active
})()

var streams = {
  create: function(req, res, next){
    var metadata = req.header('x-stream-metadata')
    try {
      if(metadata){
        metadata = JSON.parse(metadata)
      }
    } catch (e){
      req.log.warn({err: e, metadata}, "Failed to parse metadata header as JSON")
    }

    co(function* (){
      var id = req.params.id || 'stream-server-' + +new Date()
      req.log = req.log.child({sid: id}, true)

      var storage = new Storage()

      var stream = yield storage.loadStream(id)
      if(stream){
        // stream id is already taken, see if force flag is specified
        if(req.query.force !== 'true'){
          var msg = `The stream with ID ${id} already exists.`
          req.log.error(msg)
          res.json({error: msg + ' Specify force=true query param to override.'})
          return next()
        } else {
          // delete existing stream
          req.log.info("deleting stream...")
          yield storage.deleteStream(id)
          req.log.info("stream deleted")

          res.header("x-stream-replaced", true)
        }
      }

      storage.saveStream(id, {
        metadata: metadata
      }, {
        replace: req.query.force === 'true'
      }).then(function(){
        active_streams.emit("added", id)

        // allow time for spy hooks to take hold
        setTimeout(function(){
          req.pipe(storage.createWriteStream(id))
        }, 10)

        req.on("end", function(){
          req.log.info("producer stream ended")
          res.end()
          active_streams.emit("removed", id)
          next && next()
        })

        req.log.info({metadata}, "created stream")

        res.writeHead(201, {
          "x-stream-id": id,
        })
        res.flushHeaders()
      })
    }).catch(next)
  },

  get: function(req, res, next){
    var streamId = req.params.id
    var notail = 'notail' in req.query

    req.log = req.log.child({sid: streamId}, true)
    req.log.info({opts: {notail: notail}}, "got a consumer request")

    var storage = new Storage()
    var reader = storage.createReadStream(streamId, {notail})

    storage.loadStream(streamId).then(function(stream){
      if(!stream){
        res.json({error: `The stream with ID ${streamId} does not exist`})
        return next()
      }

      res.header('x-stream-metadata', JSON.stringify(stream.metadata))

      reader.pipe(res)

      res.on('finish', function(){
        req.log.info("consumer stream ended")
        next()
      })
    }).catch(function(err){
      req.log.error({err}, "Could not fetch stream")
      res.json({error: err.message})
      return next()
    })
  },

  // dumps all active live streams
  spy: function(req, res, next){
    var colors = require('colors')
    colors.supportsColor = colors.enabled = true // force support (needed when running with npm)

    function colorize(str, color){
      if(req.query.color != undefined){
        return colors[color](str).replace(/(^.*):/, "$&".bold)
      }
      return str
    }

    var through2 = require('through2')
    var storage = new Storage()

    function stream(id){
      var color = active_streams.get_color()
      res.write(colorize(`START: ${id}\n`, color))

      var read_stream = storage.createReadStream(id)

      read_stream.pipe(through2(function(chunk, enc, cb){
        cb(null, colorize(`${id}:\n${chunk.toString()}`, color))
      })).pipe(res, {end: false})

      read_stream.on('end', function flush(cb){
        res.write(colorize(`END: ${id}\n`, color))
      })
    }

    // stream all in-flight streams
    active_streams.streams.forEach(stream)

    // stream all new streams
    active_streams.on("added", stream)
  }
}

module.exports = {streams}
