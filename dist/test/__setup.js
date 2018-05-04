"use strict";
require("co-mocha");
process.env.NODE_ENV = "test";
let logger = require("../lib/logger").getLogger();
logger._level = Number.POSITIVE_INFINITY;
//# sourceMappingURL=__setup.js.map