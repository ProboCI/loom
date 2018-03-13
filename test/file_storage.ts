"use strict";

/* eslint guard-for-in: 0 */
import * as fs from "fs";
import * as zlib from "zlib";
import * as _ from "lodash";
import { assert } from "chai"; // Using Assert style
import { expect } from "chai"; // Using Expect style
import { should } from "chai"; // Using Should style
import "mocha";
import * as track from "temp";
import { FileSystemStorage } from "../lib/models/rethink_stream_backend_filesystem";
import { rethink } from "../lib/rethink";

should();

// Set debug level
process.env.NODE_ENV = "test";

const bl = require("bl");

let temp = track.track();

const config = {
  dataDir: temp.mkdirSync(),
  db: process.env.DB_NAME || "test",
  // keep tail timeout low so that we don't time out the test
  tailTimeout: 1000,
  compress: false
};

describe("FileSystemStorage", function() {
  before(function* reset() {
    // configure and reset DB
    let config = {
      db: process.env.DB_NAME || "test"
    };
    rethink.connect(config);
    yield [rethink.models.Logs.delete(), rethink.models.Meta.delete()];
  });

  it("constructs an instance properly", function() {
    let instance;
    instance = new FileSystemStorage();
    instance.config.should.contain({
      metaTable: "meta",
      dataDir: "data"
    });

    // there is no reason to do this test in typescript
    /*
    let conf = { dataDir: "custom_dir", metaTable: "custom table" };
    instance = new FileSystemStorage(conf);

    // ensure config argument is not modified
    // This never happend
    //conf.should.eql({ dataDir: 'custom_dir', metaTable: 'custom table' });

    instance.config.should.containEql({
      metaTable: "custom table",
      dataDir: "custom_dir"
    });
    */
  });

  it("generates file names properly", function() {
    var instance = new FileSystemStorage(config);

    instance.makeFileName("stream-x-1").should.eql("stream-stream-x-1.log");
    instance
      .makeStreamFilePath("stream-x-2")
      .should.eql(`${config.dataDir}/stream-stream-x-2.log`);
  });

  it("writes to a file", function(done) {
    var instance = new FileSystemStorage(config);

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

      // make sure we properly detect that the stream ended
      instance._isStreamFinished(filePath, (err, finished) => {
        finished.should.eql(false);

        // now make the tailTimeout value really small so that the file looks modified
        // after waiting for a bit
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

  it("reads from a file (notail, reads to EOF)", function(done) {
    var instance = new FileSystemStorage(config);

    var fileContents = `write test line 1
write test line 2
write test end
`;

    fs.writeFileSync(`${config.dataDir}/stream-abc.log`, fileContents);

    var reader = instance.createReadStream("abc", { notail: true });

    reader.pipe(
      bl(function(err, data) {
        if (err) return done(err);
        data.toString().should.eql(fileContents);
      })
    );

    reader.on("end", () => {
      done();
    });
  });

  it("reads from a file (default, tails current stream waiting for more data)", function(done) {
    var instance = new FileSystemStorage(config);

    var fileContents = `write test line 1
write test line 2
write test end
`;

    fs.writeFileSync(`${config.dataDir}/stream-tail.log`, fileContents);
    setTimeout(
      () =>
        fs.appendFile(
          `${config.dataDir}/stream-tail.log`,
          "new content",
          err => {
            if (err) throw err;
          }
        ),
      200
    );

    var reader = instance.createReadStream("tail");

    var start = +new Date();

    reader.pipe(
      bl(function(err, data) {
        if (err) return done(err);
        data.toString().should.eql(fileContents + "new content");
      })
    );

    reader.on("end", () => {
      var end = +new Date();
      (end - start).should.approximately(1000 + 200, 20);

      done();
    });
  });

  it("reads from a file (default, old stream not waiting for new data)", function(done) {
    var instance = new FileSystemStorage(config);
    // reset tailTimeout to a small value to make file appear old
    instance.config.tailTimeout = 50;

    var streamId = "tail-old";

    var fileContents = `write test line 1
write test line 2
write test end
`;

    fs.writeFileSync(`${config.dataDir}/stream-${streamId}.log`, fileContents);

    // wait a bit for the file mtime to age
    setTimeout(() => {
      var reader = instance.createReadStream(streamId);

      var start = +new Date();

      reader.pipe(
        bl(function(err, data) {
          if (err) return done(err);
          data.toString().should.eql(fileContents);
        })
      );

      reader.on("end", () => {
        var end = +new Date();
        // make sure that read returned immediately for old file, not waiting for tailTimeout
        (end - start).should.approximately(0, 20);

        done();
      });
    }, instance.config.tailTimeout + 10);
  });

  it("writes to/from a compressed file", function(done) {
    var instance = new FileSystemStorage(
      _.assign({}, config, {
        compress: true
      })
    );

    var writeStream = instance.createWriteStream("compressed");
    writeStream.write("line 1\n");
    writeStream.write("line 2\n");
    writeStream.end("this is the end\n");

    var filePath = `${config.dataDir}/stream-compressed.log`;
    writeStream.on("finish", () => {
      // in a set timeout to give fs time to flush to disk
      setTimeout(() => {
        var content = fs.readFileSync(filePath);

        // correct contents for normal gzip stream:
        // content.toString('base64').should.eql('H4sIAAAAAAAAA8vJzEtVMOTKAVFGXCUZmcUKQFSSkaqQmpfCBQAhH9pCHgAAAA==');

        // correct contents for a SYNC_FLUSH gzip stream:
        content
          .toString("base64")
          .should.eql(
            "H4sIAAAAAAAAA8rJzEtVMOQCAAAA///KAVFGXAAAAAD//yrJyCxWAKKSjFSF1LwULgAAAAD//wMAIR/aQh4AAAA="
          );

        zlib.gunzipSync(content).toString().should.eql(`line 1
line 2
this is the end
`);

        instance.createReadStream("compressed").pipe(
          bl(function(err, data) {
            if (err) return done(err);
            data.toString().should.eql(`line 1
line 2
this is the end
`);

            done();
          })
        );
      }, 10);
    });
  });

  it("deletes files", function(done) {
    var instance = new FileSystemStorage(config);

    fs.writeFileSync(`${config.dataDir}/stream-deleteme.log`, "to be deleted");

    instance.deleteStream("deleteme", function(err, renamed) {
      if (err) done(err);

      // make sure orignal file exists but is renamed
      (function() {
        fs.statSync(`${config.dataDir}/stream-deleteme.log`);
      }.should.throw(/ENOENT: no such file or directory/));

      // does not throw if exists
      fs.statSync(renamed);

      renamed.should.match(
        new RegExp(`${config.dataDir}/deleted_[0-9]+_stream-deleteme.log`)
      );

      done();
    });
  });
});
