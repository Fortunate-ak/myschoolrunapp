"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("vehicles", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        },
        driverId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        image: {
          type: DataTypes.STRING,
          allowNull: true
        },
        carMake: {
          type: DataTypes.STRING,
          allowNull: false
        },
        carModel: {
          type: DataTypes.STRING,
          allowNull: false
        },
        registrationNumber: {
          type: DataTypes.STRING,
          allowNull: false
        },
        capacity: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        lastServiceDate: {
          type: DataTypes.DATE,
          allowNull: true
        },
        nextServiceDate: {
          type: DataTypes.DATE,
          allowNull: true
        },
        insuranceExpiry: {
          type: DataTypes.DATE,
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
    await queryInterface.dropTable("vehicles");
  },
};
