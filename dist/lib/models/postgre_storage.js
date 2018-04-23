"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const logger_1 = require("../logger");
require("../../typings/TConfig");
const uuid = require("uuid/v4");
const knex_1 = require("../knex");
class PostgreStorage {
    constructor(config) {
        this.config = _.defaults({}, config, {
            logsTable: "logs",
            metaTable: "meta"
        });
        this.log = logger_1.getLogger("");
    }
    saveStream(streamId, meta, opts, cb) {
        opts = opts || { replace: false };
        var conflict = opts.replace === true ? "replace" : "error";
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
        var client = knex_1.Database.knex;
        return client(this.config.metaTable)
            .insert(metaLog)
            .then(() => {
            cb();
        })
            .catch(function (er) { });
    }
    loadStream(streamId, cb) {
        var parsedStreamId = this.parseStreamId(streamId);
        var client = knex_1.Database.knex;
        var self = this;
        return client
            .select("buildId", "task")
            .from(this.config.metaTable)
            .where("buildId", parsedStreamId.build)
            .andWhere("taskId", parsedStreamId.task)
            .andWhere("deleted", false)
            .then(function (data) {
            if (data.length == 0) {
                if (cb) {
                    cb(false);
                }
                else {
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
    deleteStream(streamId, cb) {
        var parsedStreamId = this.parseStreamId(streamId);
        var client = knex_1.Database.knex(this.config.metaTable);
        return client
            .where("buildId", parsedStreamId.build)
            .andWhere("taskId", parsedStreamId.task)
            .andWhere("deleted", false)
            .update({
            deleted: true
        });
    }
    parseStreamId(streamId) {
        var poleString = streamId.split("-");
        var pole = { build: "", task: "" };
        var idName = "";
        poleString.forEach(function (element) {
            if (element == "build" || element == "task") {
                idName = element;
            }
            else {
                pole[idName] += element + "-";
            }
        });
        pole.build = pole.build.substr(0, pole.build.length - 1);
        pole.task = pole.task.substr(0, pole.task.length - 1);
        return pole;
    }
}
exports.PostgreStorage = PostgreStorage;
//# sourceMappingURL=postgre_storage.js.map