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
- Highlight message headers that are split across packets
- Highlight pipelining
- message stats
  - message delay
  - number of round trips
- click on response to open window with it
- click on request to re-make request
- server stall time (based upon rtt / packet sizes / psh)
- content types - message colours?

### Misc. Features

- configurable sniff port(s) in-browser
- printing
- trace DNS
- show scale in round trips
- per-server stats
- allow removing connections / servers
- keyboard controls
- dump pcap sessions
- magnifier, because packets get lost between the pixels
- allow copying from msg (e.g., url )
- make highlighting more prominent (e.g., pulse animation?)

### Bugs

- header names are case-sensitive here
- proper handling for location headers (e.g., relative)
- prettify packet display
- need HTTP status phrase
- some requests not drawn in firefox 3
- connection: close on requests - do we get a http-res-end?
- pipelining
- improve RTT calculation
- keep centre on zoom