'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const through = require("through2");
const rethink_1 = require("../rethink");
const logger_1 = require("../logger");
class RethinkStorage {
    constructor(config) {
        this.config = _.defaults({}, config, {
            logsTable: 'logs',
            metaTable: 'meta',
        });
        this.log = logger_1.getLogger('');
    }
    createWriteStream(streamId) {
        var self = this;
        var insertData = function (data, cb) {
            rethink_1.rethink.r.table(self.config.logsTable).insert({
                sid: streamId,
                data,
                ts: new Date(),
            }).run(function (err) {
                cb(err);
            });
        };
        var stream = through(function (data, enc, cb) {
            insertData(data, cb);
        }, function flush(cb) {
            insertData(null, cb);
        });
        return stream;
    }
    createReadStream(streamId, opts) {
        var self = this;
        const Opts = opts || {};
        var notail = opts.notail;
        var stream = through.obj();
        const log = (...str) => this.log.trace('CHANGE_STREAM', ...str);
        log('in createReadStream()');
        var r = rethink_1.rethink.r;
        var dbStream = r.table(self.config.logsTable)
            .orderBy({ index: 'sid_ts' })
            .between([streamId, r.minval], [streamId, r.maxval], { index: 'sid_ts', leftBound: 'closed', rightBound: 'closed' })
            .changes({ includeInitial: true, includeStates: true })
            .toStream();
        var createInitialDataSortingStream = function (opts) {
            var buffer = [];
            var initializing = true;
            var log = opts.log;
            return through.obj(function (obj, enc, cb) {
                var self = this;
                if (obj === 'ready') {
                    log('ready state');
                    initializing = false;
                    buffer.sort(function (obj1, obj2) {
                        return obj1.ts - obj2.ts;
                    }).map(function (obj) {
                        log('sending sorted buffer object', obj);
                        self.push(obj);
                    });
                    this.push(obj);
                }
                else if (initializing) {
                    log('queuing to buffer', obj);
                    buffer.push(obj);
                }
                else {
                    log('pushing new object through', obj);
                    this.push(obj);
                }
                cb();
            });
        };
        dbStream
            .on('error', function (err) {
            self.log.error({ err }, 'changes stream error:', err.message);
        })
            .on('end', function () {
            log('DB STREAM ended');
        })
            .pipe(through.obj(function (obj, enc, cb) {
            if (obj.state) {
                this.push(obj.state);
            }
            if (obj.new_val) {
                this.push(obj.new_val);
            }
            cb();
        }))
            .pipe(createInitialDataSortingStream({ log }))
            .pipe(through.obj(function (obj, enc, cb) {
            if (obj === 'initializing') {
                log('initializing state');
            }
            else if (obj === 'ready') {
                if (notail) {
                    log('ready state & notail=true; closing stream');
                    this.end();
                }
            }
            else {
                this.push(obj);
            }
            cb();
        }))
            .pipe(through.obj(function (obj, enc, cb) {
            if (obj.data == null) {
                log('ending stream');
                this.end();
            }
            else {
                this.push(obj.data);
            }
            cb();
        }))
            .on('end', function () {
            log('transform stream ended, ending db changes stream');
            dbStream.close();
        })
            .pipe(stream);
        return stream;
    }
    saveStream(streamId, meta, opts, cb) {
        opts = opts || { replace: false };
        var conflict = opts.replace === true ? 'replace' : 'error';
        var stream = {
            id: streamId,
            meta: meta,
        };
        return rethink_1.rethink.r.table(this.config.metaTable).insert(stream, { conflict: conflict }).run(cb);
    }
    loadStream(streamId, cb) {
        return rethink_1.rethink.r.table(this.config.metaTable).get(streamId).run()
            .then(function (stream) {
            if (cb) {
                cb(stream && stream.meta);
            }
            return stream && stream.meta;
        }).catch(cb);
    }
    deleteStream(streamId, cb) {
        var newSidPostfix = '_' + +new Date();
        return rethink_1.rethink.r.table(this.config.logsTable)
            .filter({ sid: streamId })
            .update({
            sid: rethink_1.rethink.r.row('sid').add(newSidPostfix),
            origSid: rethink_1.rethink.r.row('sid'),
        })
            .run(cb);
    }
}
exports.RethinkStorage = RethinkStorage;
//# sourceMappingURL=rethink_storage.js.map