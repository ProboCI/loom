"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
require("chai");
const request = require("supertest");
const server_1 = require("../lib/api/server");
require("../typings/TConfig");
process.env.NODE_ENV = "test";
let server = null;
describe("auth", function () {
    this.timeout(5000);
    before("start server", function (done) {
        var testConf = {
            tokens: ["tik", "tok"],
            server: {
                host: "localhost",
                port: 3060
            },
            db: {
                host: "localhost",
                port: 28015,
                db: "test",
                logsTable: "logs",
                metaTable: "meta"
            }
        };
        var loom = new server_1.Server(testConf);
        loom.listen(done);
        server = loom.server;
    });
    describe("all endpoints require auth", function () {
        it("GET /spy", function (done) {
            request(server)
                .get("/spy")
                .expect("Content-Type", /json/)
                .expect(401, done);
        });
        it("GET /stream/id", function (done) {
            request(server)
                .get("/stream/id")
                .expect("Content-Type", /json/)
                .expect(401, done);
        });
        it("POST /stream/id", function (done) {
            request(server)
                .post("/stream/id")
                .expect("Content-Type", /json/)
                .expect(401, done);
        });
        it("POST /stream/", function (done) {
            request(server)
                .post("/stream")
                .expect("Content-Type", /json/)
                .expect(401, done);
        });
    });
});
//# sourceMappingURL=auth.js.map