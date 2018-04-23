'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var loader = require("../bin/loom");
const logger = require("../lib/logger");
let log = logger.getLogger('migration 0002');
const rethink_1 = require("../lib/rethink");
const co = require("co");
const rethink_storage_1 = require("../lib/models/rethink_storage");
const postgre_storage_1 = require("../lib/models/postgre_storage");
var listRethinkStreams = function (cb) {
    var Meta = rethink_1.rethink.models.Meta;
    Meta.run(function (err, streams) {
        if (err) {
            return cb(err);
        }
        cb(null, streams.map((s) => s));
    });
};
var metaRowExists = function (id, postgreStorage) {
    return new Promise(function (accept, reject) {
        postgreStorage.loadStream(id, (err) => {
            accept(err);
        });
    });
};
var writeStream = function (src, dest) {
    return new Promise(function (accept, reject) {
        src
            .pipe(dest)
            .on('finish', accept)
            .on('error', reject);
    });
};
loader.load(function (err, config) {
    log.info(config, 'using config:');
    try {
        rethink_1.rethink.connect(config.db);
        var rethinkStorage = new rethink_storage_1.RethinkStorage(config.storage);
        var postgreStorage = new postgre_storage_1.PostgreStorage(config.storage);
        listRethinkStreams(function (err, streamIds) {
            if (err) {
                return log.error(err);
            }
            co(function* () {
                for (let meta of streamIds) {
                    var exists = yield metaRowExists(meta.id, postgreStorage);
                    if (exists) {
                        log.info(`exists, skipping:  ${meta.id}`);
                        log.info(`${exists}`);
                    }
                    else {
                        log.info(`writing stream to: ${meta.id}`);
                        let metaData = meta.meta.metaData;
                        postgreStorage.saveStream(meta.id, meta.meta);
                    }
                }
                setTimeout(() => rethink_1.rethink.thinky.r.getPool().drain(), 1000);
            }).catch(function (err) {
                console.error(err.stack);
            });
        });
    }
    catch (e) {
        console.error(e.stack);
    }
});
//# sourceMappingURL=0002-rethink-to-postgre.js.map