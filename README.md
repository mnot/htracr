


## TODO

### TCP visualisation

- Colour packets based on type (syn, ack, etc.)
- Hover / click on connection for statistics
- tcp retransmit / congestion
- window scaling?

### HTTP visualisation

- Method
- Status codes
- Location header linking (similar to refs?) for redirects
- Highlight requests that are split across packets
- Highlight pipelining
- show compression
- content types?
- timings

### Bugs / Misc.

- Draw http messages that don't terminate properly (because they're
  cut off by stop)
- proper display of packet / http body content
- proper zoom control
- layering, ability to turn on / off
- show hostname instead of IP
- make server identity visible even when scrolled / zoomed
- configurable sniff port(s)
- need HTTP status phrase