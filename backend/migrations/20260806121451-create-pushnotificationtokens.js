"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("pushnotificationtokens", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        expoPushToken: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        deviceName: {
          type: DataTypes.STRING,
          allowNull: true
        },
        deviceType: {
          type: DataTypes.STRING,
          allowNull: true
        },
        platform: {
          type: DataTypes.ENUM("ios", "android", "web"),
          allowNull: true
        },
        appVersion: {
          type: DataTypes.STRING,
          allowNull: true
        },
        lastUsed: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
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
    await queryInterface.dropTable("pushnotificationtokens");
  },
};
