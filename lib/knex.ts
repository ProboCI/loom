"use strict";

import * as _ from "lodash";
import * as client from "knex";

const knexConfig = require("../knexfile");

process.env.NODE_ENV = process.env.NODE_ENV || "production";
export module Database {
    export var knex: client = client(knexConfig[process.env.NODE_ENV]);
}
