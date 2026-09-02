module.exports = (sequelize, DataTypes) => {
  const EmergencyRide = sequelize.define(
    "emergencyrides",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      guardianId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      studentId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      originalDriverId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      vehicleId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      routeId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      pickupAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      pickupLatitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },
      pickupLongitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },
      destinationAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      destinationLatitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },
      destinationLongitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },
      tripType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "emergency_alternative",
      },
      requestedPickupTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      emergencyReason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      specialInstructions: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      offeredPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      finalPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: "USD",
      },
      status: {
        type: DataTypes.ENUM(
          "REQUESTED",
          "SEARCHING",
          "DRIVER_SELECTED",
          "DRIVER_ACCEPTED",
          "DRIVER_ARRIVING",
          "STUDENT_PICKED_UP",
          "IN_TRANSIT",
          "STUDENT_DROPPED_OFF",
          "COMPLETED",
          "CANCELLED",
          "DRIVER_REJECTED",
          "EXPIRED",
          "NO_DRIVER_AVAILABLE",
        ),
        allowNull: false,
        defaultValue: "REQUESTED",
      },
      requestedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      acceptedAt: { type: DataTypes.DATE, allowNull: true },
      driverArrivedAt: { type: DataTypes.DATE, allowNull: true },
      studentPickedUpAt: { type: DataTypes.DATE, allowNull: true },
      tripStartedAt: { type: DataTypes.DATE, allowNull: true },
      studentDroppedOffAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      cancellationReason: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      freezeTableName: true,
      timestamps: true,
      indexes: [
        { fields: ["guardianId", "status"] },
        { fields: ["studentId", "status"] },
        { fields: ["driverId", "status"] },
        { fields: ["originalDriverId"] },
        { fields: ["vehicleId"] },
        { fields: ["routeId"] },
        { fields: ["status", "requestedAt"] },
      ],
    },
  );

  EmergencyRide.associate = (models) => {
    EmergencyRide.belongsTo(models.guardians, {
      foreignKey: "guardianId",
      as: "guardian",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
    EmergencyRide.belongsTo(models.students, {
      foreignKey: "studentId",
      as: "student",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
    EmergencyRide.belongsTo(models.drivers, {
      foreignKey: "driverId",
      as: "driver",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    EmergencyRide.belongsTo(models.drivers, {
      foreignKey: "originalDriverId",
      as: "originalDriver",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    EmergencyRide.belongsTo(models.vehicles, {
      foreignKey: "vehicleId",
      as: "vehicle",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    EmergencyRide.belongsTo(models.vehicleroutes, {
      foreignKey: "routeId",
      as: "route",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  };

  return EmergencyRide;
};
