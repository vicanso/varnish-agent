var _ = require('lodash');
var co = require('co');
var fs = require('fs');
var util = require('util');
var url = require('url');
var crc32 = require('buffer-crc32');
var spawn = require('child_process').spawn;
var request = require('superagent');
var debug = require('debug')('jt.varnish');

var varnishKey = 'varnish';
var urlInfo = url.parse(process.env.ETCD || 'etcd://127.0.0.1:4001');
var currentVersion = '';
var checkInterval = 60 * 1000;
var varnishConfig = {};

var varnish = require('./lib/varnish');

if(process.env.VARNISH){
  var varnishUrlInfo = url.parse(process.env.VARNISH);
  varnishConfig.ip = varnishUrlInfo.hostname;
  varnishConfig.port = varnishUrlInfo.port;
  if(varnishUrlInfo.pathname){
    varnishConfig.name = varnishUrlInfo.pathname.substring(1);
  }
}
if(!varnishConfig.name){
  varnishConfig.name = getRandomName();
}
setTimeout(createVcl, checkInterval);
postVarnishConfig();
initServer();
/**
 * [createVcl 生成vcl文件]
 * @return {[type]} [description]
 */
function createVcl(){
  co(function *(){
    var serversList = yield varnish.getServers(urlInfo);
    var config = yield varnish.getConfig(serversList);
    debug('varnish config:%j', config);
    if(config){
      var version = crc32.unsigned(JSON.stringify(config));
      if(currentVersion !== version){
        currentVersion = version;
        config.version = getDate() + ' ' + version;
        config.name = varnishConfig.name;
        config.serversDesc = varnish.getServersDesc(serversList);
        var vcl = yield varnish.getVcl(config);
        debug('varnish vcl:%s', vcl);
        var result = fs.writeFileSync('/etc/varnish/default.vcl', vcl);
        if(!result){
          currentVarnishVcl = vcl;
          var cmd = spawn('service', ['varnish', 'reload']);
          cmd.on('error', function(err){
            console.error(err);
          });
        }
      }
    }
    setTimeout(createVcl, checkInterval);
  }).catch(function(err){
    console.error(err);
    setTimeout(createVcl, checkInterval);
  });
}


/**
 * [getRandomName 随机生成名字]
 * @return {[type]} [description]
 */
function getRandomName(){
  var arr = _.shuffle('abcdefghijklmnopqrstuvwxyz'.split(''));
  arr.length = 10;
  return arr.join('');
}


/**
 * [getDate 获取日期字符串，用于生成版本号]
 * @return {[type]} [description]
 */
function getDate(){
  var date = new Date();
  var month = date.getMonth() + 1;
  if(month < 10){
    month = '0' + month;
  }
  var day = date.getDate();
  if(day < 10){
    day = '0' + day;
  }
  var hours = date.getHours();
  if(hours < 10){
    hours = '0' + hours;
  }
  var minutes = date.getMinutes();
  if(minutes < 10){
    minutes = '0' + minutes;
  }
  var seconds = date.getSeconds();
  if(seconds < 10){
    seconds = '0' + seconds;
  }
  return '' + date.getFullYear() + '-' + month + '-' + day + 'T' + hours + ':' + minutes + ':' + seconds; 
}


/**
 * [postVarnishConfig 将varnish的配置信息发送到etcd中]
 * @return {[type]} [description]
 */
function postVarnishConfig(){
  var etcdUrl = util.format('http://%s:%s/v2/keys/%s/%s', urlInfo.hostname, urlInfo.port, varnishKey, varnishConfig.name);
  var data = _.clone(varnishConfig);
  if(!data.ip || !data.port){
    console.error('ip and port can not be null');
    return;
  }
  request.put(etcdUrl)
    .send('value=' + JSON.stringify(data))
    .send('ttl=' + 3600)
    .timeout(3000)
    .end(function(err, res){
      if(err){
        console.error(err);
      }
      setTimeout(postVarnishConfig, 600 * 1000);
    });
}


/**
 * [initServer 初始化http server]
 * @return {[type]} [description]
 */
function initServer(){
  var http = require('http');
  http.createServer(function(req, res){
    if(req.url === '/v-vcl'){
      fs.readFile('/etc/varnish/default.vcl', 'utf8', function(err, vcl){
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
        var stats = require('./lib/stats');
        var data = yield stats.get();
        res.writeHead(200, {
          'Content-Type' : 'application/json; charset=utf-8',
          'Cache-Control' : 'public, max-age=5'
        });
        res.end(JSON.stringify(data));
      }).catch(function(err){
        res.writeHead(500);
        res.end(err.message);
      });
    }else{
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('OK');
    }
  }).listen(10000);
}


