var models  = require('../models');
var Cheerio = require('cheerio');
var Request = require('request');
var moment = require('moment');
var express = require('express');
var router = express.Router();

var neverProxy = process.env.NEVER_PROXY || false;
var alwaysProxy = process.env.ALWAYS_PROXY || false;
var url = 'http://1181.ee/kytusehinnad';

if (alwaysProxy && !neverProxy) {
  Request = Request.defaults({'proxy':'http://81.20.145.100:3128'});
}

String.prototype.isEmpty = function() {
  return (this.length === 0 || !this.trim());
};

router.get('/', function(req, res) {
  executeFetch(function(success) {
    if (success) {
      log("Sending response - 200 OK");
      res.statusCode = 200;
      res.send();
    } else {
      log("Sending response - 503 Service unavailable");
      res.statusCode = 503;
      res.send();
    }
  })
});

var executeFetch = function (callback) {
  log("Fetching data from remote server...");

  var isRequestProxied = false;
  var asyncCallsNumber = 0;
  var errorLimitLeft = 10;

  var sendBackHTML = function(error, resp, html) {
    log("Received response: error = " + error + ", resp = " + resp);
    if (error) {
      err("Failed to fetch data: " + error);
      if (--errorLimitLeft > 0) {
        err("Attempting again...Attempts left: " + errorLimitLeft);
        Request(url, sendBackHTML);
        return;
      }
      err("Attempts limit exceeded. Will attempt again at next scheduled launch.");
      callback(false);
      return;
    }
    if (!alwaysProxy && !neverProxy && !isRequestProxied && resp.statusCode == 403) {
      log("Failed to fetch data directly - 403 Forbidden.");
      log("Attempting to proxy the request through 81.20.145.100:3128 ...");
      Request = Request.defaults({'proxy':'http://81.20.145.100:3128'});
      isRequestProxied = true;
      Request(url, sendBackHTML);
      return;
    }

    log("Received response from remote resource - " + resp.statusCode);

    //load content into Cheerio
    var $ = Cheerio.load(html);

    var pricesValidAsOfDate = getPricesValidAsOfDate($);
    var data = extractTableData($);

    for (var n = 0; n < data[0].length; n++) {
      var name = data[0][n];
      //Currently we don't want to store wholesale prices
      if (!name.isEmpty() && name != "Hulgihind") {
        log("Processing station '" + name + "'...");

        //Closure used in order to make extracted values immutable
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
          }).spread(function(station, created) {
            if (created) {
              models.pricelist.create({
                price95: price95,
                price98: price98,
                priceD: priceD,
                date: pricesValidAsOfDate
              }).then(function (priceList) {
                station.addPricelist(priceList);
                log("Prices updated for station '" + stationName + "'");
                onSuccess();
              }, function() {
                err("Failed to create priceList for station '" + stationName + "'");
              });
            } else if (new Date(pricesValidAsOfDate).getTime() > station.pricelists[0].date.getTime()) {
                models.pricelist.findAll({where: {stationId: station.id}, order: 'date DESC', limit: 1}).then(function(pricelists) {
                    var pricelist = pricelists[0];
                    var trend95 = 0;
                    if (pricelist.price95 > price95) {
                        trend95 = -1;
                    } else if (pricelist.price95 < price95) {
                        trend95 = 1;
                    }
                    var trend98 = 0;
                    if (pricelist.price98 > price98) {
                        trend98 = -1;
                    } else if (pricelist.price98 < price98) {
                        trend98 = 1;
                    }
                    var trendD = 0;
                    if (pricelist.priceD > priceD) {
                        trendD = -1;
                    } else if (pricelist.priceD < priceD) {
                        trendD = 1;
                    }
                    models.pricelist.create({
                        price95: price95,
                        trend95: trend95,
                        price98: price98,
                        trend98: trend98,
                        priceD: priceD,
                        trendd: trendD,
                        date: pricesValidAsOfDate
                    }).then(function (priceList) {
                        station.addPricelist(priceList);
                        log("Prices updated for station '" + stationName + "'");
                        onSuccess();
                    }, function() {
                        err("Failed to create priceList for station '" + stationName + "'");
                    });
                }, function() {
                    err("Failed to find previous last pricelist");
                    models.pricelist.create({
                        price95: price95,
                        price98: price98,
                        priceD: priceD,
                        date: pricesValidAsOfDate
                    }).then(function (priceList) {
                        station.addPricelist(priceList);
                        log("Prices updated for station '" + stationName + "'");
                        onSuccess();
                    }, function() {
                        err("Failed to create priceList for station '" + stationName + "'");
                    });
                });
            } else {
              log("No updated data found for station " + stationName + ".");
              onSuccess();
            }
          }, function() {
            err("Failed to findOrCreate station '" + stationName + "'");
          });
        })(name, data[1][n], data[2][n], data[3][n], data[4][n]);
      }
    }
  };
  Request(url, sendBackHTML);

  function onSuccess() {
    if (--asyncCallsNumber == 0) {
      callback(true);
    }
  }
};

function getPricesValidAsOfDate($) {
  log("Finding 'prices valid as of' date...");
  //find table heading
  var tableHeader = $('#content .head1');
  //currently it looks like "Kütusehinnad seisuga 03.12.2014 16:21    ", so we need to trim it, and add Timezone at the end.
  var dateString = tableHeader.get(0).children[0].data.substr(21).trim() + " GMT+0200";
  //parse datetime string with 'moment' to get the right format
  var date = moment(dateString, "DD.MM.YYYY HH:mm Z").format();

  log("'prices valid as of' found - " + dateString);

  return date;
}

function extractTableData($) {
  log("Parsing table data...");
  //traverse table and collect data
  var tableRows = $('#content table tr');
  var i = 0;
  var table = [];
  tableRows.each(function(r) {
    var row = [];
    var a = 0;
    $(this).find("td").each(function(d) {
      row[a++] = $(this).text();
    });
    table[i++] = row;
  });
  log("Table data parsed");
  return table;
}

function log(message) {
  console.log(moment().format('DD/MM/YYYY HH:mm:ss') + ": " + message);
}

function err(message) {
  console.error(moment().format('DD/MM/YYYY HH:mm:ss') + ": " + message);
}

module.exports = router;
module.exports.executeFetch = executeFetch;