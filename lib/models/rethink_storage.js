"use strict"

var _ = require('lodash')
var through = require('through2')
var multistream = require('multistream')
var combine = require('stream-combiner')
var JSONStream = require('JSONStream')
var Throttle = require('stream-throttle').Throttle

// connect to localhost on default port with a connection pool
var rethink = require('../rethink')

var logger = require('../logger');

class RethinkStorage {
  /**
   * @param config - Config object
   * @param [config.metaTable="meta"] - Rethinkdb table to use for metadata. Defaults to "meta"
   * @param [config.logsTable="logs"] - Rethinkdb table to use for log data. Defaults to "logs"
   */
  constructor(config){
    // super()

    this.config = _.defaults(config || {}, {
      logsTable: "logs",
      metaTable: "meta"
    })

    this.log = logger.getLogger();
  }

  createWriteStream(streamId){
    var self = this

    // write data buffer to the DB, along with the stream id and a timestamp
    var insert_data = function(data, cb){
      rethink.r.table(self.config.logsTable).insert({
        sid: streamId,
        data,
        ts: new Date(),
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
    var self = this;
    opts = opts || {};
    var notail = opts.notail;

    var stream = through.obj();

    function log() {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('CHANGES STREAM:');
      self.log.trace.apply(self.log, args);
    }

    log('in createReadStream()');

    var r = rethink.r;
    var dbStream = r.table(self.config.logsTable)
      .orderBy({index: 'sid_ts'})
      .between([streamId, r.minval],
               [streamId, r.maxval],
               {index: 'sid_ts', leftBound: 'closed', rightBound: 'closed'})
      .changes({includeInitial: true, includeStates: true})
      .toStream();

    var createInitialDataSortingStream = function(opts) {
      var buffer = [];
      var initializing = true;

      var log = opts.log;

      return through.obj(function(obj, enc, cb) {
        var self = this;
        if (obj === 'ready') {
          log('ready state');
          initializing = false;

          // sort buffer by ascending timestamp and write buffer through
          buffer.sort(function(obj1, obj2) {
            // sort in ascending order by timestamp
            return obj1.ts - obj2.ts;
          }).map(function(obj) {
            log('sending sorted buffer object', obj);
            self.push(obj);
          });

          // pass through the 'ready' event as well so that notail handling can work
          this.push(obj);
        }
        else if (initializing) {
          // still getting initial data from storage, write it to buffer
          // for sorting later, but only keep the actual object

          log('queuing to buffer', obj);

          buffer.push(obj);
        }
        else {
          // newly added object
          log('pushing new object through', obj);
          this.push(obj);
        }

        cb();
      });
    };


    dbStream
      .on('error', function(err) {
        self.log.error({err}, 'changes stream error:', err.message);
      })
      .on('end', function() {
        log('DB STREAM ended');
      })

    // Map changes object format to just our objects.
    // Preserve state by pushing just a string with the state name.
      .pipe(through.obj(function(obj, enc, cb) {
        if (obj.state) {
          this.push(obj.state);
        }
        if (obj.new_val) {
          this.push(obj.new_val);
        }
        cb();
      }))

    // Buffer initial data for the stream, and sort it by timestamp before
    // sending it out. When Rethink query does this natively, this pipe can
    // be removed & includeStates flag can be set to false (default).
      .pipe(createInitialDataSortingStream({log}))

    // handle stream state transitions
      .pipe(through.obj(function(obj, enc, cb) {
        if (obj === 'initializing') {
          // drop this state notification, we don't need it
          log('initializing state');
        }
        else if (obj === 'ready') {
          // If the `notail` option is specified, only return the current stream,
          // and do not append changes onto it. In either case, drop the state

          if (notail) {
            log('ready state & notail=true; closing stream');
            this.end();
          }
        }
        else {
          // keep going
          this.push(obj);
        }

        cb();
      }))

      .pipe(through.obj(function(obj, enc, cb) {
        // perform loom stream logic by introspecting the data and ending the stream
        // when it's null

        if (obj.data == null) {
          log('ending stream');
          this.end();
        }
        else {
          this.push(obj.data);
        }
        cb();
      }))
      .on('end', function() {
        log('transform stream ended, ending db changes stream');

        dbStream.close();
      })
      .pipe(stream);

    return stream;
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
    return rethink.r.table(this.config.metaTable).insert(stream, {conflict: conflict}).run(cb)
  }

  loadStream(streamId, cb){
    // load the metadata of this stream
    return rethink.r.table(this.config.metaTable).get(streamId).run()
      .then(function(stream){
        cb && cb(stream && stream.meta)
        return stream && stream.meta
      }).catch(cb)
  }

  deleteStream(streamId, cb){
    // "delete" the data for this stream
    // (not the metadata - that will get overwritten on save)

    var new_sid_postfix = '_' + +new Date()
    return rethink.r.table(this.config.logsTable)
      .filter({sid: streamId})
      .update({
        sid: rethink.r.row("sid").add(new_sid_postfix),
        origSid: rethink.r.row("sid")
      })
      .run(cb)
  }
}

module.exports = RethinkStorage

