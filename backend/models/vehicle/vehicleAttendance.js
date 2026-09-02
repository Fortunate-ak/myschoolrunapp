module.exports = (sequelize, DataTypes) => {
  const VehicleAttendance = sequelize.define(
    "vehicleattendance",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      assignmentId: {
        type: DataTypes.UUID,
        allowNull: false,
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

      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      tripType: {
        type: DataTypes.ENUM("pickup", "dropoff"),
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM(
          "present",
          "absent",
          "late",
          "early_exit",
          "no_show",
        ),
        defaultValue: "present",
      },

      boardingStopId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      boardingTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      exitStopId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      exitTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      markedById: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Driver or attendant who marked attendance",
      },

      parentNotified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      notificationSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
    },
  );

  VehicleAttendance.associate = (models) => {
    VehicleAttendance.belongsTo(models.vehicleassignments, {
      foreignKey: "assignmentId",
      as: "assignment",
    });

    VehicleAttendance.belongsTo(models.students, {
      foreignKey: "studentId",
      as: "student",
    });

    VehicleAttendance.belongsTo(models.vehicles, {
      foreignKey: "vehicleId",
      as: "vehicle",
    });

    VehicleAttendance.belongsTo(models.vehicleroutes, {
      foreignKey: "routeId",
      as: "route",
    });

    VehicleAttendance.belongsTo(models.vehiclestops, {
      foreignKey: "boardingStopId",
      as: "boardingStop",
    });

    VehicleAttendance.belongsTo(models.vehiclestops, {
      foreignKey: "exitStopId",
      as: "exitStop",
    });

    VehicleAttendance.belongsTo(models.users, {
      foreignKey: "markedById",
      as: "markedBy",
    });
  };

  return VehicleAttendance;
};
