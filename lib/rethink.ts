'use strict';

import * as _ from 'lodash';
import { getLogger } from './logger';
import * as Thinky from 'thinky';

const logger = getLogger('db');

/**
 * .thinky, .r, .models, and .config get automatically set on connect()
 */
export const rethink = {
  thinky: null,
  r: null,
  config: null,
  models: null,

  connect: function(config) {
    rethink.config = _.defaults(config || {}, {
      logsTable: 'logs',
      metaTable: 'meta',
    });

    const thinky = rethink.thinky = Thinky({
      host: config.host,
      port: config.port,
      db: config.db,
    });

    // grab instance of the driver
    const r = rethink.r = thinky.r;

    // log whenever the # of connections in the pool changes
    r.getPoolMaster().on('size', function(size) {
      logger.debug({pool_size: size}, `# of connections in pool: ${size}`);
    });

    rethink.models = createModels(thinky, config);

    return rethink;
  }
}


function createModels(thinky, config) {
  var Logs = thinky.createModel(config.logsTable, {}, {enforce_extra: 'none'});
  Logs.ensureIndex('ts');
  Logs.ensureIndex('sid');
  Logs.ensureIndex('sid_ts', function(row) { return [row('sid'), row('ts')]; });

  var Meta = thinky.createModel(config.metaTable, {}, {enforce_extra: 'none'});

  return {Logs, Meta};
}
