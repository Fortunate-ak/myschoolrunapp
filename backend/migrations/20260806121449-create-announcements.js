"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("announcements", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        },
        authorId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        message: {
          type: DataTypes.TEXT("long"),
          allowNull: false
        },
        audienceType: {
          type: DataTypes.ENUM("all", "student", "teacher", "guardian", "guard", "driver", "admin", "specific_class", "specific_grade", "multiple_roles"),
          allowNull: false,
          defaultValue: "all"
        },
        audienceIds: {
          type: DataTypes.JSON,
          allowNull: true
        },
        priority: {
          type: DataTypes.ENUM("low", "medium", "high", "urgent"),
          allowNull: false,
          defaultValue: "medium"
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
        deletedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
    });
  },

  async down(queryInterface, _DataTypes) {
    await queryInterface.dropTable("announcements");
  },
};
