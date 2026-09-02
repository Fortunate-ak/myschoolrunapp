"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("drivers", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        profileImage: {
          type: DataTypes.STRING,
          allowNull: true
        },
        idNumber: {
          type: DataTypes.STRING,
          allowNull: false
        },
        licenseNumber: {
          type: DataTypes.STRING,
          allowNull: false
        },
        gender: {
          type: DataTypes.ENUM("male", "female", "other"),
          allowNull: false,
          defaultValue: "male"
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
    await queryInterface.dropTable("drivers");
  },
};
