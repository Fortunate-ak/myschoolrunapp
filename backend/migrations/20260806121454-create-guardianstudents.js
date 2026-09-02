"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("guardianstudents", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        },
        guardianId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        studentId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        relationshipToStudent: {
          type: DataTypes.ENUM("father", "mother", "guardian", "aunt", "uncle", "sister", "brother", "grandfather", "grandmother"),
          allowNull: false
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
    await queryInterface.dropTable("guardianstudents");
  },
};
