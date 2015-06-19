var _ = require('lodash');
var co = require('co');
var fs = require('fs');
var util = require('util');
var url = require('url');
var crc32 = require('buffer-crc32');
var spawn = require('child_process').spawn;
var request = require('superagent');
var debug = require('debug')('jt.varnish');
var varnish = require('./lib/varnish');

if(!validateEnv()){
  return;
}
setTimeout(function(){
  createVcl();
}, 1000);
postVarnishConfig();
initServer();

/**
 * [createVcl 生成vcl文件]
 * @return {[type]} [description]
 */
function createVcl(currentVersion){
  var timer;
  var finished = function(){
    if(timer){
      clearTimeout(timer);
    }
    timer = setTimeout(function(){
      timer = 0;
      createVcl(currentVersion);
    }, 60 * 1000);
  };
  co(function *(){
    var urlInfo = getEtcd();
    var serversList = yield varnish.getServers(urlInfo);
    var config = yield varnish.getConfig(serversList);
    debug('varnish config:%j', config);
    if(config){
      var version = crc32.unsigned(JSON.stringify(config));
      if(currentVersion !== version){
        config.version = getDate() + ' ' + version;
        config.name = process.env.NAME;
        config.serversDesc = varnish.getServersDesc(serversList);
        var vcl = yield varnish.getVcl(config);
        debug('varnish vcl:%s', vcl);
        var result = fs.writeFileSync('/etc/varnish/default.vcl', vcl);
        if(!result){
          var cmd = spawn('service', ['varnish', 'reload']);
          cmd.on('error', function(err){
            console.error(err);
          });
          cmd.on('close', function(code){
            if(code === 0){
              currentVersion = version;
            }
          });
        }
      }
    }
    finished();
  }).catch(function(err){
    console.error(err);
    finished();
  });
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
  var name = process.env.NAME;
  var key = process.env.VARNISH_KEY;
  var urlInfo = getEtcd();
  var etcdUrl = util.format('http://%s:%s/v2/keys/%s/%s', urlInfo.hostname, urlInfo.port, key, name);
  var varnishUrlInfo = url.parse(process.env.VARNISH);
  var data = {
    ip : varnishUrlInfo.hostname,
    port : varnishUrlInfo.port,
    name : name
  };
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
          'Cache-Control' : 'must-revalidate, max-age=0'
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

/**
 * [validateEnv 校验env的合法性]
 * @return {[type]} [description]
 */
function validateEnv(){
  var env = process.env;
  var keys = 'ETCD VARNISH NAME VARNISH_KEY BACKEND_KEY'.split(' ');
  var fail = false;
  _.forEach(keys, function(key){
    if(!env[key]){
      fail = true;
    }
  });
  if(fail){
    console.error('参数：' + keys.join(',') + '均不能为空！');
    return false;
  }
  return true;
}


function getEtcd(){
  return url.parse(process.env.ETCD);
}
