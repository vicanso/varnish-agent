'use strict';
require('./lib/logger');
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
const _ = require('lodash');
var registered = false;
setTimeout(createVcl, 5000);
server.start();
varnishd();


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
        }
      }
      if (!registered) {
        yield register();
        registered = true;
      }
    }
    finished();
  }).catch(function(err) {
    console.error(err);
    finished();
  });
}

/**
 * [varnishd description]
 * @return {[type]} [description]
 */
function varnishd() {
  if (process.env.DEBUG) {
    console.warn('debug mode, is not running varnishd');
    return;
  }
  let args = '-f /etc/varnish/default.vcl -s malloc,256m -a 0.0.0.0:80 -F'.split(
    ' ');
  let cmd = spawn('varnishd', args);
  cmd.on('error', function(err) {
    console.error(err);
  });
  cmd.on('close', function(code) {
    process.exit(code)
  });
  cmd.stdout.on('data', function(msg) {
    console.log(msg.toString());
  });
  cmd.stderr.on('data', function(msg) {
    console.error(msg.toString());
  });
}


/**
 * [register description]
 * @return {[type]} [description]
 */
function* register() {
  let hostName = process.env.HOSTNAME;
  let hosts = fs.readFileSync('/etc/hosts', 'utf8');
  // etc hosts中的ip都是正常的，因此正则的匹配考虑的简单一些
  let reg = new RegExp('((?:[0-9]{1,3}\.){3}[0-9]{1,3})\\s*' + hostName);
  let address = _.get(reg.exec(hosts), 1);
  if (!address) {
    throw new Error('can not get address');
  }
  let tags = setting.get('serviceTag').split(',');
  tags.push('http-ping');
  yield consul.register({
    id: hostName,
    service: 'varnish',
    address: address,
    port: 80,
    tags: _.uniq(tags)
  });
}


/**
 * [changeVcl description]
 * @param  {[type]} tag  [description]
 * @param  {[type]} file [description]
 * @return {[type]}      [description]
 */
function* changeVcl(tag, file) {
  if (process.env.DEBUG) {
    console.warn('debug mode, not change vcl file');
    return;
  }
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
