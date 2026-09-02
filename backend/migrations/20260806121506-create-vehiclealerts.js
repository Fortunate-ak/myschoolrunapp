"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("vehiclealerts", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        },
        vehicleId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        routeId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        stopId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        alertType: {
          type: DataTypes.ENUM("delay", "arrival", "departure", "emergency", "sos", "breakdown", "route_deviation", "speeding", "geofence_exit", "maintenance_due", "student_absent", "general"),
          allowNull: false
        },
        severity: {
          type: DataTypes.ENUM("low", "medium", "high", "critical"),
          defaultValue: "medium"
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        location: {
          type: DataTypes.JSON,
          allowNull: true,
          comment: "{ latitude, longitude, address }"
        },
        delayMinutes: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: "Delay duration in minutes"
        },
        etaMinutes: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        status: {
          type: DataTypes.ENUM("active", "resolved", "dismissed"),
          defaultValue: "active"
        },
        resolvedBy: {
          type: DataTypes.UUID,
          allowNull: true
        },
        resolvedAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        resolutionNotes: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        readBy: {
          type: DataTypes.JSON,
          defaultValue: [],
          comment: "Array of user IDs who have read this alert"
        },
        notifiedParents: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        notifiedAdmins: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        driverName: {
          type: DataTypes.STRING,
          allowNull: true
        },
        driverPhone: {
          type: DataTypes.STRING,
          allowNull: true
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
    await queryInterface.dropTable("vehiclealerts");
  },
};
