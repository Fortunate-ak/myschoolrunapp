module.exports = (sequelize, DataTypes) => {
  const Vehicle = sequelize.define(
    "vehicles",
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

      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      carMake: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      carModel: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      registrationNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      capacity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      lastServiceDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      nextServiceDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      insuranceExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      vehicleVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      insuranceVerified: {
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

  Vehicle.associate = (models) => {
    Vehicle.belongsTo(models.drivers, {
      foreignKey: "driverId",
      as: "driver",
    });

    Vehicle.hasMany(models.vehicletracking, {
      foreignKey: "vehicleId",
      as: "trackingHistory",
    });

    Vehicle.hasMany(models.vehicleassignments, {
      foreignKey: "vehicleId",
      as: "studentAssignments",
    });

    Vehicle.hasMany(models.vehiclealerts, {
      foreignKey: "vehicleId",
      as: "alerts",
    });

    Vehicle.hasMany(models.vehicleroutes, {
      foreignKey: "vehicleId",
      as: "routes",
    });
  };

  return Vehicle;
};
