"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("vehiclestops", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        },
        routeId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        stopName: {
          type: DataTypes.STRING,
          allowNull: false
        },
        stopOrder: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        location: {
          type: DataTypes.JSON,
          allowNull: false,
          comment: "{ latitude, longitude, address }"
        },
        scheduledPickupTime: {
          type: DataTypes.TIME,
          allowNull: true
        },
        scheduledDropoffTime: {
          type: DataTypes.TIME,
          allowNull: true
        },
        estimatedWaitTime: {
          type: DataTypes.INTEGER,
          defaultValue: 2
        },
        landmark: {
          type: DataTypes.STRING,
          allowNull: true
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true
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
    await queryInterface.dropTable("vehiclestops");
  },
};
