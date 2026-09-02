"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("users", {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4
        },
        fullname: {
          type: DataTypes.STRING,
          allowNull: false
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false
        },
        phone: {
          type: DataTypes.STRING,
          allowNull: true
        },
        password: {
          type: DataTypes.STRING,
          allowNull: true
        },
        roleId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        refreshToken: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        resetPasswordToken: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        resetPasswordExpires: {
          type: DataTypes.DATE,
          allowNull: true
        },
        emailVerificationOTP: {
          type: DataTypes.STRING,
          allowNull: true
        },
        emailVerificationOTPExpires: {
          type: DataTypes.DATE,
          allowNull: true
        },
        emailVerificationOTPAttempts: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        isVerified: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        verifiedAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        inviteToken: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        inviteExpires: {
          type: DataTypes.DATE,
          allowNull: true
        },
        loginAttempts: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        lockUntil: {
          type: DataTypes.DATE,
          allowNull: true
        },
        lastLoginAttempt: {
          type: DataTypes.DATE,
          allowNull: true
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
    await queryInterface.dropTable("users");
  },
};
