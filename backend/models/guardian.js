module.exports = (sequelize, DataTypes) => {
  const Guardian = sequelize.define(
    "guardians",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      guardianAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      gender: {
        type: DataTypes.ENUM("male", "female", "other"),
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      isSubscribed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      subscriptionPlan: {
        type: DataTypes.ENUM("basic", "family", "premium"),
        allowNull: true,
      },
      subscriptionExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // NOT NULL at the DB level with no default — so it must always be
      // supplied on create. defaultValue: DataTypes.NOW makes Sequelize
      // stamp the current timestamp automatically on every guardian
      // creation, so callers (setGuardianProfile, etc.) don't need to set
      // it explicitly. Adjust if trials should start at a different point
      // (e.g. only once a plan is chosen) rather than at profile creation.
      trialStartDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      paymentMethod: {
        type: DataTypes.ENUM("card", "ecocash", "onemoney", "bank_transfer", "cash_on_pickup"),
        allowNull: true,
      },
      paymentReference: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
    },
  );

  Guardian.associate = (models) => {
    Guardian.belongsTo(models.users, { foreignKey: "userId", as: "user" });

    // Add unique alias for hasMany association
    Guardian.hasMany(models.guardianstudents, {
      foreignKey: "guardianId",
      as: "guardianStudents", // Unique alias
    });

    Guardian.belongsToMany(models.students, {
      through: models.guardianstudents,
      foreignKey: "guardianId",
      otherKey: "studentId",
      as: "students", // Unique alias
    });
  };

  return Guardian;
};
