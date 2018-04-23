"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const zlib = require("zlib");
const _ = require("lodash");
const chai_1 = require("chai");
require("mocha");
const track = require("temp");
const postgre_stream_backend_filesystem_1 = require("../lib/models/postgre_stream_backend_filesystem");
const knex_1 = require("../lib/knex");
chai_1.should();
process.env.NODE_ENV = "test";
const bl = require("bl");
let temp = track.track();
const config = {
    dataDir: temp.mkdirSync(),
    db: process.env.DB_NAME || "test",
    tailTimeout: 1000,
    compress: false
};
describe("FileSystemStorage", function () {
    before(function* reset() {
        let config = {
            db: process.env.DB_NAME || "test",
            tables: {
                logsTable: "logs",
                metaTable: "meta"
            }
        };
        yield [knex_1.Database.knex(config.tables.metaTable).truncate()];
    });
    it("constructs an instance properly", function () {
        let instance;
        instance = new postgre_stream_backend_filesystem_1.FileSystemStorage();
        instance.config.should.contain({
            metaTable: "meta",
            dataDir: "data"
        });
    });
    it("generates file names properly", function () {
        var instance = new postgre_stream_backend_filesystem_1.FileSystemStorage(config);
        instance.makeFileName("stream-x-1").should.eql("stream-stream-x-1.log");
        instance
            .makeStreamFilePath("stream-x-2")
            .should.eql(`${config.dataDir}/stream-stream-x-2.log`);
    });
    it("writes to a file", function (done) {
        var instance = new postgre_stream_backend_filesystem_1.FileSystemStorage(config);
        var writeStream = instance.createWriteStream("xyz");
        writeStream.write("line 1\n");
        writeStream.write("line 2\n");
        writeStream.end("this is the end\n");
        var filePath = `${config.dataDir}/stream-xyz.log`;
        writeStream.on("finish", () => {
            fs.readFileSync(filePath).toString().should.eql(`line 1
line 2
this is the end
`);
            instance._isStreamFinished(filePath, (err, finished) => {
                finished.should.eql(false);
                instance.config.tailTimeout = 10;
                setTimeout(() => {
                    instance._isStreamFinished(filePath, (err, finished, data) => {
                        finished.should.eql(true);
                        done();
                    });
                }, instance.config.tailTimeout + 50);
            });
        });
    });
    it("reads from a file (notail, reads to EOF)", function (done) {
        var instance = new postgre_stream_backend_filesystem_1.FileSystemStorage(config);
        var fileContents = `write test line 1
write test line 2
write test end
`;
        fs.writeFileSync(`${config.dataDir}/stream-abc.log`, fileContents);
        var reader = instance.createReadStream("abc", { notail: true });
        reader.pipe(bl(function (err, data) {
            if (err)
                return done(err);
            data.toString().should.eql(fileContents);
        }));
        reader.on("end", () => {
            done();
        });
    });
    it("reads from a file (default, tails current stream waiting for more data)", function (done) {
        var instance = new postgre_stream_backend_filesystem_1.FileSystemStorage(config);
        var fileContents = `write test line 1
write test line 2
write test end
`;
        fs.writeFileSync(`${config.dataDir}/stream-tail.log`, fileContents);
        setTimeout(() => fs.appendFile(`${config.dataDir}/stream-tail.log`, "new content", err => {
            if (err)
                throw err;
        }), 200);
        var reader = instance.createReadStream("tail");
        var start = +new Date();
        reader.pipe(bl(function (err, data) {
            if (err)
                return done(err);
            data.toString().should.eql(fileContents + "new content");
        }));
        reader.on("end", () => {
            var end = +new Date();
            (end - start).should.approximately(1000 + 200, 20);
            done();
        });
    });
    it("reads from a file (default, old stream not waiting for new data)", function (done) {
        var instance = new postgre_stream_backend_filesystem_1.FileSystemStorage(config);
        instance.config.tailTimeout = 50;
        var streamId = "tail-old";
        var fileContents = `write test line 1
write test line 2
write test end
`;
        fs.writeFileSync(`${config.dataDir}/stream-${streamId}.log`, fileContents);
        setTimeout(() => {
            var reader = instance.createReadStream(streamId);
            var start = +new Date();
            reader.pipe(bl(function (err, data) {
                if (err)
                    return done(err);
                data.toString().should.eql(fileContents);
            }));
            reader.on("end", () => {
                var end = +new Date();
                (end - start).should.approximately(0, 20);
                done();
            });
        }, instance.config.tailTimeout + 10);
    });
    it("writes to/from a compressed file", function (done) {
        var instance = new postgre_stream_backend_filesystem_1.FileSystemStorage(_.assign({}, config, {
            compress: true
        }));
        var writeStream = instance.createWriteStream("compressed");
        writeStream.write("line 1\n");
        writeStream.write("line 2\n");
        writeStream.end("this is the end\n");
        var filePath = `${config.dataDir}/stream-compressed.log`;
        writeStream.on("finish", () => {
            setTimeout(() => {
                var content = fs.readFileSync(filePath);
                content
                    .toString("base64")
                    .should.eql("H4sIAAAAAAAAA8rJzEtVMOQCAAAA///KAVFGXAAAAAD//yrJyCxWAKKSjFSF1LwULgAAAAD//wMAIR/aQh4AAAA=");
                zlib.gunzipSync(content).toString().should.eql(`line 1
line 2
this is the end
`);
                instance.createReadStream("compressed").pipe(bl(function (err, data) {
                    if (err)
                        return done(err);
                    data.toString().should.eql(`line 1
line 2
this is the end
`);
                    done();
                }));
            }, 10);
        });
    });
    it("deletes files", function (done) {
        var instance = new postgre_stream_backend_filesystem_1.FileSystemStorage(config);
        fs.writeFileSync(`${config.dataDir}/stream-deleteme.log`, "to be deleted");
        instance.deleteStream("deleteme", function (err, renamed) {
            if (err)
                done(err);
            (function () {
                fs.statSync(`${config.dataDir}/stream-deleteme.log`);
            }.should.throw(/ENOENT: no such file or directory/));
            fs.statSync(renamed);
            renamed.should.match(new RegExp(`${config.dataDir}/deleted_[0-9]+_stream-deleteme.log`));
            done();
        });
    });
});
//# sourceMappingURL=file_storage.js.map