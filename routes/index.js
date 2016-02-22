var models = require('../models');
var express = require('express');
var router = express.Router();
var moment = require('moment');

Date.prototype.toJSON = function() { return moment(this).format("YYYY-MM-DDTHH:mm:ss ZZ") };

router.get('/', function(req, res) {
    models.station.findAll().then(function(stations) {
        models.pricelist.findAll({order: 'date DESC', limit: stations.length})
            .then(function(pricelists) {
                var result = new Array();
                for (var i=0; i<stations.length; i++) {
                    var station = stations[i];
                    for (var a=0; a<pricelists.length; a++) {
                        var pricelist = pricelists[a];
                        if (pricelist.stationId == station.id) {
                            station.dataValues.pricelist = pricelist;
                        }
                    }
                    //only return stations, that have a price list
                    if (station.dataValues.pricelist != null) {
                        result.push(station);
                    }
                }
                res.send(JSON.stringify(result));
        }, function() {
            console.error("Failed to find pricelists data.");
        });
    }, function() {
        console.error("Failed to find stations data.");
    });
});

router.get('/all', function(req, res) {
    models.station.findAll({include: [ models.pricelist ]}).then(function(stations) {
        res.send(JSON.stringify(stations));
    }, function() {
        console.error("Failed to find all stations data.");
    });
});

module.exports = router;
