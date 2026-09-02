module.exports = (sequelize, DataTypes) => {
  const DriverService = sequelize.define(
    "driverservices",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      vehicleId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      origin: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      destination: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      originLatitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },
      originLongitude: {
        type: DataTypes.DECIMAL(10, 7),
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
      serviceType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "emergency_transport",
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: "USD",
      },
      pricingType: {
        type: DataTypes.ENUM("FIXED", "PER_KM", "NEGOTIABLE"),
        allowNull: false,
        defaultValue: "FIXED",
      },
      availableDays: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      availableHours: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
    },
  );

  DriverService.associate = (models) => {
    DriverService.belongsTo(models.drivers, { foreignKey: "driverId", as: "driver" });
    DriverService.belongsTo(models.vehicles, { foreignKey: "vehicleId", as: "vehicle" });
  };

  return DriverService;
};
