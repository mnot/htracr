jQuery.noConflict();
jQuery(document).ready(function() {
	jQuery("#stop").hide();
	jQuery("#msg").draggable();
	jQuery("#msg").resizable();
	jQuery("#zoom").slider({
		max: 3, 
		min: 1, 
		step: 0.5, 
		value: 1,
		change: function(event, ui) {
			zoom(ui.value);
		},
	});
	update_state();
});

Raphael.fn.line = function(s, e) {
	if (! s[0] || ! s[1] || ! e[0] || ! e[1]) {
		// dummy
		return this.circle(0,0,0);
	}
	return this.path(
			"M" + s[0] + "," + s[1] + " " +
   	  "L" + e[0] + "," + e[1]
	);
}

Raphael.fn.curve = function(s, e) {
	console.log("drawing curve: " + s + " to " + e);
	if (! s[0] || ! s[1] || ! e[0] || ! e[1]) {
		// dummy
		return this.circle(0,0,0);
	}
	var s_ctrl = [s[0], s[1]];
	var e_ctrl = [s[0], s[1]];

  if (s[1] == e[1]) {
    s_ctrl[1] = s[1] - 30;
    e_ctrl[1] = s[1] - 30;
  } else {    
  	s_ctrl[1] -= ((s[1] - e[1]) / 4);
  	e_ctrl[1] -= ((s[1] - e[1]) / 5);
  }
  var path = "M" + s[0] + "," + s[1] + " " +
	           "C" + s_ctrl[0] + "," + s_ctrl[1] + " " +
	                 e_ctrl[0] + "," + e_ctrl[1] + " " +
                   e[0] + "," + e[1]
  console.log("curve: " + path);
	return this.path(path);
}

var margin = [10, 150, 10, 10];
var server_padding = 48;
var conn_pad = 32; // padding between connections
var conn_w = 14;  // how wide the connection is
var http_w = 8;  // how wide http request and response messages are
var pix_per_sec = 300;  // pixels per second


