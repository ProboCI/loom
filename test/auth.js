'use strict';

var request = require('supertest');

var Server = require('../lib/api/server');
var server = null;

describe('auth', function() {
  this.timeout(1000);

  before('start server', function(done) {
    var testConf = {
      tokens: ['tik', 'tok'],
      server: {
        host: 'localhost',
        port: 3060,
      },
      db: {
        host: 'localhost',
        port: 28015,
        db: 'test',
        logsTable: 'logs',
        metaTable: 'meta',
      },
    };
    var loom = new Server(testConf);
    loom.listen(done);
    // Get a reference to the restify server.
    server = loom.server;
  });

  describe('all endpoints require auth', function() {
    it('GET /spy', function(done) {
      request(server)
        .get('/spy')
        .expect('Content-Type', /json/)
        .expect(401, done);
    });

    it('GET /stream/id', function(done) {
      request(server)
        .get('/stream/id')
        .expect('Content-Type', /json/)
        .expect(401, done);
    });

    it('POST /stream/id', function(done) {
      request(server)
        .post('/stream/id')
        .expect('Content-Type', /json/)
        .expect(401, done);
    });

    it('POST /stream/', function(done) {
      request(server)
        .post('/stream')
        .expect('Content-Type', /json/)
        .expect(401, done);
    });
  });
});
