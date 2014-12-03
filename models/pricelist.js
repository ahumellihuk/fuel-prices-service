"use strict";

module.exports = function(sequelize, DataTypes) {
  var PriceList = sequelize.define("pricelist", {
    price95: DataTypes.DECIMAL,
    price98: DataTypes.DECIMAL,
    priceD: DataTypes.DECIMAL,
    date: DataTypes.DATE
  }, {
    timestamps: false,
    classMethods: {
      associate: function(models) {
        PriceList.belongsTo(models.station);
      }
    }
  });

  return PriceList;
};
