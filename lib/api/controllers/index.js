// var restify = require('restify');

var Stream = require('../../models').Stream
var ArrayStreamStorage = require('../../models').ArrayStreamStorage

// stream = {chunks: [], metadata: {}, id: "", open: boolean, size: number}
var streams = {}

var stream = {
  create: function(req, res, next){
    var metadata = req.header('x-stream-metadata')
    try {
      if(metadata){
        metadata = JSON.parse(metadata)
      }
    } catch (e){
      req.log.warn({err: e, metadata}, "Failed to parse metadata header as JSON")
    }

    var storage = new ArrayStreamStorage()
    var stream = new Stream(storage)
    streams[stream.id] = stream
    req.pipe(stream)

    var id = stream.id

    // req.on("data", function(data){
    //   req.log.debug({stream_id: id, chunk: data.toString()}, "data received")
    //   stream.chunks.push(data)
    //   stream.size += Buffer.bufferLength(data)
    // })

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
  },

  get: function(req, res, next){
    var streamId = req.params.id
    var stream = streams[streamId]

    req.log.info({streamId}, "got a consumer request")

    if(!stream){
      res.json({error: `The stream with ID ${streamId} does not exist`, have: Object.keys(streams)})
      return next()
    }

    res.header("x-stream-open", stream.open)
    res.header('x-stream-size', stream.size)
    res.header('x-stream-metadata', JSON.stringify(stream.metadata))

    var consumer = new Stream(new ArrayStreamStorage(stream._storage))
    consumer.pipe(res)
    res.on('end', function(){
      req.log.info("consumer stream ended")
      next()
    })
  }
}

module.exports = {stream}
