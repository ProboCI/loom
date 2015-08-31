// var restify = require('restify');

var ArrayStreamStorage = require('../../models').ArrayStreamStorage
var RethinkStorage = require('../../models').RethinkStorage

Storage = RethinkStorage
//Storage = ArrayStreamStorage

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
    var storage = new Storage()
    storage.saveStream(id, {
      metadata: metadata
    }).then(function(){

      req.pipe(storage.createWriteStream(id))

      req.on("end", function(){
        req.log.debug({stream_id: id}, "producer stream ended")
        res.end()
        next && next()
      })

      req.log.info({id, metadata}, "created stream")

      res.writeHead(201, {
        "x-stream-id": id
      })
      res.flushHeaders()
    })
  },

  get: function(req, res, next){
    var streamId = req.params.id

    req.log.info({streamId}, "got a consumer request")

    var storage = new Storage()
    var writer = storage.createReadStream(streamId)

    storage.loadStream(streamId).then(function(stream){
      console.log(stream)

      if(!stream){
        res.json({error: `The stream with ID ${streamId} does not exist`})
        return next()
      }

      res.header('x-stream-metadata', JSON.stringify(stream.metadata))

      writer.pipe(res)

      res.on('finish', function(){
        console.log(storage._store)

        req.log.info("consumer stream ended")
        next()
      })
    }).catch(function(err){
      req.log.error({err}, "Could not fetch stream")
      res.json({error: err.message})
      return next()
    })
  }
}

module.exports = {streams}
