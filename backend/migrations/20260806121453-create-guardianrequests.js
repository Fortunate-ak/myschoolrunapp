"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("guardianrequests", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        },
        driverId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        guardianId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        requestType: {
          type: DataTypes.ENUM("student_onboard_request", "route_stop_request"),
          allowNull: false
        },
        numberOfStudents: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        students: {
          type: DataTypes.JSON,
          allowNull: true
        },
        studentId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        vehicleStopId: {
          type: DataTypes.STRING,
          allowNull: true
        },
        routeId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        homeLocation: {
          type: DataTypes.JSON,
          allowNull: true
        },
        schoolLocation: {
          type: DataTypes.JSON,
          allowNull: true
        },
        status: {
          type: DataTypes.ENUM("approved", "pending", "rejected", "cancelled"),
          allowNull: false,
          defaultValue: "pending"
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
    await queryInterface.dropTable("guardianrequests");
  },
};
