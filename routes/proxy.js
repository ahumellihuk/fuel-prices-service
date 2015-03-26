var models  = require('../models');
var Cheerio = require('cheerio');
var Request = require('request');
var moment = require('moment');
var express = require('express');
var router = express.Router();

var url = 'http://1181.ee/kytusehinnad';

String.prototype.isEmpty = function() {
  return (this.length === 0 || !this.trim());
};

router.get('/', function(req, res) {
  executeFetch(res);
});

var executeFetch = function (response) {
  log("Proxying page...");
  var sendBackHTML = function(error, resp, html) {
      response.statusCode = 200;
      response.send(html);
  };
  Request(url, sendBackHTML);
};

function log(message) {
  console.log(moment().format('DD/MM/YYYY HH:mm:ss') + ": " + message);
}

module.exports = router;
module.exports.executeFetch = executeFetch;
