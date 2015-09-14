'use strict';
const Client = require('consul-simple-client');
const setting = require('../setting');

const consulInfo = setting.get('consul');
module.exports = new Client({
  host: consulInfo.hostname,
  port: consulInfo.port
});
