'use strict';

exports.up = function(knex, Promise) {
  return knex.schema.createTable('meta', function(table) {
    table
      .uuid('id')
      .index()
      .unique()
      .notNullable();
    table
      .uuid('buildId')
      .index()
      .notNullable();
    table
      .string('taskId')
      .index()
      .notNullable();
    table.json('task');
    table
      .boolean('deleted')
      .defaultTo('false');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['buildId', 'taskId']);
  });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .table('meta', function(table) {
      table.dropIndex(['buildId', 'taskId']);
    })
    .then(function() {
      return knex.schema.dropTable('meta');
    });
};
