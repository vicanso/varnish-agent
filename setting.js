'use strict';
const pkg = require('./package.json');
const fs = require('fs');
const _ = require('lodash');
const debug = require('debug')('jt:varnish');
const path = require('path');
var setting = null;
var vclFileList = [];
createSetting();

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

/**
 * [createSetting description]
 * @return {[type]} [description]
 */
function createSetting() {
  const program = require('commander');
  program
    .version(pkg.version)
    .option('-c, --config <n>', 'config file path')
    .parse(process.argv);

  program.config = program.config || './default.json';
  let file = path.join(__dirname, program.config);
  let buf = fs.readFileSync(file);
  setting = JSON.parse(buf);
  if (setting.type === 'local' && setting.file.charAt(0) !== '/') {
    setting.file = path.join(path.dirname(file), setting.file);
  }
  debug('setting:%j', setting);
}
