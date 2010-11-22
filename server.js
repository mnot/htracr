var fs = require("fs")
var http = require('http')
var path = require("path")
var url = require("url")


// load static assets
function load(name, media_type) {
  return [fs.readFileSync("lib/" + name), media_type]
}
var static = {
  'raphael': load('raphael-min.js', 'application/javascript'),
  'jquery': load('jquery-min.js', 'application/javascript'),
  'jquery-ui': load('jquery-ui-min.js', 'application/javascript'),
  'jquery-ui-style': load('jquery-ui.css', 'text/css'),
  'htracr-style': load('htracr.css', 'text/css'),
  'htracr-client': load('htracr-client.js', "application/javascript"),
  'ui-icons_cccccc_256x240.png': load(
    'ui-icons_cccccc_256x240.png', "image/png"
  ),
  'ui-bg_inset-soft_25_000000_1x100.png': load(
    'ui-bg_inset-soft_25_000000_1x100.png', 'image/png'
  ),
  'ui-bg_glass_20_555555_1x400.png': load(
    'ui-bg_glass_20_555555_1x400.png', 'image/png'
  ),
  '': load('htracr.html', 'text/html'),
}
  
function req_done(request, response, htracr) {
  var path = url.parse(request.url).pathname
  var path_segs = path.split("/")
  path_segs.shift()
  var seg = path_segs.shift()
  switch (seg) {
    case 'start':
      htracr.start_capture()
      response.writeHead(200, {'content-type': 'text/plain'})
      response.end()
      break
    case 'stop':
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
      var conns = htracr.get_conns()
      if (conns != null) {
        response.writeHead(200, {
          'Content-Type': 'application/json'
        })
        response.end(JSON.stringify(conns))
      } else {
        response.writeHead(204, {
          'Content-Type': 'text/plain'
        })
        response.end()
      }
      break
    case 'packet':
      var packet_id = path_segs.shift()
      if (htracr.packets[packet_id]) {
        response.writeHead(200, {
          'Content-Type': 'application/json'
        })
        response.end(JSON.stringify({data: htracr.packets[packet_id]}))
      } else {
        response.writeHead(404, {
          'Content-Type': 'text/plain'
        })
        response.end()
      }
      break
    case 'stop':
      // FIXME: check method
      response.writeHead(204, {'content-type': 'text/plain'})
      response.end()
      break
    default:
      if (seg == 'images') {
        seg = path_segs.shift()
      }
      if (seg in static) {
        response.writeHead(200, {
          'Content-Type': static[seg][1],
          'Cache-Control': "max-age=7200"
        })
        response.end(static[seg][0])
      } else {
        response.writeHead(404, {'Content-Type': "text/html"})
        response.end("<html><body><h1>Not Found</h1></body></html>")
      }
      break
  }
}

exports.start = function(port, htracr) {
  http.createServer(function (request, response) {
    request.input_buffer = ""
    request.on('data', function(chunk) {
      request.input_buffer += chunk
    })
    request.on('end', function() {
      req_done(request, response, htracr)
    })
  }).listen(port)  
  console.log('Server running on port ' + port + '.')
}
  
