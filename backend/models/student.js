module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define(
    "students",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },

      fullname: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      schoolAddress: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: "{ latitude, longitude, address }",
      },

      homeAddress: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: "{ latitude, longitude, address }",
      },

      vehicleRouteId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      vehicleStopId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      gender: {
        type: DataTypes.ENUM("male", "female", "other"),
        allowNull: false,
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

  Student.associate = (models) => {
    Student.hasMany(models.guardianstudents, {
      foreignKey: "studentId",
      as: "guardianStudents", // Unique alias
    });

    Student.belongsTo(models.vehicleroutes, {
      foreignKey: "vehicleRouteId",
      as: "vehicleRoute",
    });

    Student.belongsToMany(models.guardians, {
      through: models.guardianstudents,
      foreignKey: "studentId",
      otherKey: "guardianId",
      as: "guardians", // Unique alias
    });
  };

  return Student;
};
