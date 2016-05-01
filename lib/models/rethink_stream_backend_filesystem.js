'use strict';

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var through2 = require('through2');
var combine = require('bun');
var _ = require('lodash');

var createTailingStream = require('tailing-stream').createReadStream;

var RethinkStorage = require('./rethink_storage');

class FileSystemStorage extends RethinkStorage {

  /**
   * @param config - Config object
   * @param [config.metaTable="meta"] - Rethinkdb table to use for metadata. Defaults to "meta"
   * @param [config.dataDir="data"] - Path on file system for storing stream files. Defaults to "data"
   * @param [config.tailTimeout=30000] - Timeout for tailing streams. Defaults to 30 seconds.
   * @param [config.compressed=true] - Boolean value for transparrent on-disk compression
   */
  constructor(config) {
    config = _.defaults({}, config, {
      dataDir: 'data',
      tailTimeout: 30 * 1000,
      compress: true,
    });

    super(config);
  }

  makeFileName(streamId) {
    return `stream-${streamId}.log`;
  }

  makeStreamFilePath(streamId, makeFileName) {
    makeFileName = makeFileName || this.makeFileName;
    return path.join(this.config.dataDir, makeFileName(streamId));
  }

  createWriteStream(streamId) {
    var path = this.makeStreamFilePath(streamId);
    var fileStream = fs.createWriteStream(path);
    var streams = [fileStream];

    if (this.config.compress) {
      streams.unshift(zlib.createGzip());
    }

    var stream = combine(streams);
    return stream;
  }

  createReadStream(streamId, opts) {
    opts = opts || {};
    var notail = opts.notail;

    var path = this.makeStreamFilePath(streamId);
    var stream = through2();

    // a finished stream implies notail option
    this._isStreamFinished(path, (err, finished) => {
      if (err) {
        return stream.emit('error', err);
      }

      if (finished) {
        notail = true;
      }

      var dataStream;
      if (notail) {
        // with notail option, just read the file to the current end
        dataStream = fs.createReadStream(path);
      }
      else {
        // otherwise, tail the file
        // keep reading until we see an EOF, or a timeout is hit
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
    // "delete" the data for this stream
    // (not the metadata - that will get overwritten on save)

    var newSidPrefix = `deleted_${+new Date()}_`;

    var oldPath = this.makeStreamFilePath(streamId);
    var newPath = this.makeStreamFilePath(streamId, (sid) => newSidPrefix + this.makeFileName(sid));

    fs.rename(oldPath, newPath, (err) => {
      cb(err, newPath);
    });
  }

  /**
   * Checks to see if the stream has finished writing.
   * This is done by checking if the modified timestamp of the file is older than tailTimeout
   * @param String filePath - path to the file to check
   * @param Function cb - callback called with true or false, and an age in ms: function(err, boolean, {age})
   */
  _isStreamFinished(filePath, cb) {
    fs.stat(filePath, (err, stat) => {
      if (err) return cb(err);

      var age = +new Date() - stat.mtime;
      var finished = age > this.config.tailTimeout;

      cb(null, finished, {age: age});
    });
  }

}

module.exports = FileSystemStorage;

