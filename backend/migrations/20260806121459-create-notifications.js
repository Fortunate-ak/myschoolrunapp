"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("notifications", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false
        },
        notifType: {
          type: DataTypes.ENUM("info", "success", "warning", "error", "emergency", "sos", "alert", "message"),
          defaultValue: "info"
        },
        message: {
          type: DataTypes.TEXT
        },
        roleId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        isGlobal: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        isRead: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        readAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        entityType: {
          type: DataTypes.STRING,
          allowNull: true
        },
        entityId: {
          type: DataTypes.STRING,
          allowNull: true
        },
        metadata: {
          type: DataTypes.JSON,
          defaultValue: {}
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
    await queryInterface.dropTable("notifications");
  },
};
