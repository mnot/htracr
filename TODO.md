### TCP visualisation

- Make connection states visible:
  - handshaking
  - connected
  - half-connected
  - idle
  - disconnecting
  - buffer-full?
- per-connection stats:
  - total packets (graph of types?)
  - congestion window (over time?)
  - receive window (over time?)
  - rtt calculation / visualisation
- handle tcp-retransmit / tcp-reset
- show ack relationships?
- hide ack-only packets

### HTTP visualisation

- relate requests to responses (for navigation / referer linking)
- message stats
  - message delay
  - number of round trips
- highlight unusual methods / status codes
- click on response to open window with it
- click on request to re-make request
- server stall time (based upon rtt / packet sizes / psh)
- content types - message colours?

### Misc. Features

- help button (modal)
- configurable sniff port(s) in-browser
- printing
- trace DNS
- show scale in round trips
- per-server stats
- allow removing connections / servers, or focus on one
- improved keyboard controls
- dump pcap sessions (requires support in node_pcap)
- magnifier, because packets get lost between the pixels
- allow copying from msg (e.g., url )
- make highlighting more prominent (e.g., pulse animation?)

### Bugs

- header names are case-sensitive
- proper handling for location headers (e.g., relative)
- need HTTP status phrase
- some requests not drawn in firefox 3?
- pipelining
- keep centre on zoom
- IE capture caching
- pipelined responses -- see <https://github.com/mranney/node_pcap/issues#issue/20>