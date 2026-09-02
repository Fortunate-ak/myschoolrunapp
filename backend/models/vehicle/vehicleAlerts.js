// models/vehicleAlerts.js
module.exports = (sequelize, DataTypes) => {
  const VehicleAlert = sequelize.define(
    "vehiclealerts",
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

      stopId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      alertType: {
        type: DataTypes.ENUM(
          "delay",
          "arrival",
          "departure",
          "emergency",
          "sos",
          "breakdown",
          "route_deviation",
          "speeding",
          "geofence_exit",
          "maintenance_due",
          "student_absent",
          "general",
        ),
        allowNull: false,
      },

      severity: {
        type: DataTypes.ENUM("low", "medium", "high", "critical"),
        defaultValue: "medium",
      },

      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      location: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "{ latitude, longitude, address }",
      },

      delayMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Delay duration in minutes",
      },

      etaMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM("active", "resolved", "dismissed"),
        defaultValue: "active",
      },

      resolvedBy: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      resolutionNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // Track which users have read this alert
      readBy: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: "Array of user IDs who have read this alert",
      },

      notifiedParents: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      notifiedAdmins: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      driverName: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      driverPhone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
    },
  );

  VehicleAlert.associate = (models) => {
    VehicleAlert.belongsTo(models.vehicles, {
      foreignKey: "vehicleId",
      as: "vehicle",
    });

    VehicleAlert.belongsTo(models.vehicleroutes, {
      foreignKey: "routeId",
      as: "route",
    });
  };

  return VehicleAlert;
};
