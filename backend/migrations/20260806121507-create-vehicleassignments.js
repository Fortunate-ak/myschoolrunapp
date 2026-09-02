"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("vehicleassignments", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        },
        studentId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        vehicleId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        routeId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        pickupStopId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        dropoffStopId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        assignmentType: {
          type: DataTypes.ENUM("regular", "temporary", "trial"),
          defaultValue: "regular"
        },
        effectiveFrom: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        effectiveTo: {
          type: DataTypes.DATE,
          allowNull: true
        },
        activeDays: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: ["Monday","Tuesday","Wednesday","Thursday","Friday"]
        },
        guardianPhone: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: "Phone number for pickup/dropoff notifications"
        },
        emergencyContact: {
          type: DataTypes.JSON,
          allowNull: true,
          comment: "{ name, phone, relationship }"
        },
        specialRequirements: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: "Special needs, medical conditions, etc."
        },
        status: {
          type: DataTypes.ENUM("active", "suspended", "expired", "cancelled"),
          defaultValue: "active"
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
    await queryInterface.dropTable("vehicleassignments");
  },
};
