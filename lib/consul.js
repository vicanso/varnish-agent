'use strict';
const request = require('superagent');
const setting = require('../setting');
const urlJoin = require('url-join');
const _ = require('lodash');
const parallel = require('co-parallel');
const fs = require('fs');

exports.getHttpBackends = getHttpBackends;
exports.register = register;


/**
 * [getHttpBackends description]
 * @return {[type]} [description]
 */
function* getHttpBackends() {
  let url = urlJoin(setting.get('consul'), '/v1/catalog/services');
  let res = yield get(url);
  let services = [];
  let backendTagList = setting.get('backendTag').split(',');
  _.forEach(res.body, function(tags, name) {
    _.forEach(backendTagList, function(backendTag) {
      if (_.indexOf(tags, backendTag) !== -1) {
        services.push(name);
      }
    });
  });
  services = _.uniq(services);
  let fns = services.map(getService);
  let result = yield parallel(fns);
  return _.flattenDeep(result);
}


/**
 * [get description]
 * @param  {[type]} url [description]
 * @return {[type]}     [description]
 */
function get(url) {
  return new Promise(function(resolve, reject) {
    request.get(url).end(function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}


/**
 * [getService description]
 * @param  {[type]} service [description]
 * @return {[type]}          [description]
 */
function* getService(service) {
  let url = urlJoin(setting.get('consul'), '/v1/catalog/service/', service);
  let res = yield get(url);
  return _.map(res.body, function(item) {
    let tmp = {
      name: item.ServiceName,
      ip: item.ServiceAddress,
      port: item.ServicePort
    };
    let prefixKey = 'prefix:';
    let hostKey = 'host:';
    _.forEach(item.ServiceTags, function(tag) {
      if (tag.indexOf(prefixKey) === 0) {
        tmp.prefix = tag.substring(prefixKey.length);
      } else if (tag.indexOf(hostKey) === 0) {
        tmp.host = tag.substring(hostKey.length);
      }
    });
    return tmp;
  });
}


/**
 * [register 注册服务]
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
  let registerData = {
    Node: hostName,
    Address: address,
    Service: {
      ID: hostName,
      Service: 'varnish',
      Port: 80,
      Address: address,
      tags: _.uniq(tags)
    }
  };
  let url = urlJoin(setting.get('consul'), '/v1/catalog/register');
  yield put(url, registerData);
}


/**
 * [put description]
 * @param  {[type]} argument [description]
 * @return {[type]}          [description]
 */
function* put(url, data) {
  return yield new Promise(function(resolve, reject) {
    request.put(url).send(data).end(function(err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}
