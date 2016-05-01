'use strict';

/* eslint guard-for-in: 0 */

var fs = require('fs');

var bl = require('bl');
var temp = require('temp').track();
var FileSystemStorage = require('../lib/models').FileSystemStorage;

var config = {
  dataDir: temp.mkdirSync(),
  // keep tail timeout low so that we don't time out the test
  tailTimeout: 1000,
};

describe('FileSystemStorage', function() {
  before(function* reset() {
    // configure and reset DB
    var config = {
      db: process.env.DB_NAME || 'test',
    };
    var rethink = require('../lib/rethink');
    rethink.connect(config);
    yield [rethink.models.Logs.delete(), rethink.models.Meta.delete()];
  });

  it('constructs an instance properly', function() {
    var instance;
    instance = new FileSystemStorage();
    instance.config.should.containEql({
      metaTable: 'meta',
      dataDir: 'data',
    });

    var conf = {dataDir: 'custom_dir', metaTable: 'custom table'};
    instance = new FileSystemStorage(conf);

    // ensure config argument is not modified
    conf.should.eql({dataDir: 'custom_dir', metaTable: 'custom table'});

    instance.config.should.containEql({
      metaTable: 'custom table',
      dataDir: 'custom_dir',
    });
  });

  it('generates file names properly', function() {
    var instance = new FileSystemStorage(config);

    instance.makeFileName('stream-x-1').should.eql('stream-stream-x-1.log');
    instance.makeStreamFilePath('stream-x-2').should.eql(`${config.dataDir}/stream-stream-x-2.log`);
  });

  it('writes to a file', function(done) {
    var instance = new FileSystemStorage(config);

    var writeStream = instance.createWriteStream('xyz');
    writeStream.write('line 1\n');
    writeStream.write('line 2\n');
    writeStream.end('this is the end\n');

    var filePath = `${config.dataDir}/stream-xyz.log`;
    writeStream.on('finish', () => {
      fs.readFileSync(filePath).toString()
        .should.eql(`line 1
line 2
this is the end
`);

      // make sure we properly detect that the stream ended
      instance._isStreamFinished(filePath, (err, finished)=>{
        finished.should.eql(false);

        // now make the tailTimeout value really small so that the file looks modified
        // after waiting for a bit
        instance.config.tailTimeout = 10;

        setTimeout(()=>{
          instance._isStreamFinished(filePath, (err, finished, data)=>{
            finished.should.eql(true);

            done();
          });
        }, instance.config.tailTimeout + 50);
      });
    });
  });

  it('reads from a file (notail - reads to EOF)', function(done) {
    var instance = new FileSystemStorage(config);

    var fileContents = `write test line 1
write test line 2
write test end
`;

    fs.writeFileSync(`${config.dataDir}/stream-abc.log`, fileContents);

    var reader = instance.createReadStream('abc', {notail: true});

    reader.pipe(bl(function(err, data) {
      if (err) return done(err);
      data.toString().should.eql(fileContents);
    }));

    reader.on('end', () => {
      done();
    });
  });

  it('reads from a file (default, tails current stream waiting for more data)', function(done) {
    var instance = new FileSystemStorage(config);

    var fileContents = `write test line 1
write test line 2
write test end
`;

    fs.writeFileSync(`${config.dataDir}/stream-tail.log`, fileContents);
    setTimeout(() => fs.appendFile(`${config.dataDir}/stream-tail.log`, 'new content'), 200);

    var reader = instance.createReadStream('tail');

    var start = +new Date();

    reader.pipe(bl(function(err, data) {
      if (err) return done(err);
      data.toString().should.eql(fileContents + 'new content');
    }));

    reader.on('end', () => {
      var end = +new Date();
      (end - start).should.approximately(1000 + 200, 10);

      done();
    });
  });

  it('reads from a file (default, old stream not waiting for new data)', function(done) {
    var instance = new FileSystemStorage(config);
    // reset tailTimeout to a small value to make file appear old
    instance.config.tailTimeout = 50;

    var streamId = 'tail-old';

    var fileContents = `write test line 1
write test line 2
write test end
`;

    fs.writeFileSync(`${config.dataDir}/stream-${streamId}.log`, fileContents);

    // wait a bit for the file mtime to age
    setTimeout(() => {
      var reader = instance.createReadStream(streamId);

      var start = +new Date();

      reader.pipe(bl(function(err, data) {
        if (err) return done(err);
        data.toString().should.eql(fileContents);
      }));

      reader.on('end', () => {
        var end = +new Date();
        // make sure that read returned immediately for old file, not waiting for tailTimeout
        (end - start).should.approximately(0, 10);

        done();
      });
    }, instance.config.tailTimeout + 10);
  });

  it('deletes files', function(done) {
    var instance = new FileSystemStorage(config);

    fs.writeFileSync(`${config.dataDir}/stream-deleteme.log`, 'to be deleted');

    instance.deleteStream('deleteme', function(err, renamed) {
      if (err) done(err);

      // make sure orignal file exists but is renamed
      (function() {
        fs.statSync(`${config.dataDir}/stream-deleteme.log`);
      }).should.throw(/ENOENT: no such file or directory/);

      // does not throw if exists
      fs.statSync(renamed);

      renamed.should.match(new RegExp(`${config.dataDir}/deleted_[0-9]+_stream-deleteme.log`));

      done();
    });
  });

});
