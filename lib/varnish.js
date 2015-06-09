var util = require('util');
var varnishBackendKey = 'backend';
var request = require('superagent');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');

exports.getServers = getServers;
exports.getConfig = getConfig;
exports.getServersDesc = getServersDesc;
exports.getVcl = getVcl;

/**
 * [getConfig 获取varnish配置]
 * @param  {[type]} serverList [description]
 * @return {[type]}            [description]
 */
function *getConfig(serversList){
  if(!serversList || !serversList.length){
    return;
  }
  var backendConfig = yield getBackendConfig(serversList);
  var initConfig = yield getInitConfig(serversList);
  var backendSelectConfig = getBackendSelectConfig(serversList);
  return {
    backendConfig : backendConfig,
    initConfig : initConfig,
    backendSelectConfig : backendSelectConfig
  };

}

/**
 * [getServers 获取服务器列表]
 * @param  {[type]} serverList [description]
 * @return {[type]}            [description]
 */
function *getServers(urlInfo){
  var result = yield function(done){
    var etcdUrl = util.format('http://%s:%s/v2/keys/%s', urlInfo.hostname, urlInfo.port, varnishBackendKey)
    request.get(etcdUrl).timeout(3000).end(done)
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
  return sortServer(backendList);
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



/**
 * [getBackendConfig 获取backend的配置]
 * @param  {[type]} serversList [description]
 * @return {[type]}             [description]
 */
function *getBackendConfig(serversList){
  var tpl = yield function(done){
    var file = path.join(__dirname, '../template/backend.tpl');
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
    var file = path.join(__dirname, '../template/init.tpl');
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
 * [getVcl 获取varnish配置]
 * @return {[type]} [description]
 */
function *getVcl(data){
  var tpl = yield function(done){
    var file = path.join(__dirname, '../template/varnish.tpl');
    fs.readFile(file, 'utf8', done);
  };
  var template = _.template(tpl);
  return template(data);
}



/**
 * [getServersDesc description]
 * @param  {[type]} serversList [description]
 * @return {[type]}            [description]
 */
function getServersDesc(serversList){
  if(!serversList || !serversList.length){
    return '';
  }
  var keys = ['name', 'ip', 'port', 'host', 'prefix'];
  var result;
  _.forEach(serversList, function(serverList){
    result = _.map(serverList, function(server){
      var arr = [];
      _.forEach(keys, function(key){
        arr.push(server[key] || '');
      });
      return arr.join(',');
    });
  });
  return result.join('|');
}