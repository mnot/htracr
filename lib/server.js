var fs = require("fs")
var http = require('http')
var path = require("path")
var url = require("url")
var formidable = require('formidable')

// load assets
function load(name, media_type) {
  return [fs.readFileSync(__dirname + "/asset/" + name), media_type]
}
var assets = {
  'raphael': load('raphael-min.js', 'application/javascript'),
  'g.raphael': load('g.raphael-min.js', 'application/javascript'),
  'jquery': load('jquery-min.js', 'application/javascript'),
  'jquery-ui': load('jquery-ui-min.js', 'application/javascript'),
  'jquery-ui-style': load('jquery-ui.css', 'text/css'),
  'htracr-style': load('htracr.css', 'text/css'),
  'htracr-ui': load('htracr-ui.js', "application/javascript"),
  'htracr-data': load('htracr-data.js', "application/javascript"),
  'htracr-comm': load('htracr-comm.js', "application/javascript"),
  'ui-icons_cccccc_256x240.png': load(
    'ui-icons_cccccc_256x240.png', "image/png"
  ),
  'ui-bg_inset-soft_25_000000_1x100.png': load(
    'ui-bg_inset-soft_25_000000_1x100.png', 'image/png'
  ),
  'ui-bg_glass_20_555555_1x400.png': load(
    'ui-bg_glass_20_555555_1x400.png', 'image/png'
  ),
  'ui-bg_glass_40_0078a3_1x400.png': load(
    'ui-bg_glass_40_0078a3_1x400.png', 'image/png'
  ),
  'ui-bg_inset-soft_30_f58400_1x100.png': load(
    'ui-bg_inset-soft_30_f58400_1x100.png', 'image/png'
  ),
  '': load('htracr.html', 'text/html')
}

function req_done(request, response, htracr) {
  var path = url.parse(request.url).pathname
  var path_segs = path.split("/")
  path_segs.shift()
  var seg = path_segs.shift()
  switch (seg) {
    case 'start':
      // FIXME: check method
      try {
        htracr.start_capture()
      } catch (e) {
        response.writeHead(500, {'content-type': 'text/plain'})
        response.end(JSON.stringify(e))
        return
      }
      response.writeHead(200, {'content-type': 'text/plain'})
      response.end()
      break
    case 'stop':
      // FIXME: check method
      htracr.stop_capture()
      response.writeHead(200, {'content-type': 'text/plain'})
      response.end()
      break
    case 'clear':
      // FIXME: check method
      htracr.clear()
      response.writeHead(200, {'content-type': 'text/plain'})
      response.end()
      break
    case 'conns':
      if (htracr.captured_packets > 0) {
        response.writeHead(200, {'content-type': 'application/json'})
        response.end(JSON.stringify(htracr.capture))
      } else {
        response.writeHead(204, {'content-type': 'text/plain'})
        response.end()
      }
      break
    case 'servers':
      response.writeHead(200, {
        'Content-Type': 'application/json'
      })
      response.end(JSON.stringify(htracr.server_names))
      break
    case 'packet':
      var packet_id = path_segs.shift()
      if (htracr.packets[packet_id]) {
        response.writeHead(200, {
          'Content-Type': 'application/json'
        })
        response.end(JSON.stringify({data: htracr.packets[packet_id]}))
      } else {
        response.writeHead(204, {
          'Content-Type': 'text/plain'
        })
        response.end()
      }
      break
    default:
      if (seg == 'images') {
        seg = path_segs.shift()
      }
      if (seg in assets) {
        response.writeHead(200, {
          'Content-Type': assets[seg][1],
          'Cache-Control': "max-age=7200"
        })
        response.end(assets[seg][0])
      } else {
        response.writeHead(404, {'Content-Type': "text/html"})
        response.end("<html><body><h1>Not Found</h1></body></html>")
      }
      break
  }
}

exports.start = function(port, htracr) {
  http.createServer(function (request, response) {
    // special case for uploads
    if (request.url == "/upload" && request.method == "POST") {
      htracr.clear()
      var form = new formidable.IncomingForm()
      form.parse(request, function(e, fields, files) {
        if (e) {
          console.log("Incoming form error: " + e)
          response.writeHead(500, {'content-type': 'text/plain'})
          htracr.err = e
          response.end()
          return
        }
        try {
          htracr.load_file(files.pcap.path)
        } catch (e) {
          console.log("Upload processing error: " + e)
          htracr.err = e
          response.end()
          return
        }
        response.writeHead(303, {
          'content-type': 'text/plain',
          'location': '/'
        })
        response.end('received upload.')
      })
    } else { // everything else
      request.input_buffer = ""
      request.on('data', function(chunk) {
        request.input_buffer += chunk
      })
      request.on('end', function() {
        req_done(request, response, htracr)
      })
    }

  }).listen(port)
  console.log('Server running on port ' + port + '.')
}

