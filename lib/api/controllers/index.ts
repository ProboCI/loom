"use strict";

import co from "co";
import { FileSystemStorage } from "../../models/postgre_stream_backend_filesystem";
import { getLogger } from "../../logger";
import * as uuid from "uuid/v4";

const Storage = FileSystemStorage;
const log = getLogger("").child({ component: "server" });

function handleError(res, err, next) {
  res.status(err.status || 500);
  res.json({ error: err.message });
  next();
}

var activeStreams = (function() {
  var active = new (require("events")).EventEmitter();
  active.streams = {};
  active.on("added", function(id) {
    log.info("Spy Stream added: " + id);
    active.streams[id] = true;
  });
  active.on("removed", function(id) {
    log.info("Spy Stream removed: " + id);
    delete active.streams[id];
  });

  var colorIndex = 0;
  active.get_color = function(obj) {
    var colors = [
      "black",
      "red",
      "green",
      "yellow",
      "blue",
      "gray",
      "magenta",
      "cyan",
      "white"
    ];
    return colors[colorIndex++ % colors.length];
  };

  return active;
})();

var streams = {
  create: function(req, res, next) {
    var metadata = req.header("x-stream-metadata");
    try {
      if (metadata) {
        metadata = JSON.parse(metadata);
      }
    } catch (e) {
      req.log.warn(
        { err: e, metadata },
        "Failed to parse metadata header as JSON"
      );
    }

    co(function*() {
      var id =
        req.params.id ||
        "build-" + metadata.buildId + "-task-" + metadata.task.id;
      req.log = req.log.child({ sid: id }, true);

      var storage = new Storage(req.loomConfig.storage);

      var stream = yield storage.loadStream(id);
      if (stream) {
        // stream id is already taken, see if force flag is specified
        if (req.query.force !== "true") {
          var msg = `The stream with ID ${id} already exists.`;
          req.log.error(msg);
          res.json({
            error: msg + " Specify force=true query param to override."
          });
          return next();
        } else {
          // delete existing stream
          req.log.info("deleting stream...");
          yield storage.deleteStream(id);
          req.log.info("stream deleted");

          res.header("x-stream-replaced", true);
        }
      }

      storage
        .saveStream(
          id,
          {
            metadata: metadata
          },
          {
            replace: req.query.force === "true"
          }
        )
        .then(function() {
          var error;

          var writer = storage.createWriteStream(id);

          writer.on("error", err => {
            req.log.error({ err }, "Failed to create writer stream for", id);

            error = err;
            handleError(res, err, next);
          });

          // allow time for spy hooks to take hold
          setTimeout(function() {
            if (!error) {
              req.pipe(writer);

              req.log.info({ metadata }, "created stream");

              res.writeHead(201, {
                "x-stream-id": id
              });
              res.flushHeaders();
            }
          }, 10);

          activeStreams.emit("added", id);

          req.on("end", function() {
            req.log.info("producer stream ended");
            res.end();
            activeStreams.emit("removed", id);
            if (next) {
              next();
            }
          });
        });
    }).catch(next);
  },

  get: function(req, res, next) {
    var streamId = req.params.id;
    var notail = "notail" in req.query;

    req.log = req.log.child({ sid: streamId }, true);
    req.log.info({ opts: { notail: notail } }, "got a consumer request");

    var storage = new Storage(req.loomConfig.storage);
    storage
      .loadStream(streamId)
      .then(function(stream) {
        if (!stream) {
          res.json({ error: `The stream with ID ${streamId} does not exist` });
          return next();
        }

        var reader = storage.createReadStream(streamId, { notail });
        res.header("x-stream-metadata", JSON.stringify(stream.metadata[0]));

        reader.on("error", err => {
          req.log.error({ err }, "Failed to create read stream for", streamId);

          if (err.code === "ENOENT") {
            err.status = 404;
          }

          handleError(res, err, next);
        });

        reader.pipe(res);

        res.on("finish", function() {
          req.log.info("consumer stream ended");
          next();
        });
      })
      .catch(function(err) {
        req.log.error({ err }, "Could not fetch stream");
        handleError(res, err, next);
      });
  },

  // dumps all active live streams
  spy: function(req, res, next) {
    var colors = require("colors");
    // force support (needed when running with npm)
    colors.supportsColor = colors.enabled = true;

    function colorize(str, color) {
      if (req.query.color !== void 0) {
        return colors[color](str).replace(/(^.*):/, "$&".bold);
      }
      return str;
    }

    var through2 = require("through2");
    var storage = new Storage(req.loomConfig.storage);

    var lastStreamId;

    function showStream(id) {
      req.log.info("SHOW STREAM: " + id);

      var color = activeStreams.get_color();
      res.write(colorize(`START: ${id}\n`, color));

      var readStream = storage.createReadStream(id);

      readStream.on("error", err => {
        req.log.error({ err }, "Failed to create spy read stream for", id);
      });

      readStream
        .pipe(
          through2(function(chunk, enc, cb) {
            // don't re-print stream ID header if the last chunk belonged to the same stream
            var header = `${id}:\n`;
            if (lastStreamId === id) {
              header = "";
            }
            lastStreamId = id;

            cb(null, colorize(`${header}${chunk.toString()}`, color));
          })
        )
        .pipe(res, { end: false });

      readStream.on("end", function flush(cb) {
        req.log.info("STREAM ENDED: " + id);
        res.write(colorize(`END: ${id}\n`, color));
      });

      activeStreams.on("removed", function(removedId) {
        if (id === removedId) {
          // give the stream some time to finish being written and outputted
          // not the best method, but this is non-critical code
          setTimeout(() => readStream.end(), 200);
        }
      });
    }

    // stream all in-flight streams
    Object.keys(activeStreams.streams).forEach(showStream);

    // stream all new streams
    activeStreams.on("added", showStream);
  }
};

export const controllers = { streams };
