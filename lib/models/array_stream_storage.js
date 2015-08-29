"use strict"
var Storage = require('./storage')

class ArrayStreamStorage extends Storage {
  constructor(src){
    super()

    this.pointer = 0
    this._array_buffer = src ? src._array_buffer : []

    // override .push on buffer to get notified of a push
    var self = this
    var orig_push = this._array_buffer.push
    this._array_buffer.push = function(){
      // console.log("ARRAY PUSH", (arguments[0] || 'null').toString())
      orig_push.apply(self._array_buffer, arguments)
      self.emit("readable", arguments)
    }
  }

  write(chunk, enc, cb){
    // console.log("chunk written", this.id, (chunk || 'null').toString())
    this._array_buffer.push(chunk)
    cb && cb()
    // console.log("write buffer:", this.id, this.getBuffer())
  }

  read(size){
    if(this.pointer >= this._array_buffer.length){
      // we're here only if we're not at EOF, so stream isn't over yet
      // console.log(`[STORAGE] end of buffer, but not end of data: ${this.pointer}/${this._array_buffer.length}`)
      return ''
    }
    else {
      var chunk = this._array_buffer[this.pointer++]
      // console.log("read():", (chunk || 'null').toString())
      // 'null' will indicate eof for this stream automatically
      return chunk
    }
  }

  getBuffer() {
    return this._array_buffer
  }
}

module.exports = ArrayStreamStorage
