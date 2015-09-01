// var restify = require('restify');

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

    var id = 'stream-server-' + +new Date()
    req.log = req.log.child({sid: id}, true)

    var storage = new Storage()
    storage.saveStream(id, {
      metadata: metadata
    }).then(function(){

      req.pipe(storage.createWriteStream(id))

      active_streams.emit("added", id)

      req.on("end", function(){
        req.log.debug({stream_id: id}, "producer stream ended")
        res.end()
        active_streams.emit("removed", id)
        next && next()
      })

      req.log.info({metadata}, "created stream")

      res.writeHead(201, {
        "x-stream-id": id
      })
      res.flushHeaders()
    })
  },

  get: function(req, res, next){
    var streamId = req.params.id

    req.log = req.log.child({sid: streamId}, true)
    req.log.info("got a consumer request")

    var storage = new Storage()
    var writer = storage.createReadStream(streamId)

    storage.loadStream(streamId).then(function(stream){
      if(!stream){
        res.json({error: `The stream with ID ${streamId} does not exist`})
        return next()
      }

      res.header('x-stream-metadata', JSON.stringify(stream.metadata))

      writer.pipe(res)

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
