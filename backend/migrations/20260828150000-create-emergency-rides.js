"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("emergencyrides", {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
      guardianId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "guardians", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      studentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "students", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "drivers", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      originalDriverId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "drivers", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      vehicleId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "vehicles", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      routeId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "vehicleroutes", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      pickupAddress: { type: DataTypes.STRING, allowNull: false },
      pickupLatitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      pickupLongitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      destinationAddress: { type: DataTypes.STRING, allowNull: false },
      destinationLatitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      destinationLongitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
      tripType: { type: DataTypes.STRING, allowNull: false, defaultValue: "emergency_alternative" },
      requestedPickupTime: { type: DataTypes.DATE, allowNull: false },
      emergencyReason: { type: DataTypes.TEXT, allowNull: false },
      specialInstructions: { type: DataTypes.TEXT, allowNull: true },
      offeredPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      finalPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "USD" },
      status: {
        type: DataTypes.ENUM(
          "REQUESTED", "SEARCHING", "DRIVER_SELECTED", "DRIVER_ACCEPTED",
          "DRIVER_ARRIVING", "STUDENT_PICKED_UP", "IN_TRANSIT",
          "STUDENT_DROPPED_OFF", "COMPLETED", "CANCELLED", "DRIVER_REJECTED",
          "EXPIRED", "NO_DRIVER_AVAILABLE",
        ),
        allowNull: false,
        defaultValue: "REQUESTED",
      },
      requestedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      acceptedAt: { type: DataTypes.DATE, allowNull: true },
      driverArrivedAt: { type: DataTypes.DATE, allowNull: true },
      studentPickedUpAt: { type: DataTypes.DATE, allowNull: true },
      tripStartedAt: { type: DataTypes.DATE, allowNull: true },
      studentDroppedOffAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      cancellationReason: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex("emergencyrides", ["guardianId", "status"]);
    await queryInterface.addIndex("emergencyrides", ["studentId", "status"]);
    await queryInterface.addIndex("emergencyrides", ["driverId", "status"]);
    await queryInterface.addIndex("emergencyrides", ["originalDriverId"]);
    await queryInterface.addIndex("emergencyrides", ["vehicleId"]);
    await queryInterface.addIndex("emergencyrides", ["routeId"]);
    await queryInterface.addIndex("emergencyrides", ["status", "requestedAt"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("emergencyrides");
  },
};
