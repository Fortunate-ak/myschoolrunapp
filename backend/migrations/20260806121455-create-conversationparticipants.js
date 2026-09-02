"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("conversationparticipants", {
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
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        role: {
          type: DataTypes.ENUM("admin", "member"),
          allowNull: false,
          defaultValue: "member"
        },
        lastReadMessageId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        isMuted: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        joinedAt: {
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
        deletedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
    });
  },

  async down(queryInterface, _DataTypes) {
    await queryInterface.dropTable("conversationparticipants");
  },
};
