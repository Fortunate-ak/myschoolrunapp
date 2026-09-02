"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("usersubscriptions", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        },
        guardianId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        planId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        status: {
          type: DataTypes.ENUM("active", "expired", "cancelled", "pending_payment")
        },
        startDate: {
          type: DataTypes.DATE,
          allowNull: false
        },
        endDate: {
          type: DataTypes.DATE,
          allowNull: false
        },
        autoRenew: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        paymentReference: {
          type: DataTypes.STRING,
          allowNull: true
        },
        paymentMethod: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: "free_trial"
        },
        amountPaid: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: 0
        },
        currency: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: "USD"
        },
        cancelledAt: {
          type: DataTypes.DATE,
          allowNull: true
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
    await queryInterface.dropTable("usersubscriptions");
  },
};
