// models/guardianStudent.js
module.exports = (sequelize, DataTypes) => {
  const GuardianStudent = sequelize.define(
    "guardianstudents",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      guardianId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      studentId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      relationshipToStudent: {
        type: DataTypes.ENUM(
          "father",
          "mother",
          "guardian",
          "aunt",
          "uncle",
          "sister",
          "brother",
          "grandfather",
          "grandmother",
        ),
        allowNull: false,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["guardianId", "studentId"],
        },
      ],
    },
  );

  GuardianStudent.associate = (models) => {
    GuardianStudent.belongsTo(models.guardians, {
      foreignKey: "guardianId",
    });

    GuardianStudent.belongsTo(models.students, {
      foreignKey: "studentId",
    });
  };

  return GuardianStudent;
};
