'use strict';

var through = require('through2');

var metaStore = {};

class ArrayStreamStorage {
  constructor() {
    this._store = metaStore;
  }

  createWriteStream(streamId) {
    var conf = metaStore[streamId];
    if (!conf) {
      return null;
    }

    var writeStream = through(function(data, enc, cb) {
      if (!conf.buffering) {
        this.push(data);
      }

      conf.buffer.push(data);
      cb();
    }, function flush(cb) {
      // write terminator
      this.push(null);
      conf.buffer.push(null);
      cb();
    });

    writeStream.pipe(conf.stream);

    return writeStream;
  }

  createReadStream(streamId) {
    var conf = metaStore[streamId];
    if (!conf) {
      return null;
    }

    var readStream = through();
    for (let buffer of conf.buffer) {
      readStream.push(buffer);
    }

    conf.buffering = false;
    conf.stream.pipe(readStream);

    return readStream
      .pipe(through(function(data, enc, cb) {
        if (data === null) {
          this.end();
          cb();
        }
        else {
          cb(null, data);
        }
      }));
  }

  saveStream(streamId, meta, opts, cb) {
    if (typeof opts == 'function') {
      cb = opts;
      opts = false;
    }
    opts = opts || {};

    var conf = {
      meta: meta,
      stream: through(),
      buffer: [],

      // until we have a reader and the stream is being consumed, only buffer values,
      // don't add them into the stream or we'll get duplicates
      buffering: true,
    };
    metaStore[streamId] = conf;

    if (cb) { cb(null, meta); }
    return Promise.resolve(meta);
  }

  loadStream(streamId, cb) {
    var conf = metaStore[streamId];
    var ret = null;

    // console.log(JSON.stringify({metaStore}, null, 2))

    if (conf) {
      ret = conf.meta;
      this._array_buffer = conf.buffer;
    }

    // console.log(`found meta for id ${streamId}:`, meta)
    // console.log("found metadata:", ret)

    if (cb) { cb(null, ret); }
    return Promise.resolve(ret);
  }

  deleteStream(streamId, cb) {
    // "delete" the data for this stream
    delete metaStore[streamId];

    if (cb) { cb(null, true); }
    return Promise.resolve(true);
  }
}

module.exports = ArrayStreamStorage;
