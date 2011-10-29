if (! window.console) {
  window.console = {
    log: function log (msg) {}
  };
}

if (! htracr) {
  var htracr = {};
}

htracr.res_colours = {
  'text/html': "green",
  'text/css': "purple",
  'image/gif': "blue",
  'image/jpeg': "blue",
  'image/png': "blue",
  'application/json': "yellow",
  'application/xml': "yellow",
  'application/x-javascript': "yellow"
}

// An item of interest that will be rendered.
htracr.item = function (data) {

  // render the item
  data.draw = function (di, cursor) {
    var self = this;
    if (self.element) {
      delete self.element;
    }
    self.cursor = cursor;
    self.element = self._draw(di);
    self.element.orig_width = self.element.attr('stroke-width');
    self.element.orig_opacity = self.element.attr('opacity');
		self.element.click(function(event) {
			self.inspect();
			htracr.ui.selected = self;
		});
  };

  data.inspect = function () {
    var self = this;
    var msg = "";
    if (typeof self.element.html_msg === 'function') {
      msg = self.element.html_msg();
    } else if (self.element.html_msg) {
      msg = self.element.html_msg;
    }
    if (htracr.ui.selected) {
      htracr.ui.selected.uninspect();
    }
    htracr.ui.selected = self;
    htracr.ui.set_message(msg);
    self.element.attr({'opacity': "1"});
    self.element.animate({
      'stroke-width': self.element.orig_width + 3
      }, 50,
      function () {
        self.element.animate({
          'stroke-width': self.element.orig_width
        }, 50);
      }
    );
  };

  data.uninspect = function () {
    var self = this;
    htracr.ui.set_message("");
    self.element.attr({'opacity': self.element.orig_opacity});
    htracr.ui.selected = undefined;
  };

  // make sure start and end are set.
  if (! data.start) {
    data.start = htracr.ui.capture_idx.start;
  }
  if (! data.end) {
    data.end = htracr.ui.capture_idx.end;
  }

  data.getEndPoint = function (which) {
    var self = this;
    var offset;
    switch (which) {
      case -1: // start
        offset = 1;
        break;
      case 0:
        offset = (self.element.getTotalLength() - 1) / 2;
        break;
      case 1: // end
        offset = self.element.getTotalLength() - 1;
        break;
      default:
        console.log("unknown end " + which);
        offset = 1;
        break;
    }
    if (offset < 1) {
      offset = 1;
    }
    return this.element.getPointAtLength(offset);
  };

	return data;
};


htracr.connection = function(data) {
	var conn = htracr.item(data);

  conn._draw = function (di) {
    var self = this;
    var conn_e = di.h_line(self.start, self.end, 0, {
      "stroke": "#777",
      "stroke-width": htracr.ui.conn_size,
      "opacity": "0.6"
    });
    conn_e.html_msg = "<h4>Connection to " + di.server_name(conn.server)
    if (di.server_name != conn.server) {
      conn_e.html_msg += " (" + conn.server + ")";
    }
    conn_e.html_msg += "</h4>" +
      "<ul>" +
      "<li>Local port: " + conn.local_port + "</li>" +
      "<li>Duration: " +
      ((self.end - self.start) / 1000).toFixed(3) +
      " seconds</li>" +
      "<li>HTTP Requests: " + self.http_reqs.length + "</li>" +
      "</ul>";
      return conn_e;
  };
	return conn;
};


