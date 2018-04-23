#!/usr/bin/env node
'use strict';
const url = process.argv[2];
const streamid = process.argv[3];
if (!url || !streamid) {
    console.error(`Reads input from stdin and streams it to the server

usage: ${process.argv[1]} url streamid [--force]`);
    process.exit(1);
}
let client = require('../lib/client')({ url: url });
let stream = client.createWriteStream({}, {
    id: streamid,
    force: process.argv.indexOf('--force') > 1
});
process.stdin.pipe(stream);
//# sourceMappingURL=stream.js.map