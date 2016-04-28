'use strict';

var fs = require('fs');
var path = require('path');

var _ = require('lodash');

var createTailingStream = require('tailing-stream').createReadStream;

var RethinkStorage = require('./rethink_storage');

class FileSystemStorage extends RethinkStorage {

  /**
   * @param config - Config object
   * @param [config.metaTable="meta"] - Rethinkdb table to use for metadata. Defaults to "meta"
   * @param [config.dataDir="data"] - Path on file system for storing stream files. Defaults to "data"
   * @param [config.tailTimeout=30000] - Timeout for tailing streams. Defaults to 30 seconds.
   */
  constructor(config) {
    config = _.defaults({}, config, {
      dataDir: 'data',
      tailTimeout: 30 * 1000,
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
    var stream = fs.createWriteStream(path);

    // TODO: do we need an EOF terminator marker?

    return stream;
  }

  createReadStream(streamId, opts) {
    opts = opts || {};
    var notail = opts.notail;

    var path = this.makeStreamFilePath(streamId);
    var stream;

    if (notail) {
      // with notail option, just read the file to the current end
      stream = fs.createReadStream(path);
    }
    else {
      // otherwise, tail the file
      // keep reading until we see an EOF, or a timeout is hit
      stream = createTailingStream(path, {
        timeout: this.config.tailTimeout,
      });
    }

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
}

module.exports = FileSystemStorage;

