#!/usr/bin/env node

var argv = require('./lib/optimist').argv
var dns = require('dns')
var node_http = require('http')
var node_url = require('url')
var pcap = require("pcap")
var server = require('./server')
var util = require('util')


var htracr = {
  packets: [],
  conns: {},
  msgs: {},
  server_names: {},
  pcap_session: undefined,
  drop_watcher: undefined,

  start_capture: function() {
    var self = this
    self.clear()
    var f = "tcp port 80"
    var b = 10
    self.pcap_session = pcap.createSession('', f, (b * 1024 * 1024))
    this.setup_listeners()
    console.log("Sniffing on " + self.pcap_session.device_name)
    
    // Check for pcap dropped packets on an interval
    self.drop_watcher = setInterval(function () {
      var stats = self.pcap_session.stats()
      if (stats.ps_drop > 0) {
        console.log(
          "dropped packets, need larger buffer or less work to do: " 
          + util.inspect(stats)
        )
      }
    }, 2000)
  },
  
  stop_capture: function () {
    var self = this
    if (self.pcap_session == undefined)
      return
    clearInterval(self.drop_watcher)
    self.pcap_session.close()
    self.pcap_session = undefined
    console.log("Stopped sniffing")
  },

  clear: function () {
    var self = this
    self.packets = []
    self.conns = {}
    self.msgs = {}
  },

  get_conns: function () {
    var self = this
    var got_something = false;
    var o = {}
    for (server in self.conns) {
      for (conn in self.conns[server]) {
        // weed out servers without HTTP requests in them
        item_loop:
        for (var i = 0; i < self.conns[server][conn].length; i++) {
          var item = self.conns[server][conn][i]
          if (item.what == 'http-req-start') {
            if (o[server] == undefined) {
              got_something = true
              o[server] = {}              
            }
            o[server][conn] = self.conns[server][conn]
            break item_loop
          }
        }
      }
    }
    if (! got_something) {
      return null
    } else {
      return o
    }
  },

  setup_listeners: function () {
    var self = this
    var tcp_tracker = new pcap.TCP_tracker()

    // listen for packets, decode them, and feed TCP to the tracker
    self.pcap_session.on('packet', function (raw_packet) {
      var packet = pcap.decode.packet(raw_packet)
      // NOTE: ordering is important here!
      self.note_packet(packet)
      tcp_tracker.track_packet(packet)
    })

    tcp_tracker.on("start", function (session) {
      self.note_session(session, 'tcp-start')
    })

    tcp_tracker.on("retransmit", function (session, direction, seqno) {
      self.note_session(session, 'tcp-retransmit', 
        {'direction': direction, 'seqno': seqno}
      )
    })

    tcp_tracker.on("end", function (session) {
      self.note_session(session, 'tcp-end')
    })

    tcp_tracker.on("reset", function (session) {
      // Right now, it's only from dst.
      self.note_session(session, 'tcp-reset')
    })

    tcp_tracker.on("syn retry", function (session) {
      self.note_session(session, 'tcp-retry')
    })

    tcp_tracker.on('http error', function (session, direction, error) {
      console.log(" HTTP parser error: " + error)
      // TODO - probably need to force this transaction to be over at this point
    })

    tcp_tracker.on('http request', function (session, http) {
      self.note_session(session, 'http-req-start', http.request)
    })

    tcp_tracker.on('http request body', function (session, http, data) {
      self.note_session(session, 'http-req-data', {length: data.length})
    })

    tcp_tracker.on('http request complete', function (session, http) {
      self.note_session(session, 'http-req-end')
    })

    tcp_tracker.on('http response', function (session, http) {
      self.note_session(session, 'http-res-start', http.response)
    })

    tcp_tracker.on('http response body', function (session, http, data) {
      self.note_session(session, 'http-res-data', {length: data.length})
    })

    tcp_tracker.on('http response complete', function (session, http) {
      self.note_session(session, 'http-res-end')
    })

  },

  note_session: function (session, what, details) {
    var self = this;
    if (! details) {
      details = {}
    }
    if (session.dst.split(":")[1] == 80) {
      var server = session.dst
      var local_port = session.src.split(":")[1]
    } else {
      var server = session.src
      var local_port = session.dst.split(":")[1]
    }
    details.time = session.current_cap_time
    details.what = what
    self.note(server, local_port, details)
  },

  note_packet: function (packet) {
    var self = this;
    var what;
    if (packet.link.ip.tcp.dport == 80) {
      var server_ip = packet.link.ip.daddr
      var server = server_ip + ":" + packet.link.ip.tcp.dport
      var local_port = packet.link.ip.tcp.sport
      what = "packet-out"
    } else {
      var server_ip = packet.link.ip.saddr
      var server = server_ip + ":" + packet.link.ip.tcp.sport
      var local_port = packet.link.ip.tcp.dport
      what = "packet-in"
    }
    if (self.server_names[server_ip] == undefined) {
      self.server_names[server_ip] = ""
      dns.reverse(server_ip, function(err, domains) {
        if (! err) {
          self.server_names[server_ip] = domains[0]
        } else {
          delete self.server_names[server_ip]
        }
      })
    }
    var detail = {
      time: packet.pcap_header.time_ms,
      what: what,
      ws: packet.link.ip.tcp.window_size,
      flags: packet.link.ip.tcp.flags,
      options: packet.link.ip.tcp.options,
      data_sz: packet.link.ip.tcp.data_bytes,
      packet_id: self.packets.length,
    }
    self.note(server, local_port, detail)
    // FIXME - encoding
    self.packets.push((packet.link.ip.tcp.data || "").toString('utf8'))
  },

  note: function (server, local_port, details) {
    if (this.conns[server] == undefined) {
      this.conns[server] = {}
    }
    var server_conn = this.conns[server]
    if (server_conn[local_port] == undefined)
      server_conn[local_port] = []
    server_conn[local_port].push(details)
  },
  
}


// port to listen to 
var port = parseInt(argv._[0])
if (! port || port == NaN) {
  console.log("Usage: test-browser.js listen-port [state-file]")
  process.exit(1)
}

server.start(port, htracr)