htracr.packet = function(data) {
	var packet = htracr.item(data);

	packet._draw = function (di) {
    var self = this;

    // what kind of packet am I?
    var len;
    var direction;
    switch (self.dir) {
      case "in":
        len = htracr.ui.conn_size / 2;
        direction = "&lt;";
        break;
      case "out":
        len = - (htracr.ui.conn_size / 2);
        direction = "&gt;";
        break;
      default:
        console.log("Unrecognised packet dir: " + self.dir);
        break;
    }

    // determine the packet colour
    var pcolour = '#bbb';
    if (self.data_sz > 0)
      pcolour = '#ccc';
    if (self.flags.psh)
      pcolour = 'green';
    if (self.flags.syn)
      pcolour = 'yellow';
    if (self.flags.rst)
      pcolour = 'blue';
    if (self.flags.fin)
      pcolour = 'purple';

    var pkt_e = di.v_line(self.time, len, {
      "stroke-width":  htracr.ui.pix_per_sec <= 2500 ? "1" : "2",
      "stroke": pcolour,
      "shape-rendering": "crispEdges"
    });

    if (self.ack_only) {
      htracr.ui.ack_elements.push(pkt_e);
      if (! htracr.ui.show_ack_elements) {
        pkt_e.hide();
      }
    }

    pkt_e.html_msg = function () {
      var packet_data;
      if (self.data_sz) {
        packet_data = htracr.comm.get_packet(self.packet_id);
      }
      return "<table>" +
      "<tr>" +
      "<td class='" + (self.flags.syn ? "on" : "off") + "'> SYN </td>" +
      "<td class='" + (self.flags.ack ? "on" : "off") + "'> ACK </td>" +
      "<td class='" + (self.flags.rst ? "on" : "off") + "'> RST </td>" +
      "<td class='" + (self.flags.fin ? "on" : "off") + "'> FIN </td>" +
      "<td class='" + (self.flags.psh ? "on" : "off") + "'> PSH </td>" +
      "<td class='direction'> " + direction + " </td>" +
      "</tr>" +
      "</table>" +
      "<ul>" +
      "<li>window size: " + self.ws + "</li>" +
      "<li>data bytes: " + self.data_sz + "</li>" +
      "</ul>" +
      "<pre>" + (packet_data || "") + "</pre>";
    };

    return pkt_e;
  };

	return packet;
};



htracr.http_msg = function(data) {
	var msg = htracr.item(data);

	msg._draw = function (di) {
    var self = this;
    var a = {
      'fill': 'white',
      'opacity': '0.4',
      'font-size': '11'
    };

    var adj_y;
    var colour;
    switch (self.kind) {
      case "req":
        adj_y = - (htracr.ui.conn_size / 2) - (htracr.ui.msg_size / 2);
        di.save('referer', self.data.headers.Referer, self);
        var url = "http://" + self.data.headers.Host + self.data.url;
        di.save('request_uri', url, self, true);
        colour = "red";
        break;
      case "res":
        adj_y = (htracr.ui.conn_size / 2) + (htracr.ui.msg_size / 2);
        di.save('location', self.data.headers.Location, self, true);
        var ct = (self.data.headers['Content-Type'] || "").split(";", 1)[0];
        colour = htracr.res_colours[ct] || 'red';
        break;
      default:
        console.log("Unknown message type: " + this.kind);
        break;
    }

    var msg_e = di.h_line(self.start, self.end, adj_y, {
      "stroke": colour,
      "stroke-linecap": "round",
      "stroke-width": "" + htracr.ui.msg_size,
      "opacity": ".6"
    });

    var packet_count = 0;
    var byte_count = 0;
    var target_dir = self.kind === 'req' ? 'out' : 'in';

    var desc = "<h4>HTTP " + (self.kind === 'req' ? "Request" : "Response") +
           "</h4>" +
           "<ul>" +
           "<li>Data packets: " + self.data_packet_count + "</li>" +
           "<li>Data size: " + self.packet_byte_count + " bytes</li>" +
           "<li>Duration: " + (self.end - self.start).toFixed(1) + "ms</li>" +
           "</ul><pre>";

    if (self.kind === 'req') {
      desc += self.data.method + " " +
              self.data.url +
              " HTTP/" + self.data.http_version + "\n";
//      if (msg.data.method !== 'GET') {
//        self.paper.text(start_x + 20, msg_y - 10, msg.data.method).attr(a);
//      }
    } else {
      desc += "HTTP/" + msg.data.http_version + " " +
              msg.data.status_code + "\n";
//      if (msg.data.status_code !== 200) {
//        self.paper.text(
//          start_x + 16, msg_y + 10, msg.data.status_code
//        ).attr(a);
//      }
    }
    for (var hdr in msg.data.headers) {
      if (msg.data.headers.hasOwnProperty(hdr)) {
        var val = msg.data.headers[hdr];
        desc += hdr + ": " + val + "\n";
      }
    }
    desc += "</pre>";
    msg_e.html_msg = desc;
    return msg_e;
	};

	return msg;
};
