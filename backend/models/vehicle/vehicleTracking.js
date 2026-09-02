module.exports = (sequelize, DataTypes) => {
  const VehicleTracking = sequelize.define(
    "vehicletracking",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      vehicleId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      routeId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
      },

      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: false,
      },

      speed: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: "Speed in km/h",
      },

      heading: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: "Direction in degrees (0-360)",
      },

      accuracy: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        comment: "GPS accuracy in meters",
      },

      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      currentStopId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Current or nearest stop",
      },

      distanceToNextStop: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        comment: "Distance in meters",
      },

      estimatedArrivalTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "ETA to next stop",
      },

      status: {
        type: DataTypes.ENUM(
          "moving",
          "stopped",
          "at_stop",
          "delayed",
          "off_route",
        ),
        defaultValue: "moving",
      },

      engineStatus: {
        type: DataTypes.ENUM("on", "off", "idle"),
        allowNull: true,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
    },
  );

  VehicleTracking.associate = (models) => {
    VehicleTracking.belongsTo(models.vehicles, {
      foreignKey: "vehicleId",
      as: "vehicle",
    });

    VehicleTracking.belongsTo(models.vehicleroutes, {
      foreignKey: "routeId",
      as: "route",
    });

    VehicleTracking.belongsTo(models.vehiclestops, {
      foreignKey: "currentStopId",
      as: "currentStop",
    });
  };

  return VehicleTracking;
};
