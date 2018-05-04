'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const logger_1 = require("./logger");
const Thinky = require("thinky");
const logger = logger_1.getLogger('db');
exports.rethink = {
    thinky: null,
    r: null,
    config: null,
    models: null,
    connect: function (config) {
        exports.rethink.config = _.defaults(config || {}, {
            logsTable: 'logs',
            metaTable: 'meta',
        });
        const thinky = exports.rethink.thinky = Thinky({
            host: config.host,
            port: config.port,
            db: config.db,
        });
        const r = exports.rethink.r = thinky.r;
        r.getPoolMaster().on('size', function (size) {
            logger.debug({ pool_size: size }, `# of connections in pool: ${size}`);
        });
        exports.rethink.models = createModels(thinky, config);
        return exports.rethink;
    }
};
function createModels(thinky, config) {
    var Logs = thinky.createModel(config.logsTable, {}, { enforce_extra: 'none' });
    Logs.ensureIndex('ts');
    Logs.ensureIndex('sid');
    Logs.ensureIndex('sid_ts', function (row) { return [row('sid'), row('ts')]; });
    var Meta = thinky.createModel(config.metaTable, {}, { enforce_extra: 'none' });
    return { Logs, Meta };
}
//# sourceMappingURL=rethink.js.map