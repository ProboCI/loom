'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const Path = require("path");
const zlib = require("zlib");
const ms_1 = require("ms");
const through2 = require("through2");
const bun_1 = require("bun");
const _ = require("lodash");
const tstream = require("tailing-stream");
const rethink_storage_1 = require("./rethink_storage");
const createTailingStream = tstream.createReadStream;
class FileSystemStorage extends rethink_storage_1.RethinkStorage {
    constructor(config) {
        config = _.defaults({}, config, {
            dataDir: 'data',
            tailTimeout: 30 * 1000,
            compress: true,
        });
        config.tailTimeout = ms_1.default(config.tailTimeout + '');
        super(config);
        this.config = config;
    }
    makeFileName(streamId) {
        return `stream-${streamId}.log`;
    }
    makeStreamFilePath(streamId, makeFileName = null) {
        makeFileName = makeFileName || this.makeFileName;
        return Path.join(this.config.dataDir, makeFileName(streamId));
    }
    createWriteStream(streamId) {
        const path = this.makeStreamFilePath(streamId);
        const fileStream = fs.createWriteStream(path);
        if (this.config.compress) {
            const zipStream = zlib.createGzip({ flush: zlib.Z_SYNC_FLUSH });
            const streams = [zipStream, fileStream];
            const stream = bun_1.default(streams);
            return stream;
        }
        return bun_1.default([fileStream]);
    }
    createReadStream(streamId, opts = {}) {
        let notail = opts.notail;
        const path = this.makeStreamFilePath(streamId);
        const stream = through2();
        this._isStreamFinished(path, (err, finished, info) => {
            if (err) {
                return stream.emit('error', err);
            }
            if (finished) {
                notail = true;
            }
            var dataStream;
            if (notail) {
                dataStream = fs.createReadStream(path);
            }
            else {
                dataStream = createTailingStream(path, {
                    timeout: this.config.tailTimeout,
                });
            }
            if (this.config.compress) {
                dataStream = dataStream.pipe(zlib.createGunzip());
            }
            dataStream.pipe(stream);
        });
        return stream;
    }
    deleteStream(streamId, cb) {
        var newSidPrefix = `deleted_${+new Date()}_`;
        var oldPath = this.makeStreamFilePath(streamId);
        var newPath = this.makeStreamFilePath(streamId, (sid) => newSidPrefix + this.makeFileName(sid));
        fs.rename(oldPath, newPath, (err) => {
            if (cb) {
                cb(err, newPath);
            }
        });
        return Promise.resolve(newPath);
    }
    _isStreamFinished(filePath, cb) {
        fs.stat(filePath, (err, stat) => {
            if (err)
                return cb(err);
            const age = new Date().valueOf() - stat.mtime.valueOf();
            const finished = age > this.config.tailTimeout;
            cb(null, finished, { age: age });
        });
    }
}
exports.FileSystemStorage = FileSystemStorage;
//# sourceMappingURL=rethink_stream_backend_filesystem.js.map