'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const co_1 = require("co");
const rethink_stream_backend_filesystem_1 = require("../../models/rethink_stream_backend_filesystem");
const logger = require("../../logger");
const Storage = rethink_stream_backend_filesystem_1.FileSystemStorage;
const log = logger.getLogger('').child({ component: 'server' });
function handleError(res, err, next) {
    res.status(err.status || 500);
    res.json({ error: err.message });
    next();
}
var activeStreams = (function () {
    var active = new (require('events').EventEmitter)();
    active.streams = {};
    active.on('added', function (id) {
        log.info('Spy Stream added: ' + id);
        active.streams[id] = true;
    });
    active.on('removed', function (id) {
        log.info('Spy Stream removed: ' + id);
        delete active.streams[id];
    });
    var colorIndex = 0;
    active.get_color = function (obj) {
        var colors = [
            'black', 'red', 'green', 'yellow', 'blue', 'gray', 'magenta', 'cyan', 'white',
        ];
        return colors[colorIndex++ % colors.length];
    };
    return active;
})();
var streams = {
    create: function (req, res, next) {
        var metadata = req.header('x-stream-metadata');
        try {
            if (metadata) {
                metadata = JSON.parse(metadata);
            }
        }
        catch (e) {
            req.log.warn({ err: e, metadata }, 'Failed to parse metadata header as JSON');
        }
        co_1.default(function* () {
            var id = req.params.id || 'loom-' + +new Date();
            req.log = req.log.child({ sid: id }, true);
            var storage = new Storage(req.loomConfig.storage);
            var stream = yield storage.loadStream(id);
            if (stream) {
                if (req.query.force !== 'true') {
                    var msg = `The stream with ID ${id} already exists.`;
                    req.log.error(msg);
                    res.json({ error: msg + ' Specify force=true query param to override.' });
                    return next();
                }
                else {
                    req.log.info('deleting stream...');
                    yield storage.deleteStream(id);
                    req.log.info('stream deleted');
                    res.header('x-stream-replaced', true);
                }
            }
            storage.saveStream(id, {
                metadata: metadata,
            }, {
                replace: req.query.force === 'true',
            }).then(function () {
                var error;
                var writer = storage.createWriteStream(id);
                writer.on('error', (err) => {
                    req.log.error({ err }, 'Failed to create writer stream for', id);
                    error = err;
                    handleError(res, err, next);
                });
                setTimeout(function () {
                    if (!error) {
                        req.pipe(writer);
                        req.log.info({ metadata }, 'created stream');
                        res.writeHead(201, {
                            'x-stream-id': id,
                        });
                        res.flushHeaders();
                    }
                }, 10);
                activeStreams.emit('added', id);
                req.on('end', function () {
                    req.log.info('producer stream ended');
                    res.end();
                    activeStreams.emit('removed', id);
                    if (next) {
                        next();
                    }
                });
            });
        }).catch(next);
    },
    get: function (req, res, next) {
        var streamId = req.params.id;
        var notail = 'notail' in req.query;
        req.log = req.log.child({ sid: streamId }, true);
        req.log.info({ opts: { notail: notail } }, 'got a consumer request');
        var storage = new Storage(req.loomConfig.storage);
        storage.loadStream(streamId).then(function (stream) {
            if (!stream) {
                res.json({ error: `The stream with ID ${streamId} does not exist` });
                return next();
            }
            var reader = storage.createReadStream(streamId, { notail });
            res.header('x-stream-metadata', JSON.stringify(stream.metadata));
            reader.on('error', (err) => {
                req.log.error({ err }, 'Failed to create read stream for', streamId);
                if (err.code === 'ENOENT') {
                    err.status = 404;
                }
                handleError(res, err, next);
            });
            reader.pipe(res);
            res.on('finish', function () {
                req.log.info('consumer stream ended');
                next();
            });
        }).catch(function (err) {
            req.log.error({ err }, 'Could not fetch stream');
            handleError(res, err, next);
        });
    },
    spy: function (req, res, next) {
        var colors = require('colors');
        colors.supportsColor = colors.enabled = true;
        function colorize(str, color) {
            if (req.query.color !== void 0) {
                return colors[color](str).replace(/(^.*):/, '$&'.bold);
            }
            return str;
        }
        var through2 = require('through2');
        var storage = new Storage(req.loomConfig.storage);
        var lastStreamId;
        function showStream(id) {
            req.log.info('SHOW STREAM: ' + id);
            var color = activeStreams.get_color();
            res.write(colorize(`START: ${id}\n`, color));
            var readStream = storage.createReadStream(id);
            readStream.on('error', (err) => {
                req.log.error({ err }, 'Failed to create spy read stream for', id);
            });
            readStream.pipe(through2(function (chunk, enc, cb) {
                var header = `${id}:\n`;
                if (lastStreamId === id) {
                    header = '';
                }
                lastStreamId = id;
                cb(null, colorize(`${header}${chunk.toString()}`, color));
            })).pipe(res, { end: false });
            readStream.on('end', function flush(cb) {
                req.log.info('STREAM ENDED: ' + id);
                res.write(colorize(`END: ${id}\n`, color));
            });
            activeStreams.on('removed', function (removedId) {
                if (id === removedId) {
                    setTimeout(() => readStream.end(), 200);
                }
            });
        }
        Object.keys(activeStreams.streams).forEach(showStream);
        activeStreams.on('added', showStream);
    },
};
exports.controllers = { streams };
//# sourceMappingURL=index.js.map