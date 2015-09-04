'use strict';
const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const util = require('util');
const debug = require('debug')('jt:varnish');
const consul = require('./consul');

exports.getBackends = getBackends;
exports.getConfig = getConfig;
exports.getServersDesc = getServersDesc;
exports.getVcl = getVcl;

/**
 * [getBackends 获取服务器列表]
 * @param  {[type]} key [description]
 * @return {[type]}     [description]
 */
function* getBackends(key) {
  // let type = setting.get('type');
  let arr = yield consul.getHttpBackends();
  _.forEach(arr, function(item) {
    item.name = _.camelCase(item.name);
  });
  debug('backend list:%j', arr);
  return sortServer(arr);
}


/**
 * [sortServer description]
 * @param  {[type]} serverList [description]
 * @return {[type]}            [description]
 */
function sortServer(serverList) {
  let result = {};
  _.forEach(serverList, function(server) {
    let name = server.name;
    if (!result[name]) {
      result[name] = [];
    }
    result[name].push(server);
  });
  // 将有配置host的排在前面
  result = _.values(result);
  result.sort(function(tmp1, tmp2) {
    let host1 = tmp1[0].host;
    let host2 = tmp2[0].host;
    let name1 = tmp1[0].name;
    let name2 = tmp2[0].name;
    if (host1 && !host2) {
      return -1;
    } else if (!host1 && host2) {
      return 1;
    } else if (name1 < name2) {
      return 1;
    } else if (name1 > name2) {
      return -1;
    } else {
      return 0;
    }
  });
  return result;
}


/**
 * [getConfig 获取varnish配置]
 * @param  {[type]} serverList [description]
 * @return {[type]}            [description]
 */
function* getConfig(serversList) {
  if (!serversList || !serversList.length) {
    return;
  }
  let backendConfig = yield getBackendConfig(serversList);
  let initConfig = yield getInitConfig(serversList);
  let backendSelectConfig = getBackendSelectConfig(serversList);
  return {
    backendConfig: backendConfig,
    initConfig: initConfig,
    backendSelectConfig: backendSelectConfig
  };
}

/**
 * [getBackendConfig 获取backend的配置]
 * @param  {[type]} serversList [description]
 * @return {[type]}             [description]
 */
function* getBackendConfig(serversList) {
  let tpl = yield readFilePromise(path.join(__dirname,
    '../template/backend.tpl'));
  let template = _.template(tpl);
  let arr = [];
  _.forEach(serversList, function(serverList) {
    _.forEach(serverList, function(server, i) {
      let obj = _.pick(server, ['name', 'ip', 'port']);
      obj.name += i;
      try {
        arr.push(template(obj));
      } catch (err) {
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
function* getInitConfig(serversList) {
  let tpl = yield readFilePromise(path.join(__dirname,
    '../template/init.tpl'));
  let template = _.template(tpl);
  let arr = [];
  _.forEach(serversList, function(serverList) {
    let name = serverList[0].name;
    arr.push(util.format('new %s = directors.random();', name));
    _.forEach(serverList, function(server, i) {
      arr.push(util.format('%s.add_backend(%s, %d);', name, name + i,
        server.weight || 1));
    });
  });
  _.forEach(arr, function(tmp, i) {
    arr[i] = '  ' + tmp;
  });
  return template({
    directors: arr.join('\n')
  });
}


/**
 * [getBackendSelectConfig 生成backend选择的规则]
 * @param  {[type]} serversList [description]
 * @return {[type]}             [description]
 */
function getBackendSelectConfig(serversList) {
  let result = [];
  _.forEach(serversList, function(serverList) {
    let server = serverList[0];
    let arr = [];
    if (server.host) {
      arr.push(util.format('req.http.host == "%s"', server.host));
    }
    if (server.prefix) {
      arr.push(util.format('req.url ~ "^%s"', server.prefix));
    }
    let condition = arr.join(' && ');
    if (condition) {
      result.push({
        name: server.name,
        condition: condition
      });
    }
  });
  let total = result.length;
  let arr = [];
  _.forEach(result, function(item, i) {
    if (i === 0) {
      arr.push(util.format('if(%s){', item.condition));
    } else {
      arr.push(util.format('}elsif(%s){', item.condition));
    }
    arr.push(util.format('  set req.backend_hint = %s.backend();', item.name));
  });
  if (arr.length) {
    arr.push('}');
    _.forEach(arr, function(tmp, i) {
      arr[i] = '  ' + tmp;
    });
  }
  return arr.join('\n');
}


/**
 * [getVcl 获取varnish配置]
 * @return {[type]} [description]
 */
function* getVcl(data) {
  let tpl = yield readFilePromise(path.join(__dirname,
    '../template/varnish.tpl'));
  let template = _.template(tpl);
  return template(data);
}


/**
 * [getServersDesc description]
 * @param  {[type]} serversList [description]
 * @return {[type]}            [description]
 */
function getServersDesc(serversList) {
  if (!serversList || !serversList.length) {
    return '';
  }
  let keys = ['name', 'ip', 'port', 'host', 'prefix'];
  let result = [];
  _.forEach(serversList, function(serverList) {
    _.forEach(serverList, function(server) {
      let arr = [];
      _.forEach(keys, function(key) {
        arr.push(server[key] || '');
      });
      result.push(arr.join(','));
    });
  });
  return result.join('|');
}


function readFilePromise(file) {
  return new Promise(function(resolve, reject) {
    fs.readFile(file, 'utf8', function(err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}
