'use strict';
const setting = require('./setting');
const co = require('co');
const crc32 = require('buffer-crc32');
const varnish = require('./lib/varnish');
const consul = require('./lib/consul');
const stats = require('./lib/stats');
const fs = require('fs');
const spawn = require('child_process').spawn;
const server = require('./lib/server');
const debug = require('debug')('jt:varnish');
var registered = false;
setTimeout(createVcl, 5000);
server.start();


/**
 * [createVcl 生成vcl文件]
 * @param  {[type]} currentVersion [description]
 * @return {[type]}                [description]
 */
function createVcl(currentVersion) {
  let timer;

  function finished() {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(function() {
      timer = 0;
      createVcl(currentVersion);
    }, 60 * 1000);
  }
  co(function*() {
    let serversList = yield varnish.getBackends();
    let config = yield varnish.getConfig(serversList);
    debug('varnish config:%j', config);
    if (config) {
      let version = crc32.unsigned(JSON.stringify(config));
      if (currentVersion !== version) {
        let date = (new Date()).toISOString();
        config.version = date + ' ' + version;
        config.name = process.env.HOSTNAME || 'unknown';
        config.serversDesc = varnish.getServersDesc(serversList);
        let vcl = yield varnish.getVcl(config);
        debug('varnish vcl:%s', vcl);
        let file = '/tmp/' + date + '.vcl';
        let result = fs.writeFileSync(file, vcl);
        if (!result) {
          yield changeVcl(date, file);
          setting.addVclFile(file);
          currentVersion = version;
          if (!registered) {
            yield consul.register();
            registered = true;
          }

        }
      }
    }
    finished();
  }).catch(function(err) {
    console.error(err);
    finished();
  });
}


/**
 * [changeVcl description]
 * @param  {[type]} tag  [description]
 * @param  {[type]} file [description]
 * @return {[type]}      [description]
 */
function* changeVcl(tag, file) {
  /**
   * [loadVcl 加载vcl]
   * @param  {[type]} tag  [description]
   * @param  {[type]} file [description]
   * @return {[type]}      [description]
   */
  function loadVcl(tag, file) {
    return new Promise(function(resolve, reject) {
      let cmd = spawn('varnishadm', ['vcl.load', tag, file]);
      cmd.on('error', function(err) {
        console.error(err);
      });
      cmd.on('close', function(code) {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
      cmd.stdout.on('data', function(msg) {
        console.log(msg.toString());
      });
      cmd.stderr.on('data', function(msg) {
        console.error(msg.toString());
      });
    });
  }

  /**
   * [useVcl 激活vcl]
   * @param  {[type]} tag [description]
   * @return {[type]}     [description]
   */
  function useVcl(tag) {
    return new Promise(function(resolve, reject) {
      let cmd = spawn('varnishadm', ['vcl.use', tag]);
      cmd.on('error', function(err) {
        console.error(err);
      });
      cmd.on('close', function(code) {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
      cmd.stdout.on('data', function(msg) {
        console.log(msg.toString());
      });
      cmd.stderr.on('data', function(msg) {
        console.error(msg.toString());
      });
    });
  }

  yield loadVcl(tag, file);
  yield useVcl(tag);
}
