'use strict';

var PostgreStorage = require('./postgre_storage');
var FileSystemStorage = require('./postgre_stream_backend_filesystem');

module.exports = {
  PostgreStorage,
  FileSystemStorage,
};
