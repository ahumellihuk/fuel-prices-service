"use strict";

module.exports = function(sequelize, DataTypes) {
  var PriceList = sequelize.define("pricelist", {
    price95: DataTypes.DECIMAL,
    trend95: DataTypes.INTEGER,
    price98: DataTypes.DECIMAL,
    trend98: DataTypes.INTEGER,
    priceD: DataTypes.DECIMAL,
    trendd: DataTypes.INTEGER,
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
