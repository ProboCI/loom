# About

This server allows for streaming in arbitrary data streams from `producers` (assumed to be stdout/stderr from applications), and attaching arbitrary metadata to them. The streams are persisted live and can be read by `consumers` either in real-time or after input is complete.

Note: The codebase uses generators, so io.js required (or node 0.11.x with --harmony-generators flag).

# API

## Producers

Create a new stream with metadata by initiating a `POST` request to the server. Any metat-data must be encoded in JSON in the `X-Metadata' header

### Request
```
POST /stream
X-Metadata: { ... arbitrary JSON metadata here ... }

... incoming data ...
```

### Response
```
201 HTTP Created

{
  id: "the ID of the stream"
}
```

The response will be sent immediately once the stream is configured on the backend, and the producer can continue pumping data into the connection, closing the stream when all data is written

## Consumers

Consumers that know a stream ID can make request to read it back out. If the full stream is stored on the server, the response will be send and the HTTP request closed. If the producer is still contributing data to the stream, anything already sent by the producer will be sent first, and the consumer stream will remain open and updated with new producer data as it comes in until the producer finishes.

### Request
```
GET /stream/:id

{
  ... arbitrary JSON metadata here ..
}
```

### Response

If the server already has the full stream buffered, a content-length header will be sent. Otherwise, since the size of the stream is not known, no content-length header will be present and sets `Transfer-Encoding` header to `chunked`.

The metadata will be returned as JSON in the `X-Metadata' header.

```
200 HTTP Ok
Content-Type: application/octet-stream
X-Metadata: { ... arbitrary JSON metadata here ... }
Conent-Length: XXXX

... data here ...
```

In case the stream with the specified ID doesn't exist, a 404 response will be sent.

```
404 Not Found

{
  error: "The stream with ID XXXXX does not exist"
}
```

