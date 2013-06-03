#!/usr/bin/env node

var argv = require('optimist').argv
var dns = require('dns')
var fs = require('fs')
var node_http = require('http')
var node_url = require('url')
var pcap = require("pcap")
var server = require('htracr').server
var util = require('util')


var htracr = {
  device: '',
  sniff_port: 80,
  packets: [],
  capture: {sessions: {}},         // [server_ip][local_port] = {...}
  captured_packets: 0,
  msgs: {},
  server_names: {},
  pcap_session: undefined,
  drop_watcher: undefined,
  err: undefined,

  clear: function () {
    var self = this
    self.packets = []
    self.capture = {sessions: {}}
    self.captured_packets = 0
    self.msgs = {}
    self.err = undefined
    if (self.drop_watcher) {
      clearInterval(self.drop_watcher)
    }
    self.drop_watcher = undefined
  },

  start_capture: function() {
    var self = this
    self.clear()
    var f = "tcp port " + self.sniff_port
    var b = 10
    // FIXME: where did error catch go?
    self.capture.start = new Date().getTime()
    self.pcap_session = pcap.createSession(self.device, f, (b * 1024 * 1024))
    this.setup_listeners()
    console.log("Sniffing on " + self.pcap_session.device_name)
    
    // Check for pcap dropped packets on an interval
    self.drop_watcher = setInterval(function () {
      var stats = self.pcap_session.stats()
      if (stats.ps_drop > 0) {
        // TODO: notify browser through err as well
        console.log(
          "dropped packets, need larger buffer or less work to do: " 
          + util.inspect(stats)
        )
      }
    }, 2000)
  },
  
  stop_capture: function () {
    var self = this
    if (self.pcap_session == undefined) {
      return
    }
    if (self.drop_watcher) {
      clearInterval(self.drop_watcher)
    }
    self.drop_watcher == undefined
    self.capture.end = new Date().getTime()
    self.pcap_session.close()
    self.pcap_session = undefined
    console.log("Stopped sniffing")
  },

  load_file: function(filename) {
    var self = this
    var f = "tcp port " + self.sniff_port
    console.log("Processing upload file: " + filename)
    self.pcap_session = pcap.createOfflineSession(filename, f)
    self.setup_listeners()
  },

  setup_listeners: function () {
    var self = this
    var tcp_tracker = new pcap.TCP_tracker()

    // listen for packets, decode them, and feed TCP to the tracker
    self.pcap_session.on('packet', function (raw_packet) {
      self.captured_packets += 1
      var packet = pcap.decode.packet(raw_packet)
      self.save_packet(packet)
      // This needs to happen AFTER we note the packet.
      tcp_tracker.track_packet(packet)
    })

    tcp_tracker.on("start", function (session) {
      var conn = self.get_conn(session)
      conn.start = session.current_cap_time
    })

    tcp_tracker.on("retransmit", function (session, direction, seqno) {
      var conn = self.get_conn(session)
      conn.events.push(
        self.format_event(session, 'retransmit', {
          'direction': direction,
          'seqno': seqno
        })
      )
    })

    tcp_tracker.on("reset", function (session) {
      // Right now, it's only from dst.
      var conn = self.get_conn(session)
      conn.events.push(self.format_event(session, 'reset'))
    })

    tcp_tracker.on("syn retry", function (session) {
      var conn = self.get_conn(session)
      conn.events.push(self.format_event(session, 'retry'))
    })
      
    tcp_tracker.on("end", function (session) {
      var conn = self.get_conn(session)
      conn.end = session.current_cap_time
      var last_req = self.get_last(conn.http_reqs)
      if (last_req && ! last_req.end) {
        last_req.end = conn.end
        last_req.end_packet = conn.packets.length - 1
        self.msg_stats(last_req, conn)
      }
      var last_res = self.get_last(conn.http_ress)
      if (last_res && ! last_res.end) {
        last_res.end = conn.end
        last_res.end_packet = conn.packets.length - 1
        self.msg_stats(last_res, conn)
      }
    })
    

    tcp_tracker.on('http request', function (session, http) {
      var conn = self.get_conn(session)
      var request = self.clone(http.request)
      var corrected = self.rewind_packets(conn.packets, 'out', request)
      conn.http_reqs.push({
        'kind': 'req',
        'start': corrected.start,
        'start_packet': corrected.index,
        'data': request
      })
    })

    tcp_tracker.on('http request body', function (session, http, data) {
    })

    tcp_tracker.on('http request complete', function (session, http) {
      var conn = self.get_conn(session)
      var req = self.get_last(conn.http_reqs)
      req.end = session.current_cap_time
      req.end_packet = conn.packets.length - 1
      self.msg_stats(req, conn, conn.http_reqs.length)
    })

    tcp_tracker.on('http response', function (session, http) {
      var conn = self.get_conn(session)
      var response = self.clone(http.response)
      var corrected = self.rewind_packets(conn.packets, 'in', response)
      conn.http_ress.push({
        'kind': 'res',
        'start': corrected.start,
        'start_packet': corrected.index,
        'data': response
      })
    })

    tcp_tracker.on('http response body', function (session, http, data) {
    })

    tcp_tracker.on('http response complete', function (session, http) {
      var conn = self.get_conn(session)
      var res = self.get_last(conn.http_ress)
      res.end = session.current_cap_time
      res.end_packet = conn.packets.length - 1
      self.msg_stats(res, conn, conn.http_ress.length)
    })

    tcp_tracker.on('http error', function (session, direction, error) {
      console.log(" HTTP parser error: " + error)
      // TODO - probably need to force this transaction to be over
    })
  },

  // search backwards through a list of packets and find where a http message
  // really started. This is imprecise, but should be OK most of the time.
  // see: https://github.com/mranney/node_pcap/issues#issue/8
  rewind_packets: function (packets, interesting_dir, msg) {
    var bytes = [
      msg.method || "",
      msg.status_code || "", // don't have access to phrase :(
      " ",
      msg.url || "",
      " ",
      "HTTP/1.x", // works out the same for request or response
      "\n"
    ]
    console.log(bytes)
    for (var h in msg.headers) {
      if (msg.headers.hasOwnProperty(h)) {
        bytes.push(h + ": " + msg.headers[h] + "\n") // conservative - no \r
      }
    }
    bytes.push("\n") // conservative - no \r
    var num_bytes = bytes.join("").length
    
    var bytes_seen = 0
    for (var i = packets.length - 1; i >= 0; i -= 1) {
      var packet = packets[i]
      if (packet.dir == interesting_dir) {
        bytes_seen += packet.data_sz
      }
      if (bytes_seen >= num_bytes) {
        return {
          start: packet.time,
          index: i
        }
      }
    }
    // Shouldn't get here...
    console.log("Couldn't find the start of message: " + msg);
    return {
      start: msg.time,
      index: packets.length
    };
  },

  // compute stats for the given HTTP message
  msg_stats: function (msg, conn, msg_offset) {
    var target_dir = msg.kind == 'req' ? 'out' : 'in'
    var packet_count = 0
    var byte_count = 0
    for (var i = msg.start_packet; i <= msg.end_packet; i += 1) {
      var packet = conn.packets[i]
      if (packet.data_sz > 0 && packet.dir === target_dir) {
        packet_count += 1
        byte_count += packet.data_sz
        packet.msg = msg_offset - 1
      }
    }
    msg.data_packet_count = packet_count
    msg.packet_byte_count = byte_count
  },

  // return a data structure for an event
  format_event: function (session, event_kind, data) {
    var out_data = data || {}
    out_data.time = session.current_cap_time
    out_data.kind = event_kind
    return out_data
  },

  // given a packet, save its data in self.packets and info in self.capture
  save_packet: function (packet) {
    var self = this
    var direction
    var server
    var local_port

    // fake in start and end for loaded sessions
    if (! self.capture.start) {
      self.capture.start = packet.pcap_header.time_ms
    }
    if (! self.capture.end || self.capture.end < packet.pcap_header.time_ms) {
      self.capture.end = packet.pcap_header.time_ms
    }

    if (! packet.link.ip) {
      // not an IP packet
      return
    }

    if (packet.link.ip.tcp.dport == 80) {
      server = packet.link.ip.daddr
      local_port = packet.link.ip.tcp.sport
      direction = "out"
    } else {
      server = packet.link.ip.saddr
      local_port = packet.link.ip.tcp.dport
      direction = "in"
    }

    // reverse lookup
    if (self.server_names[server] == undefined) {
      self.server_names[server] = ""
      dns.reverse(server, function(err, domains) {
        if (! err) {
          self.server_names[server] = domains[0]
        } else {
          delete self.server_names[server]
        }
      })
    }

    var detail = {
      time: packet.pcap_header.time_ms,
      ws: packet.link.ip.tcp.window_size,
      dir: direction,
      flags: packet.link.ip.tcp.flags,
      options: packet.link.ip.tcp.options,
      data_sz: packet.link.ip.tcp.data_bytes,
      packet_id: self.packets.length
    }

    if (detail.data_sz == 0 && 
        detail.flags.ack && 
        ! detail.flags.syn && 
        ! detail.flags.rst &&
        ! detail.flags.fin &&
        ! detail.flags.psh
    ) {
      detail.ack_only = true;
    } else {
      detail.ack_only = false;
    }

    self._get_conn(server, local_port).packets.push(detail)
    self.packets.push((packet.link.ip.tcp.data || "").toString('utf8'))
  },

  // given a TCP session, return the relevant data structure in self.capture
  get_conn: function (tcp_session) {
    var self = this
    var server
    var local_port
    if (tcp_session.dst.split(":")[1] == self.sniff_port) {
      server = tcp_session.dst.split(":")[0]
      local_port = tcp_session.src.split(":")[1]
    } else {
      server = tcp_session.src.split(":")[0]
      local_port = tcp_session.dst.split(":")[1]
    }
    return self._get_conn(server, local_port)
  },
  
  // given a server and local_port, return the relevant data structure  
  _get_conn: function (server, local_port) {
    if (this.capture.sessions[server] == undefined) {
      this.capture.sessions[server] = {}
    }
    var server_conn = this.capture.sessions[server]
    if (server_conn[local_port] == undefined) {
      server_conn[local_port] = {
        'server': server,
        'local_port': local_port,
        'events': [],
        'packets': [],
        'http_reqs': [],
        'http_ress': []
      }
    }
    return server_conn[local_port]
  },

  get_last: function (arr) {
    return arr[arr.length - 1]
  },
  
  clone: function (obj) {
    if (null == obj || "object" != typeof obj) {
      console.log("Cloning a non-object.")
      return obj
    }
    var copy = obj.constructor()
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr]
    }
    return copy
  }
}


// port to listen to 
var port = parseInt(argv._[0], 10)
if (! port || port == NaN) {
  console.log("Usage: htracr listen-port [device]")
  process.exit(1)
}

// device to snoop on
var device = argv._[1]
if (device) {
  htracr.device = device
}

server.start(port, htracr)
