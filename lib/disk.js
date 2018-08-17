var fs = require('fs')
var util = require('util')
var path = require('path')
var shell = require('shelljs')

var writeFilePromise = util.promisify(fs.writeFile)

var BASE_PATH = process.cwd() + '/dist'

module.exports = disk

function disk (app) {
  app.on('bundle:script', async (filepath, buff) => {
    var filename = path.basename(filepath)
    var p = BASE_PATH + '/' + filename
    
    await writeToPath(p, buff).catch(err => {
      throw err
    })
  })
}

function removeFilenameFromPath (path) {
  return path.substring(0, path.lastIndexOf('/'))
}

/**
 * Create directories to match a path
 * @param {String} p An absolute path on the disk
 */
function makeDirsFromPath (p) {
  shell.mkdir('-p', p)
}

/**
 * Write data to a file at a path,
 * if path doesn't exist directories will be created
 * @param {String} p A path to a file to write the data to
 * @param {*} data  Data to write
 * @returns {Promise}
 */
function writeToPath (p, data) {
  return new Promise(async (resolve, reject) => {
    var writeErr = await writeFilePromise(p, data).catch(writeErr => writeErr)

    if (!writeErr) return resolve()

    if (writeErr.errno === -2) {
      makeDirsFromPath(removeFilenameFromPath(p))
      return writeToPath(p, data)
    } else {
      throw writeErr
    }
  })
}
