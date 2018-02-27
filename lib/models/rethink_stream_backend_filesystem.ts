'use strict';

import * as fs from 'fs';
import * as Path from 'path';
import * as zlib from 'zlib';
import * as ms from 'ms';
import * as through2 from 'through2';
import * as combine from 'bun';
import * as _ from 'lodash';
import * as tstream from 'tailing-stream';
import { RethinkStorage } from './rethink_storage';

const createTailingStream = tstream.createReadStream;

type TConfig = {
  metaTable?: string,
  logsTable?: string,
  dataDir: string,
  tailTimeout?: number | string,
  compress?: boolean
}

type Tcb = (err: any, finished?: boolean, age?: {age: number}) => void;


export class FileSystemStorage extends RethinkStorage {
  
  /**
   * @param config - Config object
   * @param [config.metaTable="meta"] - Rethinkdb table to use for metadata. Defaults to "meta"
   * @param [config.dataDir="data"] - Path on file system for storing stream files. Defaults to "data"
   * @param [config.tailTimeout=30000] - Timeout for tailing streams. Defaults to 30 seconds.
   * @param [config.compress=true] - Boolean value for transparrent on-disk compression
   */
  constructor(config?: TConfig) {
    config = _.defaults({}, config, {
      dataDir: 'data',
      tailTimeout: 30 * 1000,
      compress: true,
    });

    // convert a string representation (e.g., 30000, 30s) to a number
    config.tailTimeout = ms(config.tailTimeout + '');

    super(config);

    this.config = config;
    // this.log.debug({config}, 'FileSystemStorage config');
  }


  makeFileName(streamId: string): string {
    return `stream-${streamId}.log`;
  }


  makeStreamFilePath(streamId: string, makeFileName = null): string {
    makeFileName = makeFileName || this.makeFileName;
    return Path.join(this.config.dataDir, makeFileName(streamId));
  }


  createWriteStream(streamId: string): any {
    const path = this.makeStreamFilePath(streamId);
    const fileStream = fs.createWriteStream(path);

    if (this.config.compress) {
      const zipStream = zlib.createGzip({flush: zlib.Z_SYNC_FLUSH});
      const streams = [zipStream, fileStream];
      const stream = combine(streams);
      return stream;
    }

    return combine([fileStream]);
  }


  createReadStream(streamId: string, opts: { notail?: boolean } = {}): any {
    let notail = opts.notail;

    const path = this.makeStreamFilePath(streamId);
    const stream = through2();

    // a finished stream implies notail option
    this._isStreamFinished(path, (err, finished, info) => {
      if (err) {
        return stream.emit('error', err);
      }

      if (finished) {
        notail = true;
      }

      var dataStream;
      if (notail) {
        // with notail option, just read the file to the current end
        dataStream = fs.createReadStream(path);
      } else {
        // otherwise, tail the file
        // keep reading until we a timeout is hit
        dataStream = createTailingStream(path, {
          timeout: this.config.tailTimeout,
        });
      }

      if (this.config.compress) {
        dataStream = dataStream.pipe(zlib.createGunzip());
      }

      dataStream.pipe(stream);
    });

    return stream;
  }


  deleteStream(streamId: string, cb?: (err: any, newPath: string) => void): Promise<string> {
    // "delete" the data for this stream
    // (not the metadata - that will get overwritten on save)

    var newSidPrefix = `deleted_${+new Date()}_`;

    var oldPath = this.makeStreamFilePath(streamId);
    var newPath = this.makeStreamFilePath(streamId, (sid) => newSidPrefix + this.makeFileName(sid));

    fs.rename(oldPath, newPath, (err) => {
      if (cb) { cb(err, newPath); }
    });

    return Promise.resolve(newPath);
  }


  /**
   * Checks to see if the stream has finished writing.
   * This is done by checking if the modified timestamp of the file is older than tailTimeout
   * @param String filePath - path to the file to check
   * @param Function cb - callback called with true or false, and an age in ms: function(err, boolean, {age})
   */

  _isStreamFinished(filePath: string, cb: Tcb): void {
    fs.stat(filePath, (err: any, stat) => {
      if (err) return cb(err);

      const age: number = new Date().valueOf() - stat.mtime.valueOf();
      const finished: boolean = age > this.config.tailTimeout;

      cb(null, finished, {age: age});
    });
  }
}
