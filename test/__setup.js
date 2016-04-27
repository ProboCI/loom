'use strict';

// This file is name __setup so that it gets loaded first
// and performs initialization for tests
require('co-mocha');

// effectivley silence the logging
var logger = (require('../lib/logger')).getLogger();
logger._level = Number.POSITIVE_INFINITY;
