'use strict';
const exec = require('child_process').exec;
const _ = require('lodash');
exports.get = getVarnishStats;
/**
 * [*getVarnishStats 获取varnish的统计状态]
 * @yield {[type]} [description]
 */
function *getVarnishStats(){
  let result = yield new Promise(function(resolve, reject) {
    let proc = exec('varnishstat -j -f MAIN.', {
      maxBuffer : 2048 * 1024
    });
    let list = [];
    proc.stdout.on('data', function (data) {
      list.push(data);
    });
    proc.on('close', function(){
      if (list.length === 0) {
        list.push('{}');
      }
      resolve(JSON.parse(list.join('')));
    });
  });
  let statsData = {
    createdAt : Date.now()
  };
  delete result.timestamp;
  _.forEach(result, function(v, k){
    k = k.replace('MAIN.', '');
    statsData[k] = v.value;
  });
  return statsData;
}
