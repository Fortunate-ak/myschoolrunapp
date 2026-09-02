module.exports = (sequelize, DataTypes) => {
  const VehicleStop = sequelize.define(
    "vehiclestops",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      routeId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      stopName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      stopOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      location: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: "{ latitude, longitude, address }",
      },

      scheduledPickupTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },

      scheduledDropoffTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },

      estimatedWaitTime: {
        type: DataTypes.INTEGER,
        defaultValue: 2,
      },

      landmark: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
    },
  );

  VehicleStop.associate = (models) => {
    VehicleStop.belongsTo(models.vehicleroutes, {
      foreignKey: "routeId",
      as: "route",
    });

    VehicleStop.hasMany(models.vehicleassignments, {
      foreignKey: "pickupStopId",
      as: "pickupAssignments",
    });

    VehicleStop.hasMany(models.vehicleassignments, {
      foreignKey: "dropoffStopId",
      as: "dropoffAssignments",
    });
  };

  return VehicleStop;
};
