"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("vehicleattendance", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        },
        assignmentId: {
          type: DataTypes.UUID,
          allowNull: false
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
        date: {
          type: DataTypes.DATEONLY,
          allowNull: false
        },
        tripType: {
          type: DataTypes.ENUM("pickup", "dropoff"),
          allowNull: false
        },
        status: {
          type: DataTypes.ENUM("present", "absent", "late", "early_exit", "no_show"),
          defaultValue: "present"
        },
        boardingStopId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        boardingTime: {
          type: DataTypes.DATE,
          allowNull: true
        },
        exitStopId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        exitTime: {
          type: DataTypes.DATE,
          allowNull: true
        },
        markedById: {
          type: DataTypes.UUID,
          allowNull: true,
          comment: "Driver or attendant who marked attendance"
        },
        parentNotified: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        notificationSentAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        notes: {
          type: DataTypes.TEXT,
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
    await queryInterface.dropTable("vehicleattendance");
  },
};
