var path = require('path')
var assert = require('assert')
var crypto = require('crypto')

// 3rd party libraries
var {get} = require('koa-route')
var serve = require('koa-static')

// Custom libraries
var ui = require('./lib/ui')
var App = require('./lib/app')
var style = require('./lib/style')
var script = require('./lib/script')
var render = require('./lib/render')
var manifest = require('./lib/manifest')
var disk = require('./lib/disk')

module.exports = start

/**
 * Hash a buffer
 * @param {Buffer} buffer
 * @param {String} hash The hashing method to use, defaults to sha256
 * @param {String} digest The digestion-format in which to return the hast, defaults to base64
 * @returns {String} The hashed buffer
 */
function createHashFromBuffer (buffer, hash = 'sha256', digest = 'base64') {
  return encodeURIComponent(crypto.createHash(hash).update(buffer).digest(digest))
}

function start (entry, opts = {}) {
  assert(typeof entry === 'string', 'jalla: entry should be a string')
  entry = absolute(entry)

  var dir = path.dirname(entry)
  var sw = opts.sw && absolute(opts.sw, dir)
  var css = opts.css && absolute(opts.css, dir)
  var app = new App()
  app.entry = entry
  app.silent = true
  app.base = opts.base || ''
  app.context.script = {branches: {}}
  app.context.style = {branches: {}}

  app.on('bundle:script', function (file, buff) {

    let branch = {
      buffer: buff,
      hash: createHashFromBuffer(buff)
    }

    if (file === entry) {
      app.context.script.buffer = buff
      app.context.script.hash = createHashFromBuffer(buff)
    } else {
      let branch = app.context.script.branches[file] = {}
      branch.buffer = buff
      branch.hash = createHashFromBuffer(buff)
    }


  })
  app.on('bundle:style', function (file, buff) {
    app.context.style = {
      buffer: buff,
      hash: createHashFromBuffer(buff)
    }
  })

  if (!opts.quiet) ui(app)
  if (opts.disk) disk(app)

  app.use(async function (ctx, next) {
    var start = Date.now()
    await next()
    app.emit('timing', Date.now() - start, ctx)
  })

  app.use(require('koa-conditional-get')())
  app.use(require('koa-etag')())

  if (process.env.NODE_ENV !== 'development') {
    app.use(require('./lib/queue')(app))
  }

  if (sw) app.use(get(/^\/(?:sw|service-worker)\.js(\.map)?$/, script(sw, app)))
  app.use(get(/^\/(?:\w+\/)?bundle([-\w]+)?\.js(\.map)?$/, script(entry, app)))
  app.use(get(/^\/(?:\w+\/)?bundle\.css(\.map)?$/, style(css, app)))

  if (app.env === 'development') app.use(serve(dir, {maxage: 0}))
  app.use(serve(path.resolve(dir, 'assets'), {maxage: 1000 * 60 * 60 * 24 * 365}))
  app.use(get('/manifest.json', manifest(app)))

  app.use(render(entry, app))

  return app
}

function absolute (file, dir = '') {
  if (path.isAbsolute(file)) return file
  return path.resolve(dir, file)
}
