var models = require('../models');
var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  models.station.findAll({include: [ models.pricelist ]}).success(function(stations) {
    res.send(JSON.stringify(stations));
  });
});

module.exports = router;
