"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("students", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        },
        fullname: {
          type: DataTypes.STRING,
          allowNull: false
        },
        schoolAddress: {
          type: DataTypes.JSON,
          allowNull: false,
          comment: "{ latitude, longitude, address }"
        },
        homeAddress: {
          type: DataTypes.JSON,
          allowNull: false,
          comment: "{ latitude, longitude, address }"
        },
        vehicleRouteId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        vehicleStopId: {
          type: DataTypes.STRING,
          allowNull: true
        },
        gender: {
          type: DataTypes.ENUM("male", "female", "other"),
          allowNull: false
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
    });
  },

  async down(queryInterface, _DataTypes) {
    await queryInterface.dropTable("students");
  },
};
