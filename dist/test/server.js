"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const url = require("url");
const chai_1 = require("chai");
const server_1 = require("../lib/api/server");
const track = require("temp");
const knex_1 = require("../lib/knex");
chai_1.should();
process.env.NODE_ENV = "test";
const numChunks = 4;
const consumerWait = 2000;
let server = null;
const temp = track.track();
var testConf = {
    tokens: ["tik", "tok"],
    server: {
        host: "localhost",
        port: 3060
    },
    db: {
        host: "localhost",
        port: 28015,
        db: "test"
    },
    storage: {
        logsTable: "logs",
        metaTable: "meta",
        dataDir: temp.mkdirSync(),
        tailTimeout: "1.5s",
        compress: false
    }
};
function start(cb) {
    var loom = new server_1.Server(testConf);
    server = loom.server;
    loom.listen(0, "127.0.0.1", function () {
        server.log.info("%s listening at %s", server.name, server.url);
        return cb && cb();
    });
}
describe("Server:", function () {
    before("clear database", function* () {
        yield [knex_1.Database.knex(testConf.storage.metaTable).truncate()];
    });
    before("server starts", function (done) {
        start(done);
    });
    describe("producer", function () {
        var streamId;
        function startConsumer(id, cb) {
            console.log("starting consumer");
            var data = [];
            var consumerHandler = function (res) {
                console.log("CONSUMER STATUS: " + res.statusCode);
                console.log("CONSUMER HEADERS: " + JSON.stringify(res.headers));
                res.setEncoding("utf8");
                res.on("data", function (chunk) {
                    console.log("CONSUMER BODY: " + chunk);
                    data.push(chunk);
                });
                res.on("end", function () {
                    console.log("CONSUMER has read the full stream");
                    data
                        .join("")
                        .should.eql([
                        "chunks written 4",
                        "chunks written 3",
                        "chunks written 2",
                        "chunks written 1"
                    ].join(""));
                    setTimeout(cb, 1000);
                });
                res.on("error", function (err) {
                    console.log("CONSUMER error", err);
                    cb(err);
                });
            };
            var consumer = http.request({
                hostname: "localhost",
                port: url.parse(server.url).port,
                path: "/stream/" + id,
                headers: {
                    authorization: "bearer tik"
                }
            }, consumerHandler);
            consumer.end();
        }
        it("feeds data", function (done) {
            var producerHandler = function (res) {
                console.log("PRODUCER STATUS: " + res.statusCode);
                console.log("PRODUCER HEADERS: " + JSON.stringify(res.headers));
                res.setEncoding("utf8");
                res.on("data", function (chunk) {
                    console.log("PRODUCER BODY: " + chunk);
                });
                streamId = res.headers["x-stream-id"];
                setTimeout(function () {
                    startConsumer(streamId, done);
                }, consumerWait);
                console.log(`
curl -vi --no-buffer http://:::${server.address().port}/stream/${streamId}
`);
            };
            var producer = http.request({
                hostname: "localhost",
                port: url.parse(server.url).port,
                method: "post",
                path: "/stream",
                headers: {
                    authorization: "bearer tik",
                    connection: "keep-alive",
                    "x-stream-metadata": JSON.stringify({
                        buildId: "31aced17-67da-45fe-b447-f326f39f8a1b",
                        task: {
                            id: "58aa706b20c00000",
                            name: "AssetDownloader task",
                            plugin: "AssetDownloader"
                        }
                    })
                }
            }, producerHandler);
            var chunks = numChunks;
            var i = setInterval(function () {
                if (chunks > 0) {
                    producer.write("chunks written " + chunks);
                    console.log("producer sending data", chunks);
                    chunks--;
                }
                else {
                    clearInterval(i);
                    producer.end();
                }
            }, 1000);
        });
        it("has complete data", function (done) {
            startConsumer(streamId, done);
        });
    });
});
//# sourceMappingURL=server.js.map