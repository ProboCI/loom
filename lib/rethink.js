"use strict"

var _ = require('lodash')
var co = require('co')

var rethink = {
  r: require('rethinkdbdash')(),
  config: null,
  connect: function(config){
    rethink.config = _.defaults(config || {}, {
      logs_table: "logs",
      meta_table: "meta"
    });

    // connect with a connection pool
    rethink.r = require('rethinkdbdash')({
      servers: [{
        host: config.host,
        port: config.port
      }],
      db: config.db
    })


    rethink.ready = function(){
      return rethink._ensure_db_ready()
    }

    return rethink
  },

  _ensure_db_ready: co.wrap(function* (){
    var r = rethink.r
    var self = rethink

    console.log("creating dbs and tables")

    var dbs = yield r.dbList()
    if(dbs.indexOf(self.config.db) < 0){
      console.log("creating db", self.config.db)
      yield r.dbCreate(self.config.db)
    }

    var tables = yield r.tableList()
    console.log("tables", tables)

    function* createTable(table){
      if(tables.indexOf(table) < 0){
        console.log("creating table", table)
        yield r.tableCreate(table)
      }
    }

    yield [createTable(self.config.logs_table), createTable(self.config.meta_table)]

    function* createIndex(table, index, f){
      console.log(`creating index ${table}:${index}`)
      try {
        yield r.table(table).indexCreate(index, f)
        yield r.table(table).indexWait()
      } catch (e){
        // index already exists, ignore
        console.log(` -> already exists ${table}:${index}`)
      }
      console.log(`created index ${table}:${index}`)
    }

    console.log('creating indexes')
    yield [
      createIndex(self.config.logs_table, 'ts'),
      createIndex(self.config.logs_table, "sid_ts", function(row) {
        return [row("sid"), row("ts")]
      }),
      createIndex(self.config.logs_table, "sid")
    ]

    console.log("Rethink ready")
  })
}
module.exports = rethink

