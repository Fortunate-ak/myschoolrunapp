"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("driverservices", {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      driverId: { type: DataTypes.UUID, allowNull: false },
      vehicleId: { type: DataTypes.UUID, allowNull: false },
      origin: { type: DataTypes.STRING, allowNull: false },
      destination: { type: DataTypes.STRING, allowNull: false },
      originLatitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      originLongitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      destinationLatitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      destinationLongitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      serviceType: { type: DataTypes.STRING, allowNull: false, defaultValue: "emergency_transport" },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "USD" },
      pricingType: { type: DataTypes.ENUM("FIXED", "PER_KM", "NEGOTIABLE"), allowNull: false, defaultValue: "FIXED" },
      availableDays: { type: DataTypes.JSON, allowNull: false },
      availableHours: { type: DataTypes.JSON, allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("driverservices");
  },
};
