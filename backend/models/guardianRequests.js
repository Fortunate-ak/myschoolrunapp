module.exports = (sequelize, DataTypes) => {
  const GuardianRequest = sequelize.define(
    "guardianrequests",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      guardianId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      requestType: {
        type: DataTypes.ENUM("student_onboard_request", "route_stop_request"),
        allowNull: false,
      },
      numberOfStudents: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      students: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      studentId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      vehicleStopId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      routeId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      homeLocation: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      schoolLocation: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("approved", "pending", "rejected", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
      indexes: [
        {
          fields: ["guardianId", "status"],
        },
        {
          fields: ["driverId"],
        },
        {
          fields: ["requestType"],
        },
        {
          fields: ["driverId", "status"],
        },
        {
          fields: ["guardianId", "requestType", "status"],
        },
      ],
    },
  );

  GuardianRequest.associate = (models) => {
    GuardianRequest.belongsTo(models.guardians, {
      foreignKey: "guardianId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      as: "guardian",
    });

    GuardianRequest.belongsTo(models.drivers, {
      foreignKey: "driverId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      as: "driver",
    });

    GuardianRequest.belongsTo(models.vehicleroutes, {
      foreignKey: "routeId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      as: "route",
    });

    GuardianRequest.belongsTo(models.students, {
      foreignKey: "studentId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      as: "student",
    });
  };

  return GuardianRequest;
};
