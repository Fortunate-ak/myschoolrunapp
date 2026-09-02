module.exports = (sequelize, DataTypes) => {
  const VehicleAssignment = sequelize.define(
    "vehicleassignments",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      studentId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      vehicleId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      routeId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      pickupStopId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      dropoffStopId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      assignmentType: {
        type: DataTypes.ENUM("regular", "temporary", "trial"),
        defaultValue: "regular",
      },

      effectiveFrom: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      effectiveTo: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      activeDays: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      },

      guardianPhone: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Phone number for pickup/dropoff notifications",
      },

      emergencyContact: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "{ name, phone, relationship }",
      },

      specialRequirements: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Special needs, medical conditions, etc.",
      },

      status: {
        type: DataTypes.ENUM("active", "suspended", "expired", "cancelled"),
        defaultValue: "active",
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

  VehicleAssignment.associate = (models) => {
    VehicleAssignment.belongsTo(models.students, {
      foreignKey: "studentId",
      as: "student",
    });

    VehicleAssignment.belongsTo(models.vehicles, {
      foreignKey: "vehicleId",
      as: "vehicle",
    });

    VehicleAssignment.belongsTo(models.vehicleroutes, {
      foreignKey: "routeId",
      as: "route",
    });

    VehicleAssignment.belongsTo(models.vehiclestops, {
      foreignKey: "pickupStopId",
      as: "pickupStop",
    });

    VehicleAssignment.belongsTo(models.vehiclestops, {
      foreignKey: "dropoffStopId",
      as: "dropoffStop",
    });

    VehicleAssignment.hasMany(models.vehicleattendance, {
      foreignKey: "assignmentId",
      as: "attendance",
    });
  };

  return VehicleAssignment;
};
