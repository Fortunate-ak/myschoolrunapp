"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.addColumn("drivers", "identityVerified", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("drivers", "licenseVerified", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("drivers", "emergencyRideEnabled", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("vehicles", "vehicleVerified", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("vehicles", "insuranceVerified", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("vehicles", "insuranceVerified");
    await queryInterface.removeColumn("vehicles", "vehicleVerified");
    await queryInterface.removeColumn("drivers", "emergencyRideEnabled");
    await queryInterface.removeColumn("drivers", "licenseVerified");
    await queryInterface.removeColumn("drivers", "identityVerified");
  },
};
