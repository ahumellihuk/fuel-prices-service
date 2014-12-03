"use strict";

module.exports = function(sequelize, DataTypes) {
  var Station = sequelize.define("station", {
    name: DataTypes.STRING,
    address: DataTypes.STRING
  }, {
    timestamps: false,
    classMethods: {
      associate: function(models) {
        Station.hasMany(models.pricelist);
      }
    }
  });

  return Station;
};
