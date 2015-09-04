// This file is name __setup so that it gets loaded first
// and performs initialization for tests
require('co-mocha')

// effectivley silence the logging
delete process.env.GRAYLOG_HOST;
var logger = (require ('../lib/logger')).getLogger();
//logger._level = Number.POSITIVE_INFINITY;

// configure test env
process.env.DB_NAME = "test"
