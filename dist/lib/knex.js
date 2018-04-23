"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client = require("knex");
const knexConfig = require(process.env.PWD + "/knexfile");
process.env.NODE_ENV = process.env.NODE_ENV || "production";
var Database;
(function (Database) {
    Database.knex = client(knexConfig[process.env.NODE_ENV]);
})(Database = exports.Database || (exports.Database = {}));
//# sourceMappingURL=knex.js.map