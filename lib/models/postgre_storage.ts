"use strict";

import * as _ from "lodash";
import * as through from "through2";
import { getLogger } from "../logger";
import * as bunyan from "bunyan";
import "../../typings/TConfig";
import * as uuid from "uuid/v4";
import { Database } from "../knex";
import { QueryBuilder } from "knex";

type TConfigDb = TConfig["db"];

type TOpts = {
  notail: boolean;
  log: string;
};

export class PostgreStorage {
  public config: TConfigDb;
  private log: bunyan;

  /**
   * @param config - Config object
   * @param [config.metaTable="meta"] - table to use for metadata. Defaults to "meta"
   * @param [config.logsTable="logs"] - table to use for log data. Defaults to "logs"
   */
  constructor(config?: TConfigDb) {
    this.config = _.defaults({}, config, {
      logsTable: "logs",
      metaTable: "meta"
    });

    this.log = getLogger("");
  }

  saveStream(
    streamId: string,
    meta,
    opts?: { replace: boolean },
    cb?: () => void
  ) {
    opts = opts || { replace: false };

    // no truthiness here, only the real 'true' will do
    var conflict = opts.replace === true ? "replace" : "error";

    // save the metadata of this stream
    var stream = {
      id: streamId,
      meta: meta
    };

    var self = this;

    var metaLog = {
      id: uuid(),
      buildId: meta.metadata.buildId,
      taskId: meta.metadata.task.id,
      task: meta.metadata.task
    };

    var client = Database.knex;

    return client(this.config.metaTable)
      .insert(metaLog)
      .then(() => {
        cb();
      })
      .catch(function(er) {});
  }

  loadStream(streamId: string, cb?: (stream: any) => void) {
    var parsedStreamId = this.parseStreamId(streamId);
    var client = Database.knex;

    var self = this;

    return client
      .select("buildId", "task")
      .from(this.config.metaTable)
      .where("buildId", parsedStreamId.build)
      .andWhere("taskId", parsedStreamId.task)
      .andWhere("deleted", false)
      .then(function(data) {
        if (data.length == 0) {
          if (cb) {
            cb(false);
          } else {
            return false;
          }
        }

        var meta = {
          metadata: data
        };

        var stream = {
          id: streamId,
          meta: meta
        };

        self.log.debug(stream);
        if (cb) {
          cb(stream && stream.meta);
        }
        return stream && stream.meta;
      })
      .catch(cb);
  }

  deleteStream(
    streamId: string,
    cb?: (stream: any) => void
  ): QueryBuilder | Promise<string> {
    // "delete" the data for this stream
    // (not the metadata - that will get overwritten on save)

    var parsedStreamId = this.parseStreamId(streamId);

    var client = Database.knex(this.config.metaTable);

    return client
      .where("buildId", parsedStreamId.build)
      .andWhere("taskId", parsedStreamId.task)
      .andWhere("deleted", false)
      .update({
        deleted: true
      });
  }

  parseStreamId(streamId: string) {
    var poleString = streamId.split("-");
    var pole = { build: "", task: "" };
    var idName = "";

    poleString.forEach(function(element) {
      if (element == "build" || element == "task") {
        idName = element;
      } else {
        pole[idName] += element + "-";
      }
    });

    pole.build = pole.build.substr(0, pole.build.length - 1);
    pole.task = pole.task.substr(0, pole.task.length - 1);

    return pole;
  }
}
