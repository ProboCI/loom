"use strict"

var stream = require('stream')
var MultiStream = require('multistream')

var MemoryStream = require('memorystream')

class ArrayStream extends stream.Duplex {
  constructor(){
    super()
    this.pointer = 0
    this.buffer = []
  }

  _write(chunk, enc, cb){
    this.buffer.push(chunk)
    cb()
  }

  _read(size){
    if(this.pointer >= this.buffer.length)
      this.push(null)
    else
      this.push(this.buffer[this.pointer++])
  }
}

var seq = 0
var STATES = ["INIT", "STORAGE_SENT", "PRODUCER_SENT", "DONE"].reduce(function(prev, curr){prev[curr] = curr;  return prev}, {})

class Stream {
  constructor(id){
    this.id = id || `stream-${seq++}`
    this.chunks = []
    this.metadata = null
    this.open = false
    this.size = 0

    // internal
    this._producers = []
    this._consumers = []

    // TODO: pluggable storages
    //this._storage = new MemoryStream()
    this._storage = new ArrayStream()
  }

  /**
   * currently only one producer is supported
   */
  setProducerStream(producer){
    var self = this
    this.open = true

    if(this._producers.length){
      throw new Error("Only one producer per stream is supported")
    }
    this._producers.push(producer)

    // start piping producer to storage
    producer.pipe(this._storage)

    this._storage.on("finish", function(){
      console.log("producer finished")
      self.open = false
    })
  }

  /**
   * Returns a unified readable stream of stored and live (producer data) married
   * together correctly at this point in time. Can be called multiple times for multimple
   * consumers
   */
  createConsumerStream(){
    var self = this
    var state = STATES.INIT
    var factory = function(cb){
      // called every time we're ready for a new stream
      var nextState, nextStream

      switch(state){
      case STATES.INIT:
        // send our storage stream first
        nextState = STATES.STORAGE_SENT
        nextStream = self._storage
        break;
      case STATES.STORAGE_SENT:
        // send producer if we have it, otherwise advance to done
        var producer = self._producers[0]
        if(producer && self.open){
          // console.log(producer)

          nextState = STATES.PRODUCER_SENT
          nextStream = producer
        } else {
          nextState = STATES.DONE
          nextStream = null
        }
        break;
      case STATES.PRODUCER_SENT:
      case STATES.DONE:
        nextState = STATES.DONE
        nextStream = null
        break;
      default:
        console.log("ERROR STATE:", state)
        cb(new Error("unkown state: " + state))
      }

      console.log("open: ", self.open)
      console.log(`SM: ${state} -> ${nextState}`)

      state = nextState
      setTimeout(function(){
        cb(null, nextStream)
      }, 0)
    }

    return new MultiStream(factory)
    // return this._storage
  }
}


module.exports = {
  Stream
}
