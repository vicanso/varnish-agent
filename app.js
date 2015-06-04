var _ = require('lodash');
var co = require('co');
var fs = require('fs');
var path = require('path');
var util = require('util');
var url = require('url');
var crypto = require('crypto');
var spawn = require('child_process').spawn;
var request = require('superagent');
var varnishBackendKey = 'backend';
var varnishKey = 'varnish';
var ectdKey = '';
var etcdServer = process.env.ETCD || 'etcd://127.0.0.1:4001';
var urlInfo = url.parse(etcdServer);
var currentVarnishVcl = '';
var checkInterval = 60 * 1000;
var varnishKeyTtl = 3600;
var varnishConfig = {};
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

/**
 * [createVcl 生成vcl文件]
 * @return {[type]} [description]
 */
function createVcl(){
  co(function *(){
    var serversList = yield getServers();
    serversList = sortServer(serversList);
    // 如果获取不到backend相关信息，不生成新的vcl
    if(serversList.length){
      var backendConfig = yield getBackendConfig(serversList);
      var initConfig = yield getInitConfig(serversList);
      var backendSelectConfig = getBackendSelectConfig(serversList);
      var vcl = yield getVcl({
        backendConfig : backendConfig,
        initConfig : initConfig,
        backendSelectConfig : backendSelectConfig,
        name : varnishConfig.name
      });
      if(currentVarnishVcl !== vcl){
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
 * [sortServer description]
 * @param  {[type]} serverList [description]
 * @return {[type]}            [description]
 */
function sortServer(serverList){
  var result = {};
  _.forEach(serverList, function(server){
    var name = server.name;
    if(!result[name]){
      result[name] = [];
    }
    result[name].push(server);
  });
  // 将有配置host的排在前面
  result = _.sortBy(_.values(result), function(list){
    return list[0].host? -1 : 1;
  });
  return result;
}


function getRandomName(){
  var arr = _.shuffle('abcdefghijklmnopqrstuvwxyz'.split(''));
  arr.length = 10;
  return arr.join('');
}

/**
 * [getBackendConfig 获取backend的配置]
 * @param  {[type]} serversList [description]
 * @return {[type]}             [description]
 */
function *getBackendConfig(serversList){
  var tpl = yield function(done){
    var file = path.join(__dirname, './template/backend.tpl');
    fs.readFile(file, 'utf8', done);
  };
  var template = _.template(tpl);
  var arr = [];
  _.forEach(serversList, function(serverList){
    _.forEach(serverList, function(server, i){
      var obj = _.pick(server, ['name', 'ip', 'port']);
      obj.name += i;
      try{
        arr.push(template(obj));
      }catch(err){
        console.error(err);
      }
    });
  });
  return arr.join('\n');
}


/**
 * [getInitConfig 获取init的配置]
 * @param  {[type]} serversList [description]
 * @return {[type]}             [description]
 */
function *getInitConfig(serversList){
  var tpl = yield function(done){
    var file = path.join(__dirname, './template/init.tpl');
    fs.readFile(file, 'utf8', done);
  };
  var template = _.template(tpl);
  var arr = [];
  _.forEach(serversList, function(serverList){
    var name = serverList[0].name;
    arr.push(util.format('new %s = directors.round_robin();', name));
    _.forEach(serverList, function(server, i){
      arr.push(util.format('%s.add_backend(%s);', name, name + i));
    });
  });
  _.forEach(arr, function(tmp, i){
    arr[i] = '  ' + tmp;
  });
  return template({
    directors : arr.join('\n')
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
 * [getVcl 获取varnish配置]
 * @return {[type]} [description]
 */
function *getVcl(data){
  var date = new Date();
  var str = '' + date.getFullYear();
  var md5 = crypto.createHash('md5');
  md5.update(JSON.stringify(data));
  var version = getDate() + ' ' + md5.digest('hex');
  data.version = version.toUpperCase();
  var tpl = yield function(done){
    var file = path.join(__dirname, './template/varnish.tpl');
    fs.readFile(file, 'utf8', done);
  };
  var template = _.template(tpl);
  return template(data);
}


/**
 * [getBackendSelectConfig 生成backend选择的规则]
 * @param  {[type]} serversList [description]
 * @return {[type]}             [description]
 */
function getBackendSelectConfig(serversList){
  var result = [];
  _.forEach(serversList, function(serverList){
    var server = serverList[0];
    var arr = [];
    if(server.host){
      arr.push(util.format('req.http.host == "%s"', server.host));
    }
    if(server.prefix){
      arr.push(util.format('req.url ~ "^%s"', server.prefix));
    }
    result.push({
      name : server.name,
      condition : arr.join(' && ')
    });
  });
  var total = result.length;
  var arr = [];
  _.forEach(result, function(item, i){
    if(i === 0){
      arr.push(util.format('if(%s){', item.condition));
    }else{
      arr.push(util.format('}elsif(%s){', item.condition));
    }
    arr.push(util.format('  set req.backend_hint = %s.backend();', item.name));
  });
  if(arr.length){
    arr.push('}');
    _.forEach(arr, function(tmp, i){
      arr[i] = '  ' + tmp;
    });
  }
  return arr.join('\n');
}


/**
 * [getServers 获取服务器列表]
 * @param  {[type]} serverList [description]
 * @return {[type]}            [description]
 */
function *getServers(){
  var result = yield function(done){
    var etcdUrl = util.format('http://%s:%s/v2/keys/%s', urlInfo.hostname, urlInfo.port, varnishBackendKey)
    request.get(etcdUrl).end(done)
  };
  var nodes = _.get(result, 'body.node.nodes');
  var list = [];
  _.forEach(nodes, function(node){
    list.push(node.value);
  });
  var backendList = [];
  _.forEach(_.uniq(list), function(v){
    try{
      var tmp = JSON.parse(v);
      if(tmp.category === 'web'){
        backendList.push(tmp);
      }
    }catch(err){
      console.error(err);
    }
  });
  return backendList;
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
    .send('ttl=' + varnishKeyTtl)
    .end(function(err, res){
      if(err){
        console.error(err);
      }
      setTimeout(postVarnishConfig, 600 * 1000);
    });
}

