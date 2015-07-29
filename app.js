'use strict';
const co = require('co');
const crc32 = require('buffer-crc32');
const etcd = require('./lib/etcd');
const varnish = require('./lib/varnish');
const stats = require('./lib/stats');
const fs = require('fs');
const spawn = require('child_process').spawn;
etcd.url = process.env.ETCD || 'http://localhost:4001';
const etcdKey = process.env.BACKEND_KEY || 'varnish-backends';
const secretPwd = process.env.PASSWORD;
const debug = require('debug')('jt:varnish');
let currentVclFile;
initServer();
setTimeout(createVcl, 5000);
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
    timer = setTimeout(function () {
      timer = 0;
      createVcl(currentVersion);
    }, 60 * 1000);
  }
  co(function *() {
    let serversList = yield varnish.getBackends(etcdKey);
    let config = yield varnish.getConfig(serversList);
    debug('varnish config:%j', config);
    if (config) {
      let version = crc32.unsigned(JSON.stringify(config));
      if (currentVersion !== version) {
        let date = getDate();
        config.version = date + ' ' + version + ' ' + etcdKey;
        config.name = process.env.NAME;
        config.serversDesc = varnish.getServersDesc(serversList);
        let vcl = yield varnish.getVcl(config);
        debug('varnish vcl:%s', vcl);
        let file = '/tmp/' + date + '.vcl';
        let result = fs.writeFileSync(file, vcl);
        if (!result) {
          yield changeVcl(date, file);
          currentVclFile = file;
          currentVersion = version;
        }
      }
    }
    finished();
  }).catch(function (err) {
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
function *changeVcl(tag, file) {
  /**
   * [loadVcl 加载vcl]
   * @param  {[type]} tag  [description]
   * @param  {[type]} file [description]
   * @return {[type]}      [description]
   */
  function loadVcl(tag, file) {
    return new Promise(function(resolve, reject) {
      let cmd = spawn('varnishadm', ['vcl.load', tag, file]);
      cmd.on('error', function (err) {
        console.error(err);
      });
      cmd.on('close', function (code) {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
      cmd.stdout.on('data', function (msg) {
        console.log(msg.toString());
      });
      cmd.stderr.on('data', function (msg) {
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
      cmd.on('error', function (err) {
        console.error(err);
      });
      cmd.on('close', function (code) {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
      cmd.stdout.on('data', function (msg) {
        console.log(msg.toString());
      });
      cmd.stderr.on('data', function (msg) {
        console.error(msg.toString());
      });
    });
  }

  yield loadVcl(tag, file);
  yield useVcl(tag);
}


/**
 * [getDate 获取日期字符串，用于生成版本号]
 * @return {[type]} [description]
 */
function getDate(){
  let date = new Date();
  let month = date.getMonth() + 1;
  if(month < 10){
    month = '0' + month;
  }
  let day = date.getDate();
  if(day < 10){
    day = '0' + day;
  }
  let hours = date.getHours();
  if(hours < 10){
    hours = '0' + hours;
  }
  let minutes = date.getMinutes();
  if(minutes < 10){
    minutes = '0' + minutes;
  }
  let seconds = date.getSeconds();
  if(seconds < 10){
    seconds = '0' + seconds;
  }
  return '' + date.getFullYear() + '-' + month + '-' + day + 'T' + hours + ':' + minutes + ':' + seconds;
}



/**
 * [initServer 初始化http server]
 * @return {[type]} [description]
 */
function initServer(){
  const http = require('http');
  const url = require('url');
  const querystring = require('querystring');
  http.createServer(function(req, res){
    let urlInfo = url.parse(req.url);
    let pwd;
    if (urlInfo.query) {
      pwd = querystring.parse(urlInfo.query).pwd;
    }
    if (secretPwd && pwd !== secretPwd) {
      res.writeHead(403);
      res.end('password is wrong');
      return;
    }
    if(req.url === '/v-vcl'){
      fs.readFile(currentVclFile, 'utf8', function(err, vcl){
        if(err){
          vcl = 'can not get vcl';
        }
        res.writeHead(200, {
          'Content-Type' : 'text/plain; charset=utf-8',
          'Cache-Control' : 'must-revalidate, max-age=0'
        });
        res.end(vcl);
      });
    }else if(req.url === '/v-stats'){
      co(function *(){
        let stats = require('./lib/stats');
        let data = yield stats.get();
        res.writeHead(200, {
          'Content-Type' : 'application/json; charset=utf-8',
          'Cache-Control' : 'must-revalidate, max-age=0'
        });
        res.end(JSON.stringify(data));
      }).catch(function(err){
        res.writeHead(500);
        res.end(err.message);
      });
    }else{
      res.writeHead(200, {'Content-Type': 'text/plain', 'Cache-Control': 'must-revalidate, max-age=0'});
      res.end('OK');
    }
  }).listen(10000);
}
