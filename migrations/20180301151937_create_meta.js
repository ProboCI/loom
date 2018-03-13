'use strict';

exports.up = function(knex, Promise) {
  return knex.schema.createTable('meta', function(table) {
    table.uuid('id').index().unique().notNullable();
    table.uuid('buildId').index().notNullable();
    table.uuid('taskId').index().notNullable();
    table.string('taskName');
    table.string('taskPlugin');
    table.index(['buildId', 'taskId']);
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('meta', function(table) {
    table.dropIndex(['buildId', 'taskId']);
  }).then(function() {
    return knex.schema.dropTable('meta');
  });
};
