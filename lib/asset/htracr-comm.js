if (! window.console) {
  window.console = {
    log: function log (msg) {}
  };
}

if (! htracr) {
  var htracr = {};
}

// server-side interactions
htracr.comm = function () {
	var comm = {
		// start capturing a session
		start_capture: function () {
			var self = this;
			console.log('starting capture...');
			var req = get_req();
			req.onreadystatechange = function start_capture_response () {
				if (req.readyState === 4) {
					if (req.status == 200) {
						console.log('started.');
						jQuery("#start").hide();
						jQuery("#stop").show();
					  htracr.ui.pulse_logo();
					} else {
						var error = eval("(" + req.responseText + ")");
						alert("Sorry, I can't start the sniffer; it says \"" +
						  error.message + "\"."
						);
						console.log("start problem: " + error);
					}
				}
			};
			req.open("POST", "/start", true);
			req.send("");
			return false;
		},

		// finish capturing a session
		stop_capture: function () {
			var self = this;
			console.log('stopping capture...');
			var req = get_req();
			req.onreadystatechange = function stop_capture_response () {
				if (req.readyState === 4) {
					self.update_state();
					console.log('stopped.');
					jQuery("#stop").hide();
					jQuery("#start").show();
          htracr.ui.unpulse_logo(true);
				}
			};
			req.open("POST", "/stop", true);
			req.send("");
			return false;
		},

		// get the latest capture info from the server
		update_state: function () {
			var self = this;
			console.log('updating...');
			var req = get_req();
			req.onreadystatechange = function update_state_response () {
				if (req.readyState === 4) {
					if (req.status === 200) {
						var capture = JSON.parse(req.responseText);
						if (capture.error) {
							alert(capture.error.message);
						}
						htracr.ui.update(capture);
						console.log('updated.');
					} else {
					  console.log('no updates.');
					}
				}
			};
			req.open("GET", "/conns", true);
			req.send("");
			return false;
		},

		// remove capture info from the server
		clear_state: function () {
			var self = this;
			console.log('clearing...');
			var req = get_req();
			req.onreadystatechange = function clear_state_response () {
				if (req.readyState === 4) {
					htracr.ui.clear();
				}
			};
			req.open("POST", "/clear", true);
			req.send("");
			return false;
		},

		// get the list of server names    
		get_servers: function () {
			var self = this;
			console.log('getting servers...');
			var req = get_req();
			req.onreadystatechange = function get_servers_response () {
				if (req.readyState === 4) {
					htracr.ui.server_names = JSON.parse(req.responseText);
				}
			};
			req.open("GET", "/servers", false);
			req.send("");
		},
		
		// get a packet
		get_packet: function (packet_id) {
      var req = get_req();
      var data;
      htracr.ui.packet_data = undefined;
      req.onreadystatechange = function packet_fetch () {
        if (req.readyState === 4 && req.status === 200) {
          data = jQuery('<div/>').text(
            JSON.parse(req.responseText).data
          ).html();
        }
      };
      // TODO: catch network errors.
      req.open("GET", "/packet/" + packet_id, false);
      req.send("");
      return data;
		}
	};


	// utility function for XHR
	function get_req () {
		var self = this;
		var req;
		if (window.XMLHttpRequest) {
			try {
				req = new XMLHttpRequest();
			} catch(e1) {
				req = false;
			}
		} else if (window.ActiveXObject) {
			try {
				req = new ActiveXObject("Microsoft.XMLHTTP");
			} catch(e2) {
				req = false;
			}
		}
		return req;
	}

	return comm;
}();
