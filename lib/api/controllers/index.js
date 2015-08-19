// var restify = require('restify');

// stream = {chunks: [], metadata: {}, id: "", open: boolean, size: number}
var streams = {}
var seq = 0

var stream = {
  create: function(req, res, next){
    var id = `stream-${seq++}`

    var metadata = req.header('x-stream-metadata')
    try {
      metadata = JSON.parse(metadata)
    } catch (e){
      req.log.warn({err: e}, "Failed to parse metadata header as JSON")
    }

    var stream = streams[id] = {
      id: id,
      chunks: [],
      metadata: metadata,
      open: true,
      size: 0,

      req: req
    }

    req.on("data", function(data){
      req.log.debug({stream_id: id, chunk: data.toString()}, "data received")
      stream.chunks.push(data)
      stream.size += Buffer.bufferLength(data)
    })

    req.on("end", function(){
      req.log.debug({stream_id: id}, "producer stream ended")
      stream.open = false
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
      res.json({error: `The stream with ID ${streamId} does not exist`})
      return next()
    }

    res.header("x-stream-open", stream.open)
    res.header('x-stream-size', stream.size)
    res.header('x-stream-metadata', JSON.stringify(stream.metadata))

    // push out all existing data
    for(var chunk of stream.chunks){
      res.write(chunk)
    }

    res.on('finish', next)

    // wire up new data if there's more
    if(stream.open){
      stream.req.pipe(res)
    } else {
      // close stream, we've sent all chunks
      setTimeout(function(){
        res.end()
      }, 1000)
    }
  }
}

module.exports = {stream}

// var models = require('../models');
// var data_utils = require('../models/thinky').utils;
// var validation = require('../../validation');


// function status(req, res, next) {
//   res.send({up: true});
//   next();
// }

// function respond(req, res, next) {
//   res.send('hello ' + req.params.name);
//   next();
// }

// // validation middleware
// var validators = {
//   project: {
//     search: function(controller){
//       var validate = validation({
//         query: {
//           keysIn: ["service", "slug", "host", "single"],
//           message: 'Search query terms must be one of: %(expected), have: %(value)'
//         }
//       });

//       return function validation_controller(req, res, next){
//         var err = validate({query: req.query});

//         if(err) {
//           return next(new restify.InvalidContentError(err[0].message));
//         }

//         controller(req, res, next);
//       }
//     }
//   }
// }

// var project = {
//   build: require('./build'),

//   search: validators.project.search(function _(req, res, next){
//     var filter = {
//       active: true,
//       provider: {
//         slug: req.query.service
//       },
//       slug: req.query.slug,
//     };

//     req.log.debug({filter}, "Project search filter")

//     data_utils.find(models.Project, filter, function(err, projects){
//       if(err){
//         req.log.error({err: err, filter: filter}, "Error searching for project");
//         return next(err);
//       }

//       req.log.debug({projects}, "Projects found")

//       if(req.query.single == "true"){
//         projects = projects[0];
//       }

//       req.log.debug({projects}, "Projects being returned")

//       res.json(projects);
//       next();
//     });
//   }),

//   get_container_managers: function(req, res, next){
//     // req.params.pid
//   }
// }

