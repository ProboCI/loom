"use strict";

// This file is name __setup so that it gets loaded first
// and performs initialization for tests
require("co-mocha");

process.env.NODE_ENV = "test";

// effectivley silence the logging
let logger = require("../lib/logger").getLogger();
logger._level = Number.POSITIVE_INFINITY;
