var request = require('supertest');

var server = require('../lib/api/server');

describe("auth", function(){
  this.timeout(1000)

  before("start server", function (done){
    server.listen(done);
  })

  describe("all endpoints require auth", function(){
    it("GET /spy", function (done){
      request(server)
        .get('/spy')
        .expect('Content-Type', /json/)
        .expect(401, done)
    });

    it("GET /stream/id", function (done){
      request(server)
        .get('/stream/id')
        .expect('Content-Type', /json/)
        .expect(401, done)
    });

    it("POST /stream/id", function (done){
      request(server)
        .post('/stream/id')
        .expect('Content-Type', /json/)
        .expect(401, done)
    });

    it("POST /stream/", function (done){
      request(server)
        .post('/stream')
        .expect('Content-Type', /json/)
        .expect(401, done)
    });
  });
});
