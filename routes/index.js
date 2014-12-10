var models = require('../models');
var express = require('express');
var router = express.Router();
var moment = require('moment');

Date.prototype.toJSON = function() { return moment(this).format("YYYY-MM-DDTHH:mm:ss ZZ") };

router.get('/', function(req, res) {
  models.station.findAll({include: [ models.pricelist ]}).then(function(stations) {
    res.send(JSON.stringify(stations));
  }, function() {
    console.error("Failed to find all stations data.");
  });
});

module.exports = router;
