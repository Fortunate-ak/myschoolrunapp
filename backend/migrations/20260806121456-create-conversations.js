"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("conversations", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        },
        type: {
          type: DataTypes.ENUM("private", "group", "route"),
          allowNull: false,
          defaultValue: "private"
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true
        },
        createdBy: {
          type: DataTypes.UUID,
          allowNull: false
        },
        classId: {
          type: DataTypes.UUID,
          allowNull: true
        },
        routeId: {
          type: DataTypes.UUID,
          allowNull: true,
          comment: "For route channels - references vehicleroutes table"
        },
        lastMessageAt: {
          type: DataTypes.DATE,
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
    await queryInterface.dropTable("conversations");
  },
};
