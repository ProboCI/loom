'use strict';

var _ = require('lodash');
var log = require('./logger').getLogger('db');

const knexConfig = require('../knexfile');
let knexOverride = {};


process.env.NODE_ENV = process.env.NODE_ENV || 'production';

var knex = require('knex')(knexConfig[process.env.NODE_ENV]);


module.exports = knex;