var htracr = {
	w: 1000,
	h: 200,
	paper: Raphael(document.getElementById("paper"), self.w, self.h).initZoom(),
	msg: document.getElementById("msg"),
	conns: {},
	urls: {},
	refs: {},
	first: undefined,
	last: undefined,
	
	draw_trace: function () {
		var self = this;
		self.paper.clear();
		self.resize(((self.end_time() - self.start_time()) * pix_per_sec / 1000) + margin[1] + margin[3], self.h);
		var y = margin[0];
		self.ordered_servers().forEach(function(server) {
			self.paper.text(
				margin[3] * 2, 
	 			y, 
	 			server
			).attr({
				'font-size': 24,
				'text-anchor': 'start',
				'font-weight': 'bold',
				'fill': "#666",
			});
			var s = self.conns[server];
			for (connection in s) {
				y += conn_pad;
				var c = s[connection];
				self.process_conn(c, y);
			}
			y += server_padding;
		});
		self.draw_refs();
		self.draw_bookends(y);
	},

	ordered_servers: function () {
		function sortfunc(a, b) {
			var a_first;
			for (conn in a) {
				if (! a_first || conn[0].time < a_first) {
					a_first = conn[0].time;
				}
			}
			var b_first;
			for (conn in b) {
				if (! b_first || conn[0].time < b_first) {
					b_first = conn[0].time;
				}
			}
			return a_first - b_first;
		};
		var servers = [];
		for (server in self.conns) {
			servers.push(server);
		};
		servers.sort(sortfunc);
		return servers;
	},

	process_conn: function (conn, y) {
		var self = this;
		var conn_start = margin[3];
		var conn_end = self.w - margin[1];
		var packets = [];
		var http_reqs = [];
		var http_ress = [];

		if (! conn) {
			console.log("got bad conn: " + conn);
			return; // shrug
		}
		
		if (y + 200 > self.h) {
			self.resize(self.x, y + 200);
		}


		conn.forEach(function(item) {
			switch (item.what) {
				case "packet-in":
				case "packet-out":
					packets.push(item);
					break;
				case "tcp-start":
					conn_start = self.time_x(item.time);
					break;
				case "tcp-end":
					conn_end = self.time_x(item.time);
					break;
				case "http-req-start":
				  var real_start = self.rewind_packets(packets, item.details)
					http_reqs.push([self.time_x(real_start), null, item.details]);
					break;
				case "http-req-end":
					http_reqs.slice(-1)[0][1] = self.time_x(item.time);
					break;
				case "http-res-start":
					http_ress.push([self.time_x(item.time), null, item.details]);
					break;
				case "http-res-end":
					http_ress.slice(-1)[0][1] = self.time_x(item.time);
					break;
				default:
					console.log("unknown item: " + item.what);
					break;
			}
		});

	  self.draw_conn(conn_start, conn_end, y);
		packets.forEach(function(i) {
			self.draw_packet(i, y);
		});
				
		function show_hdrs(hdrs) {
				var l = [];
				for (hdr in hdrs) {
					var val = hdrs[hdr];
					l.push(hdr + ": " + val);
				}
				return l.join("<br>");
		}
		
		http_reqs.forEach(function(req) {
			self.draw_http_message('req', y, req[0], req[1],
				req[2].method + " " + req[2].url + " HTTP/" + req[2].http_version + 
				"<br>" + show_hdrs(req[2].headers)
			);

			var url = "http://" + req[2].headers.Host + req[2].url;
			self.urls[url] = [req[0], self.http_msg_y(y, 'req')];

			var ref = req[2].headers.Referer;
			if (ref) {
				(self.refs[ref] = self.refs[ref] || []).push([req[0], self.http_msg_y(y, 'req')]);
			}	
		});

		http_ress.forEach(function(res) {
			self.draw_http_message('res', y, res[0], res[1],
				"HTTP/" + res[2].http_version + " " + res[2].status_code + "<br>" +
				show_hdrs(res[2].headers)
			);
		});
	},

	http_msg_y: function(y, msg_type) {
		return msg_type == 'req' ?
			(y - (conn_w / 2) - (http_w / 2)) :
			(y + (conn_w / 2) + (http_w / 2))		
	},

  draw_conn: function(conn_start, conn_end, y) {
		var self = this;
		self.paper.line(
			[conn_start, y], [conn_end, y]
		).attr({
			"stroke": "#ddd",
			"stroke-width": conn_w,
			"opacity": "0.5",
		});
  },

  // search backwards through a list of packets and find where a http message
  // really started. This is imprecise, but should be OK most of the time.
  rewind_packets: function(packets, msg) {
    var bytes = [
        msg.method || "",
        msg.url || "",
        msg.status_code || "", // don't have access to phrase :(
        " HTTP/1.x", // works out the same for request or response
        "\r\n"
    ]
    for (h in msg.headers) {
      bytes.push(h + ": " + msg.headers[h] + "\r\n");
    }
    bytes.push("\r\n");
    var num_bytes = bytes.join("").length;
    console.log("looking for " + num_bytes + " bytes.");
    var bytes_seen = 0;
    for (var i = packets.length - 1; i >= 0; i--) {
      var packet = packets[i];
      bytes_seen += packet.details.data_sz;
      console.log("... " + bytes_seen + " seen...");
      if (bytes_seen >= num_bytes) {
        console.log("... and decided on " + packet.time);
        return packet.time;
      }
    }
  },

	draw_packet: function(item, y) {
		var self = this;
		var my_x = self.time_x(item.time);
		var pkt_e = self.paper.line(
			[my_x, y],
			[my_x, item.what == 'packet-in' ? y + (conn_w / 2) : y - (conn_w / 2)]
		).attr({
			"stroke-width": "1",
			"stroke": "yellow",
		});
		self.hover(pkt_e, 
			"<table>" +
			"<tr>" + 
			"<td class='" + (item.details.flags.syn ? "on" : "off") + "'>SYN</td>" +
			"<td class='" + (item.details.flags.ack ? "on" : "off") + "'>ACK</td>" +
			"<td class='" + (item.details.flags.rst ? "on" : "off") + "'>RST</td>" +
			"<td class='" + (item.details.flags.fin ? "on" : "off") + "'>FIN</td>" +
			"</tr>" +
			"</table>" +
			"<ul>" + 
			"<li>window size: " + item.details.ws + "</li>" +
			"<li>data bytes: " + item.details.data.length + "</li>" +
			"</ul>" +
			"<pre>" + item.details.data + "</pre>"
		);
	},

	draw_http_message: function(msg_type, y, start, end, details) {
			var msg_y = self.http_msg_y(y, msg_type);
			var msg_e = self.paper.line([start, msg_y], [end, msg_y]).attr({
				"stroke": "red",
				"stroke-linecap": "round", 
				"stroke-width": "" + http_w,
				"fill": "red",
				"opacity": ".6",
			});
			self.hover(msg_e, details);		
	},

	hover: function(e, html) {
		e.hover(function(event) {
			self.msg.innerHTML = html;
		}, function(event) {
			self.msg.innerHTML = "";
		});
	},

	draw_refs: function() {
		var self = this;
		for (ref in self.refs) {
			if (self.urls[ref]) {
				self.refs[ref].forEach(function(s) {
					self.paper.curve(self.urls[ref], s).attr({
						"stroke": "#ccf",
						"stroke-width": "1",
						"opacity": "0.3",
					});
				});
			}
		}
	},

	draw_bookends: function(y) {
		var self = this;
		var start_x = self.time_x(self.start_time());
		var end_x = self.time_x(self.end_time());
		var a = {
			stroke: "#999",
			"stroke-width": "1"
		};
		self.paper.line([start_x, margin[0]], [start_x, y]).attr(a);
		self.paper.line([end_x, margin[0]], [end_x, y]).attr(a);
	},

	show: function(x) {
		if (x < 3) {
			return 3;
		}
		return x;
	},

	start_time: function () {
		self = this;
		if (self.first) {
			return self.first;
		}
		var f = undefined;
		for (server in self.conns) {
			for (connection in self.conns[server]) {
				var t = self.conns[server][connection][0].time;
				if (! f || (t < f)) {
					f = t;
				}
			}
		}
		self.first = f;
		console.log("start time: " + f);
		return f;
	},

	end_time: function () {
		self = this;
		if (self.last) {
			return self.last;
		}
		var l = undefined;
		for (server in self.conns) {
			for (connection in self.conns[server]) {
				var t = self.conns[server][connection].slice(-1)[0].time;
				if (! l || (t > l)) {
					l = t;
				}
			}
		}
		self.last = l;
		console.log("end time: " + l);
		return l;
	},

	time_x: function (t) {
		var delta = t - this.start_time();
		var pix = delta * pix_per_sec / 1000;
		var x = Math.min(margin[3] + pix, self.w - margin[1]);
		return x;
	},
	
	clear: function () {
		var self = this;
		self.conns = {};
		self.first = undefined;
		self.last = undefined;
		self.urls = {};
		self.refs = {};
		self.draw_trace();
		console.log('cleared.');
	},

	resize: function (w, h) {
		var self = this;
		self.w = w || self.w;
		self.h = h || self.h;
		console.log("resizing to " + self.w + " x " + self.h);
		self.paper.setSize(self.w, self.h);
	},

}


