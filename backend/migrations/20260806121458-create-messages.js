"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("messages", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        },
        conversationId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        senderId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        messageType: {
          type: DataTypes.ENUM("text", "file", "image", "system"),
          allowNull: false,
          defaultValue: "text"
        },
        isEdited: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        editedAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        isDeleted: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        deletedFor: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: []
        },
        readBy: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: []
        },
        deliveredTo: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: []
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
        deletedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
    });
  },

  async down(queryInterface, _DataTypes) {
    await queryInterface.dropTable("messages");
  },
};
