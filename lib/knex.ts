"use strict";

import * as _ from "lodash";

const knexConfig = require("../knexfile");

process.env.NODE_ENV = process.env.NODE_ENV || "production";

var knex = require("knex")(knexConfig[process.env.NODE_ENV]);

module.exports = knex;
