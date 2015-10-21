'use strict';

var fs = require('fs')
  , url = require('url')
  , path = require('path')
  , Primus = require('primus')
  , counts = +process.env.COUNTS || 0
  , debug = require('diagnostics')('woohoo:service')
  , serve = require('serve-static')(path.join(__dirname, 'public'))
  , website = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

/**
 * Generate the default WooHoo server.
 *
 * @param {Number} port Port number
 * @returns {Server}
 * @api private
 */
function create(port) {
  return require('http').createServer(function incoming(req, res) {
    middleware(req, res, function hollaback() {
      res.statusCode = 404;
      res.end('Not found');
    });
  }).listen(port);
}

/**
 * Middleware for serving the required page.
 *
 * @param {Request} req Incoming HTTP request
 * @param {Response} res Outgoing HTTP response
 * @param {Function} next Continue to the next middleware
 * @api public
 */
function middleware(req, res, next) {
  var pathname = url.parse(req.url).pathname;

  if (!/^\/woohoo/.test(pathname)) return next();

  //
  // Hack, slice of `woohoo` so static service isn't starting to look for
  // a woohoo folder in our public folder.
  //
  if ('/woohoo' !== req.url) req.url = req.url.slice(7);

  serve(req, res, function handled(err) {
    var body = website.replace('%count%', counts);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.end(body);
  });
}

/**
 * Establish a woohoo server.
 *
 * @param {Number|HTTP} app Port number or HTTP server to mount upon.
 * @returns {Primus} the established primus server.
 * @api public
 */
function woohoo(app) {
  if ('number' === typeof app) app = create(app);

  var primus = new Primus(app, require('./primus.json'))
    , wavs = fs.readdirSync(path.join(__dirname, 'public', 'wav'));

  primus.on('connection', function connection(spark) {
    debug('received connection');

    spark.on('data', function data(payload) {
      if (!payload.play || !~wavs.indexOf(payload.play +'.wav')) return;

      primus.write({ play: payload.play, count: ++counts });
    });
  });

  return primus;
}

//
// Expose components.
//
woohoo.middleware = middleware;
module.exports = woohoo;

//
// Autostart server on port, for testing purposes.
//
if (require.main && require.main.exports === module.exports) {
  woohoo(+process.env.PORT || 8080);
}
