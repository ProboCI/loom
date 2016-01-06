// This file is name __setup so that it gets loaded first
// and performs initialization for tests
require('co-mocha')

// effectivley silence the logging
var logger = (require ('../lib/logger')).getLogger();
//logger._level = Number.POSITIVE_INFINITY;

var conf = {
  "tokens": ["tik", "tok"],
  "server": {
    "host": "localhost",
    "port": 3060
  },
  "db": {
    "host": "localhost",
    "port": 28015,
    "db": "test",
    "logsTable": "logs",
    "metaTable": "meta"
  },
}

// use a fixed config for tests, do not rely on defaults.yaml
require('../lib/config').set(conf);
