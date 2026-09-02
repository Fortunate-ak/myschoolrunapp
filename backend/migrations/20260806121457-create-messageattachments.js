"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("messageattachments", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        },
        messageId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        fileName: {
          type: DataTypes.STRING,
          allowNull: false
        },
        filePath: {
          type: DataTypes.STRING,
          allowNull: false
        },
        fileSize: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        mimeType: {
          type: DataTypes.STRING,
          allowNull: true
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
    await queryInterface.dropTable("messageattachments");
  },
};
