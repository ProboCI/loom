"use strict"

var _ = require('lodash')
var through = require('through2')
var multistream = require('multistream')
var combine = require('stream-combiner')
var JSONStream = require('JSONStream')
var Throttle = require('stream-throttle').Throttle

// connect to localhost on default port with a connection pool
var rethink = require('../rethink')

class RethinkStorage {
  /**
   * @param config - Config object
   * @param [config.meta_table="meta"] - Rethinkdb table to use for metadata. Defaults to "meta"
   * @param [config.logs_table="logs"] - Rethinkdb table to use for log data. Defaults to "logs"
   */
  constructor(config){
    // super()

    this.config = _.defaults(config || {}, {
      logs_table: "logs",
      meta_table: "meta"
    })
  }

  createWriteStream(streamId){
    var self = this

    // write data buffer to the DB, along with the stream id and a timestamp
    var insert_data = function(data, cb){
      rethink.r.table(self.config.logs_table).insert({
        sid: streamId,
        data,
        ts: new Date()
      }).run(function(err){
        cb(err)
      })
    }

    // create a stream that writes data to the db
    // when the stream ends, write `null` for the data to signify end of stream
    var stream = through(function(data, enc, cb){
      insert_data(data, cb)
    }, function flush(cb){
      // write terminator
      insert_data(null, cb)
    })

    return stream
  }

  createReadStream(streamId, opts){
    var self = this
    opts = opts || {}
    var notail = opts.notail

    // creates a stream that reads all current data in the database
    // so reader can catch up before getting new live data (for an active stream)
    function createCurrentDataStream(){
      var stream = through.obj()

      var throttle = combine(
        through.obj({highWaterMark: 1}, function(obj, enc, cb){
          cb(null, JSON.stringify(obj))
        }),
        new Throttle({rate: 100, highWaterMark: 1}),
        JSONStream.parse(true),
        through.obj(function(obj, enc, cb){
          cb(null, obj)
        })
      )

      // subscribe to the changes feed.
      // filter by sid (stream id) first (which uses the index and is fast),
      // and then order by the timestamp to make sure we get entries in order
      rethink.r.table(self.config.logs_table).getAll(streamId, {index: 'sid'}).orderBy('ts').toStream()
        // .pipe(throttle) // throttle the streams a bit for testing
        .on("error", function(err){
          console.error("current data stream error:", err)
        })
        .on("end", function(){
          // console.log("\n===== CURRENT DATA STREAM ENDED ======\n")
        })
        .pipe(stream)

      return stream
    }

    function createChangesStream(){
      var stream = through.obj()

      var filter = {'old_val': null, new_val: {sid: streamId}}
      rethink.r.table(self.config.logs_table).changes().filter(filter).toStream()
        .on("error", function(err){
          console.error("changes stream error:", err)
        })
        .pipe(through.obj(function(obj, enc, cb){
          // extract out the object from the changes format
          cb(null, obj.new_val)
        }))
        .on("end", function(){
          // console.log("\n===== CHANGES STREAM ENDED ======\n")
        })
        .pipe(stream)

      return stream
    }

    // if the `notail` option is specified, only return the current stream,
    // and do not append change onto it
    var streams = []
    if(!notail){
      // instantiate the changes stream first so that it doesn't miss any writes
      streams.unshift(createChangesStream())
    }
    streams.unshift(createCurrentDataStream())


    // this is our combined stream. it's passed an array of streams, which it will read in order
    // when first stream ends, it reads from the next, etc.
    return multistream.obj(streams)
      .on("error", function(err){
        console.error("combined stream error:", err)
      })
      .pipe(through.obj(function(obj, enc, cb){
        // use use `null` as the stream terminator
        // so if we see it here as the data field, end the read stream

        if(obj.data == null){
          this.end()
          cb()
        } else {
          cb(null, obj.data)
        }
      }))
      .on("error", function(err){
        console.error("combined next stream error:", err)
      })
      .on("end", function(){
        // console.log("\n===== COMBINED STREAM ENDED ======\n")
      })
  }

  saveStream(streamId, meta, opts, cb){
    if(typeof opts == 'function'){
      cb = opts
      opts = false
    }
    opts = opts || {}

    // no truthiness here, only the real 'true' will do
    var conflict = opts.replace === true ? 'replace' : 'error'

    // save the metadata of this stream
    var stream = {
      id: streamId,
      meta: meta
    }
    return rethink.r.table(this.config.meta_table).insert(stream, {conflict: conflict}).run(cb)
  }

  loadStream(streamId, cb){
    // load the metadata of this stream
    return rethink.r.table(this.config.meta_table).get(streamId).run()
      .then(function(stream){
        cb && cb(stream && stream.meta)
        return stream && stream.meta
      }).catch(cb)
  }

  deleteStream(streamId, cb){
    // "delete" the data for this stream
    // (not the metadata - that will get overwritten on save)

    var new_sid_postfix = '_' + +new Date()
    return rethink.r.table(this.config.logs_table)
      .filter({sid: streamId})
      .update({
        sid: rethink.r.row("sid").add(new_sid_postfix),
        origSid: rethink.r.row("sid")
      })
      .run(cb)
  }
}

module.exports = RethinkStorage

