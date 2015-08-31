"use strict"

var rethink = {
  r: require('rethinkdbdash')(),
  config: null,
  connect: function(config){
    rethink.config = config

    // connect with a connection pool
    rethink.r = require('rethinkdbdash')({
      servers: [{
        host: config.host,
        port: config.port
      }],
      db: config.db
    })

    rethink.ready = rethink._ensure_db_ready()

    return rethink
  },

  _ensure_db_ready: function(){
    var r = rethink.r
    var self = rethink

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

      if(dbs.indexOf(self.config.db) < 0){
        return r.dbCreate(self.config.db).then(function(ret){
          return createTables()
        })
      } else {
        return createTables()
      }
    })
  }
}
module.exports = rethink

