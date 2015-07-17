'use strict';
const request = require('superagent');
const urlJoin = require('url-join');
const _ = require('lodash');
exports.timeout = 3000;
exports.add = add;
exports.get = get;
exports.del = del;
exports.update = update;
exports.list = list;
/**
 * [getUrl description]
 * @param  {[type]} tmp [description]
 * @return {[type]}     [description]
 */
function getUrl(tmpUrl) {
  return urlJoin(exports.url, 'v2/keys', tmpUrl);
}


/**
 * [handle description]
 * @param  {[type]} req [description]
 * @return {[type]}     [description]
 */
function handle(req) {
  return new Promise(function(resolve, reject) {
    req.timeout(exports.timeout).end(function (err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

/**
 * [add 添加node节点数据]
 * @param {[type]} key  [description]
 * @param {[type]} data [description]
 * @param {[type]} ttl  [description]
 */
function *add(key, data, ttl) {
  if (_.isObject(data)) {
    data = JSON.stringify(data);
  }
  let req = request.post(getUrl(key))
    .send('value=' + data);
  if (!_.isUndefined(ttl)) {
    req.send('ttl=' + ttl);
  }
  let res = yield handle(req);
  return _.get(res, 'body');
}


/**
 * [get 获取node节点数据]
 * @param  {[type]} key [description]
 * @return {[type]}     [description]
 */
function *get(key) {
  let req = request.get(getUrl(key));
  let res = yield handle(req);
  let data = _.get(res, 'body.node');
  if (data) {
    try {
      data.value = JSON.parse(data.value);
    } catch (err) {
    }
  }
  return data;
}


/**
 * [del 删除数据]
 * @param  {[type]} key [description]
 * @return {[type]}     [description]
 */
function *del(key) {
  let req = request.del(getUrl(key));
  let res = yield handle(req);
  return _.get(res, 'body');
}


/**
 * [update 更新数据]
 * @param  {[type]} key  [description]
 * @param  {[type]} data [description]
 * @param  {[type]} ttl  [description]
 * @return {[type]}      [description]
 */
function *update(key, data, ttl) {
  if (_.isObject(data)) {
    data = JSON.stringify(data);
  }

  let req = request.put(getUrl(key))
    .send('value=' + data);
  if (!_.isUndefined(ttl)) {
    req.send('ttl=' + ttl);
  }
  let res = yield handle(req);
  return _.get(res, 'body');
}


/**
 * [list 列出dir目录下面所有节点数据]
 * @param  {[type]} key [description]
 * @return {[type]}     [description]
 */
function *list(key) {
  let req = request.get(getUrl(key));
  let res = yield handle(req);
  let data = _.get(res, 'body.node.nodes');
  _.forEach(data, function(tmp) {
    try {
      tmp.value = JSON.parse(tmp.value);
    } catch (err) {
    }
  });
  return data;
}
