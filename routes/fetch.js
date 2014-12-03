var models  = require('../models');
var Cheerio = require('cheerio');
var Request = require('request');
var moment = require('moment');
var express = require('express');
var router = express.Router();

String.prototype.isEmpty = function() {
  return (this.length === 0 || !this.trim());
};

/* GET users listing. */
router.get('/', function(req, res) {
  var asyncCallsNumber = 0;
  var errorLimitLeft = 10;

  var requestViaProxy = Request.defaults({'proxy':'http://81.20.145.100:3128'});

  var sendBackHTML = function(err, resp, html) {
    if (err) {
      if (--errorLimitLeft > 0) {
        console.error(err);
        requestViaProxy('http://1181.ee/kytusehinnad', sendBackHTML);
        return;
      }
      res.statusCode = 403;
      res.send();
      return;
    }

    //load content into Cheerio
    var $ = Cheerio.load(html);

    var tableHeader = $('#content .head1');
    var dateString = tableHeader.get(0).children[0].data.substr(21).trim() + " GMT+0200";
    var pricesValidAsOfDate = moment(dateString, "DD.MM.YYYY HH:mm Z").format();

    //traverse table and collect data
    var tr = $('#content table tr');
    var i = 0;
    var table = [];
    tr.each(function(r) {
      var row = [];
      var a = 0;
      $(this).find("td").each(function(d) {
        row[a++] = $(this).text();
      });
      table[i++] = row;
    });

    for (var n = 0; n < table[0].length; n++) {
      var stationName = table[0][n];
      if (!stationName.isEmpty() && stationName != "Hulgihind") {
        (function(stationName, stationAddress, price95, price98, priceD){
          if (price95 == "-") {
            price95 = null;
          }
          if (price98 == "-") {
            price98 = null;
          }
          if (priceD == "-") {
            priceD = null;
          }
          asyncCallsNumber++;
          models.station.findOrCreate({
            where: {name: stationName},
            include: [ models.pricelist ],
            order: [ [ models.pricelist, 'date', 'DESC' ] ],
            defaults: {
              name: stationName,
              address: stationAddress
            }
          }).success(function(station, created) {
            if (created || new Date(pricesValidAsOfDate).getTime() > station.pricelists[0].date.getTime()) {
              models.pricelist.create({
                price95: price95,
                price98: price98,
                priceD: priceD,
                date: pricesValidAsOfDate
              }).success(function (priceList) {
                station.addPricelist(priceList);
                onSuccess();
              });
            } else {
              console.log("No updated data found for station " + stationName + ".");
              onSuccess();
            }
          });
        })(stationName, table[1][n], table[2][n], table[3][n], table[4][n]);
      }
    }
  };
  requestViaProxy('http://1181.ee/kytusehinnad', sendBackHTML);

  function onSuccess() {
    if (--asyncCallsNumber == 0) {
      res.statusCode = 200;
      res.send();
    }
  }
});

module.exports = router;
