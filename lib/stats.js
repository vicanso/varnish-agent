var currentVarnishStats = null;
var exec = require('child_process').exec;
var _ = require('lodash');
exports.get = getVarnishStats;
/**
 * [*getVarnishStats 获取varnish的统计状态]
 * @yield {[type]} [description]
 */
function *getVarnishStats(){
  var result = yield function(done){
    var proc = exec('varnishstat -j -f MAIN.', {
      maxBuffer : 2048 * 1024
    });
    var list = [];
    proc.stdout.on('data', function (data) {
      list.push(data);
    });
    proc.on('close', function(){
      done(null, JSON.parse(list.join('')));
    });
  }
  delete result.timestamp;
  var now = Date.now();
  var statsData = {
    createdAt : now
  };
  _.forEach(result, function(v, k){
    k = k.replace('MAIN.', '');
    statsData[k] = v.value;
  });
  return statsData;
}