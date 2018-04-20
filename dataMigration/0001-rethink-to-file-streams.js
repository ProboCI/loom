'use strict';

// Run as:
// node dataMigration/0001-rethink-to-file-streams -c loom.yaml | bunyan

var loader = require('../bin/loom');
var log = require('../lib/logger').getLogger('migration 0001');
var rethink = require('../lib/rethink');
var co = require('co');
var fs = require('fs');

var RethinkStorage = require('../lib/models').RethinkStorage;
var FileSystemStorage = require('../lib/models').FileSystemStorage;

var listRethinkStreams = function(cb) {
  var Meta = rethink.models.Meta;
  Meta.run(function(err, streams) {
    if (err) { return cb(err); }

    cb(null, streams.map((s)=>s.id));
  });
};

// returns a promise that resolves to true or false
var fileExists = function(path) {
  return new Promise(function(accept, reject) {
    fs.access(path, (err) => {
      accept(!err);
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
    var fileStorage = new FileSystemStorage(config.storage);

    listRethinkStreams(function(err, streamIds) {
      if (err) {
        return log.error(err);
      }

      co(function*() {
        for (let id of streamIds) {
          let path = fileStorage.makeStreamFilePath(id);
          var exists = yield fileExists(path);

          if (exists) {
            log.info(`exists, skipping:  ${path}`);
          }
          else {
            log.info(`writing stream to: ${path}`);
            yield writeStream(
              rethinkStorage.createReadStream(id, {notail: true}),
              fileStorage.createWriteStream(id)
            );
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


