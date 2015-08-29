"use strict"
var stream = require('stream')

var Storage = require('./storage')
var ArrayStreamStorage = require('./array_stream_storage')

var seq = 1
class Stream extends stream.Duplex {
  constructor(storage){
    super()
    this.id = `stream-${seq++}`
    this.metadata = null
    this.open = false

    this._storage = storage

    // tell us we have data to read when the storage has data
    storage.on("readable", function(){
      // console.log(`[STREAM ${this.id}] storage has data: ${this._storage._array_buffer}`)
      this.read(0)
    }.bind(this))

    this.on('finish', function(){
      this.open = false
      this._storage.end()
    }.bind(this))
  }

  _write(chunk, enc, cb){
    this.open = true

    // console.log(`[STREAM] WRITE: '${chunk.toString()}', open: ${this.open}`)
    this._storage.write(chunk, enc, cb)
  }

  _read(size){
    var chunk = this._storage.read(size)
    if(chunk === null){
      this.open = false
    }
    this.push(chunk)
  }
}


module.exports = {
  Stream, ArrayStreamStorage
}
