"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const chai_1 = require("chai");
const through = require("through2");
const track = require("temp");
const postgre_storage_1 = require("../lib/models/postgre_storage");
const postgre_stream_backend_filesystem_1 = require("../lib/models/postgre_stream_backend_filesystem");
const knex_1 = require("../lib/knex");
chai_1.should();
process.env.NODE_ENV = "test";
const bl = require("bl");
const temp = track.track();
const tables = {
    logsTable: "logs",
    metaTable: "meta"
};
function isDescendant(B, A) {
    return B.prototype instanceof A || B === A;
}
function testStorage(Storage, storageConfig) {
    function read(streamid, storage) {
        return (storage || new Storage(storageConfig)).createReadStream(streamid);
    }
    function write(streamid, storage) {
        return (storage || new Storage(storageConfig)).createWriteStream(streamid);
    }
    describe("Storage: " + Storage.name, function () {
        before(function* reset() {
            if (isDescendant(Storage, postgre_storage_1.PostgreStorage)) {
                const config = {
                    db: process.env.DB_NAME || "test"
                };
                yield [knex_1.Database.knex(tables.metaTable).truncate()];
            }
        });
        describe("storage basics", function () {
            var streams = {
                "build-31aced17-67da-45fe-b447-f326f39f8a1b-task-58aa706b20c00000": {
                    "metadata": {
                        "buildId": "31aced17-67da-45fe-b447-f326f39f8a1b",
                        "task": { "id": "58aa706b20c00000", "name": "AssetDownloader task", "plugin": "AssetDownloader" }
                    }
                },
                "build-31aced17-67da-45fe-b447-f326f39f8a1b-task-58aa706b21400000": {
                    "metadata": {
                        "buildId": "31aced17-67da-45fe-b447-f326f39f8a1b",
                        "task": { "id": "58aa706b21400000", "name": "Probo site setup", "plugin": "LAMPApp" }
                    }
                },
            };
            it("creates streams", function* () {
                var storage = new Storage(storageConfig);
                for (var streamid in streams) {
                    yield storage.saveStream(streamid, streams[streamid]);
                }
            });
            it("loads streams", function* () {
                var storage = new Storage(storageConfig);
                var meta = yield storage.loadStream(Object.keys(streams)[0]);
                meta.metadata[0].should.eql(streams[Object.keys(streams)[0]].metadata);
            });
            it("stream 1 writes then reads", function (done) {
                var storage = new Storage(storageConfig);
                var list = bl();
                list.append("some data");
                list.append("more data");
                var streamid = "stream 1";
                var writer = write(streamid, storage);
                list.duplicate().pipe(writer);
                writer.on("finish", function () {
                    var reader = read(streamid, storage);
                    reader.pipe(bl(function (err, data) {
                        if (err)
                            return done(err);
                        data.should.eql(list.slice(), "reader on same storage as writer works");
                    }));
                    reader.on("end", function () {
                        read(streamid).pipe(bl(function (err, data) {
                            if (err)
                                return done(err);
                            data.should.eql(list.slice(), "reader on different storage than writer works");
                            done();
                        }));
                    });
                });
            });
            it("stream 2 writes and reads async", function (done) {
                var expected;
                var num = 10;
                var interval = 100;
                var producer = makeProducer(num, interval, function finishedProducing(data) {
                    expected = data;
                });
                producer.pipe(write("stream 2"));
                var immediateFinished = false;
                var delayedFinished = false;
                read("stream 2").pipe(bl(function (err, data) {
                    data.toString().should.eql(expected.toString());
                    immediateFinished = true;
                    if (delayedFinished && immediateFinished) {
                        done();
                    }
                }));
                setTimeout(function () {
                    read("stream 2").pipe(bl(function (err, data) {
                        data.toString().should.eql(expected.toString());
                        delayedFinished = true;
                        if (delayedFinished && immediateFinished) {
                            done();
                        }
                    }));
                }, num * interval / 2);
            });
        });
    });
}
testStorage(postgre_stream_backend_filesystem_1.FileSystemStorage, {
    dataDir: temp.mkdirSync(),
    tailTimeout: 1000,
    compress: false
});
function makeProducer(numpushes, interval, finished) {
    numpushes = numpushes || 2;
    interval = interval || 100;
    var producer = through();
    var data = [];
    var pushed = 0;
    var _i = setInterval(function () {
        if (pushed >= numpushes) {
            clearInterval(_i);
            producer.end();
        }
        else {
            var d = new Buffer("data " + ++pushed);
            data.push(d);
            producer.write(d);
        }
    }, interval);
    if (finished) {
        producer.on("finish", function () {
            if (finished) {
                finished(Buffer.concat(data));
            }
        });
    }
    return producer;
}
//# sourceMappingURL=models.js.map