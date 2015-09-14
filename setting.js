'use strict';
const pkg = require('./package.json');
const fs = require('fs');
const _ = require('lodash');
const debug = require('debug')('jt:varnish');
const path = require('path');
const url = require('url');
var setting = {
  consul: url.parse(process.env.CONSUL || 'http://localhost:8500'),
  backendTag: process.env.BACKEND_TAG || 'http-backend',
  serviceTag: process.env.SERVICE_TAG || 'varnish'
};
var vclFileList = [];

exports.get = get;
exports.addVclFile = addVclFile;
exports.getLatestVclFile = getLatestVclFile;

/**
 * [get 获取setting配置]
 * @param  {[type]} key [description]
 * @return {[type]}     [description]
 */
function get(key) {
  return _.get(setting, key);
}


/**
 * [addVclFile description]
 * @param {[type]} file [description]
 */
function addVclFile(file) {
  vclFileList.push(file);
}


/**
 * [getLatestVclFile description]
 * @return {[type]} [description]
 */
function getLatestVclFile() {
  return _.last(vclFileList);
}
