'use strict';

// Run as:
// node dataMigration/0001-rethink-to-file-streams -c loom.yaml | bunyan

var loader = require("../bin/loom");
import * as logger from "../lib/logger";
let log = logger.getLogger('migration 0002');
import { rethink } from "../lib/rethink";
import { Database } from "../lib/knex";
import * as co from 'co';
import * as fs from 'fs';

import { RethinkStorage } from "../lib/models/rethink_storage";
import { PostgreStorage } from "../lib/models/postgre_storage";

var listRethinkStreams = function(cb) {
  var Meta = rethink.models.Meta;
  Meta.run(function(err, streams) {
    if (err) { return cb(err); }

    cb(null, streams.map((s)=>s));
  });
};

// returns a promise that resolves to true or false
var metaRowExists = function(id, postgreStorage) {
  return new Promise(function(accept, reject) {
    postgreStorage.loadStream(id, (err) =>{
      accept(err);
    });
  });
};

// returns a promise that resoslves when src if fully written to dest
var writeStream = function(src, dest) {
  return new Promise(function(accept, reject) {
    src
      .pipe(dest)
      .on('finish', accept)
      .on('error', reject);
  });
};


loader.load(function(err, config) {
  log.info(config, 'using config:');

  try {
    rethink.connect(config.db);
    var rethinkStorage = new RethinkStorage(config.storage);
    var postgreStorage = new PostgreStorage(config.storage);

    listRethinkStreams(function(err, streamIds) {
      if (err) {
        return log.error(err);
      }

      co(function*() {
        for (let meta of streamIds) {
          var exists = yield metaRowExists(meta.id, postgreStorage);

          if (exists) {
           log.info(`exists, skipping:  ${meta.id}`); 
           log.info(`${exists}`); 
          }
          else {
            log.info(`writing stream to: ${meta.id}`);

            let metaData = meta.meta.metaData;

            postgreStorage.saveStream(meta.id,meta.meta);
            
          }
        }

        setTimeout(()=> rethink.thinky.r.getPool().drain(), 1000);
      }).catch(function(err) {
        console.error(err.stack);
      });
    });
  }
  catch (e) {
    console.error(e.stack);
  }
});



