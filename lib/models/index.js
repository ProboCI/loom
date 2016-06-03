'use strict';

var ArrayStreamStorage = require('./array_stream_storage');
var RethinkStorage = require('./rethink_storage');
var FileSystemStorage = require('./rethink_stream_backend_filesystem');

module.exports = {
  ArrayStreamStorage,
  RethinkStorage,
  FileSystemStorage,
};
