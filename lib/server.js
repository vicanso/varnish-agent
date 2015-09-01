'use strict';
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const setting = require('../setting');
const co = require('co');
const fs = require('fs');

exports.start = initServer;

/**
 * [initServer 初始化http server]
 * @param  {[type]} port [description]
 * @return {[type]}      [description]
 */
function initServer(port) {
  port = port || 10000;
  let secretPwd = setting.get('password');
  http.createServer(function(req, res) {
    let urlInfo = url.parse(req.url);
    let pwd;
    if (urlInfo.query) {
      pwd = querystring.parse(urlInfo.query).pwd;
    }
    if (secretPwd && pwd !== secretPwd) {
      res.writeHead(403);
      res.end('password is wrong');
      return;
    }
    if (req.url === '/v-vcl') {
      fs.readFile(setting.getLatestVclFile(), 'utf8', function(err, vcl) {
        if (err) {
          vcl = 'can not get vcl';
        }
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'must-revalidate, max-age=0'
        });
        res.end(vcl);
      });
    } else if (req.url === '/v-stats') {
      co(function*() {
        let stats = require('./stats');
        let data = yield stats.get();
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'must-revalidate, max-age=0'
        });
        res.end(JSON.stringify(data));
      }).catch(function(err) {
        res.writeHead(500);
        res.end(err.message);
      });
    } else {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'must-revalidate, max-age=0'
      });
      res.end('OK');
    }
  }).listen(port);
}