function start_capture() {
	console.log('starting capture...');
	htracr.clear();
	var req = get_req();
	req.onreadystatechange = function () {
		if (req.readyState == 4) {
			console.log('started.');
			jQuery("#start").hide();
			jQuery("#stop").show();
		}; 
	};
	req.open("POST", "/start", true);
	req.send("");
	return false;	
}

function stop_capture() {
	console.log('stopping capture...');
	var req = get_req();
	req.onreadystatechange = function () {
		if (req.readyState == 4) {
			update_state();
			console.log('stopped.');
			jQuery("#stop").hide();
			jQuery("#start").show();
		}; 
	};
	req.open("POST", "/stop", true);
	req.send("");
	return false;	
}

function update_state() {
	console.log('updating...');
	var req = get_req();
	req.onreadystatechange = function () {
		if (req.readyState == 4) {
			// FIXME: proper json parse, please!
			htracr.conns = eval("(" + req.responseText + ")");
			htracr.draw_trace();
			console.log('updated.');
		}; 
	};
	req.open("GET", "/conns", true);
	req.send("");
	return false;
}

function clear_state() {
	console.log('clearing...');
	var req = get_req();
	req.onreadystatechange = function () {
		if (req.readyState == 4) {
			htracr.clear();
		}; 
	};
	req.open("POST", "/clear", true);
	req.send("");
	return false;
}

function zoom(val) {
	console.log("zooming to " + val + "...");
	htracr.resize(htracr.w * val, htracr.h * val);
	htracr.paper.setZoom(val);
}

		
function get_req() {
	var req;
	if (window.XMLHttpRequest) {
		try {
		  req = new XMLHttpRequest();
		} catch(e) {
		  req = false;
		}
	} else if (window.ActiveXObject) {
		try {
		  req = new ActiveXObject("Microsoft.XMLHTTP");
		} catch(e) {
		  req = false;
		}
	}
	return req;
}
	
