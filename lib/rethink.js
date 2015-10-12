"use strict"

var _ = require('lodash')
var log = require('./logger').getLogger('db')

/**
 * .thinky, .r, .models, and .config get automatically set on connect()
 */
var rethink = {
  thinky: null,
  r: null,
  config: null,
  models: null,

  connect: function(config){
    rethink.config = _.defaults(config || {}, {
      logs_table: "logs",
      meta_table: "meta"
    });

    var thinky = rethink.thinky = require('thinky')({
      host: config.host,
      port: config.port,
      db: config.db
    })

    // grab instance of the driver
    var r = rethink.r = thinky.r

    // log whenever the # of connections in the pool changes
    r.getPoolMaster().on('size', function(size) {
      log.debug({pool_size: size}, "# of connections in pool:")
    });

    rethink.models = createModels(thinky, config)

    return rethink
  }
}

function createModels(thinky, config){
  var Logs = thinky.createModel(config.logs_table, {}, {enforce_extra: 'none'})
  Logs.ensureIndex('ts')
  Logs.ensureIndex('sid')
  Logs.ensureIndex('sid_ts', (row) => [row("sid"), row("ts")] )

  var Meta = thinky.createModel(config.meta_table, {}, {enforce_extra: 'none'})

  return {Logs, Meta}
}


module.exports = rethink
