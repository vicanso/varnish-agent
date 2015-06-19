var spawn = require('child_process').spawn;
var _ = require('lodash');
var logList = [];


exports.start = start;

function start(){
  var cmd = spawn('varnishncsa', ['-F', '%m %U %s %b %D %{Varnish:handling}x']);
  cmd.on('close', start);
  cmd.stdout.on('data', function(data){
    logList.push(data.toString());
    if(logList.length === 10){
      analyze();
    }
  });
}


function analyze(){
  var str = logList.join('');
  logList = [];
  var arr = str.split('\n');
  if(!_.last(arr)){
    arr.pop();
  }
  // 最后的一条log没获取全
  if(str[str.length - 1] !== '\n'){
    logList.push(arr.pop());
  }
  _.forEach(arr, function(str){
    var arr = str.split(' ');
    var method = arr[0];
    var url = arr[1];
    var status = arr[2];
    var length = arr[3];
    var use = arr[4];
    var handling = arr[5];
    if(url === '/ping'){
      return;
    }
    var result = {
      method : method,
      url : url,
      status : status,
      length : length,
      use : use,
      handling : handling
    };
    console.dir(result);
  });
}

start();