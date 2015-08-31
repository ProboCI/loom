"use strict"

var _ = require('lodash')
var through = require('through2')
var multistream = require('multistream')
var combine = require('stream-combiner')
var JSONStream = require('JSONStream')
var Throttle = require('stream-throttle').Throttle

// connect to localhost on default port with a connection pool
var logsDb = "logs"
var r = require('rethinkdbdash')({
  db: logsDb
});

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
    });

    this._ensure_db_ready()
  }

  createWriteStream(streamId){
    var self = this

    var insert_data = function(data, cb){
      r.table(self.config.logs_table).insert({
        sid: streamId,
        data: data ? data.toString() : data,
        ts: new Date()
      }).run(function(err){
        cb(err)
      })
    }

    var stream = through(function(data, enc, cb){
      insert_data(data, cb)
    }, function flush(cb){
      // write terminator
      insert_data(null, cb)
    })

    return stream
  }

  createReadStream(streamId){
    var self = this

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

      r.table(self.config.logs_table).getAll(streamId, {index: 'sid'}).orderBy('ts').toStream()
        // .pipe(throttle) // throttle the streams a bit for testing
        .on("error", function(err){
          console.error("current data stream error:", err)
        })
        .on("end", function(){
          console.log("\n===== CURRENT DATA STREAM ENDED ======\n")
        })
        .pipe(stream)

      return stream
    }

    function createChangesStream(){
      var stream = through.obj()

      var filter = {'old_val': null, new_val: {sid: streamId}}
      r.table(self.config.logs_table).changes().filter(filter).toStream()
        .on("error", function(err){
          console.error("changes stream error:", err)
        })
        .pipe(through.obj(function(obj, enc, cb){
          // extract out the object from the changes format
          cb(null, obj.new_val)
        }))
        .on("end", function(){
          console.log("\n===== CHANGES STREAM ENDED ======\n")
        })
        .pipe(stream)

      return stream
    }

    return multistream.obj([
      createCurrentDataStream(),
      createChangesStream()
    ])
      .on("error", function(err){
        console.error("combined stream error:", err)
      })
      .pipe(through.obj(function(obj, enc, cb){
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
        console.log("\n===== COMBINED STREAM ENDED ======\n")
      })
  }


  _ensure_db_ready(){
    var self = this
    return r.dbList().then(function(dbs){
      function createTables(){
        return r.tableList().then(function(tables){
          var p, promises = []
          if(tables.indexOf(self.config.logs_table) < 0){
            p = r.tableCreate(self.config.logs_table).then(function(){
              return r.table(self.config.logs_table).indexCreate('ts').run()
            }).then(function(){
              return r.table(self.config.logs_table).indexCreate("sid_ts", function(row) {
                return [row("sid"), row("ts")];
              }).run()
            }).then(function(){
              return r.table(self.config.logs_table).indexCreate("sid").run()
            })

            promises.push(p)
          }
          if(tables.indexOf(self.config.meta_table) < 0){
            p = r.tableCreate(self.config.meta_table).run()
            promises.push(p)
          }
          return Promise.all(promises)
        })
      }

      if(dbs.indexOf(logsDb) < 0){
        return r.dbCreate(logsDb).then(function(ret){
          return createTables()
        })
      } else {
        return createTables()
      }
    })
  }

  saveStream(streamId, meta, cb){
    // save the meta-data of this stream
    meta.id = streamId
    var self = this
    return this._ensure_db_ready().then(function(){
      return r.table(self.config.meta_table).insert(meta).run(cb)
    })
  }

  loadStream(streamId, cb){
    var self = this

    return this._ensure_db_ready().then(function(){
      // load the metadata of this stream
      return r.table(self.config.meta_table).get(streamId).run(cb)
    })
  }
}

module.exports = RethinkStorage

