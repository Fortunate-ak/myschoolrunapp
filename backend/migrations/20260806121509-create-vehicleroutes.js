"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("vehicleroutes", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        },
        routeNumber: {
          type: DataTypes.STRING,
          allowNull: false
        },
        routeName: {
          type: DataTypes.STRING,
          allowNull: false
        },
        vehicleId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        routeType: {
          type: DataTypes.ENUM("pickup", "dropoff", "both"),
          allowNull: false,
          defaultValue: "both"
        },
        startTime: {
          type: DataTypes.TIME,
          allowNull: false
        },
        estimatedEndTime: {
          type: DataTypes.TIME,
          allowNull: false
        },
        activeDays: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: ["Monday","Tuesday","Wednesday","Thursday","Friday"]
        },
        totalDistance: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          comment: "Total route distance in kilometres, calculated from GPS coordinates"
        },
        estimatedDuration: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: "Estimated route duration in minutes"
        },
        status: {
          type: DataTypes.ENUM("active", "suspended", "inactive"),
          allowNull: false,
          defaultValue: "active"
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        },
        stops: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: []
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
    await queryInterface.dropTable("vehicleroutes");
  },
};
