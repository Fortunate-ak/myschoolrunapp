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
      // NEW — set once, at guardian-profile creation, never updated after.
      // Used to compute the 7-day free trial window server-side so it
      // can't be reset by reinstalling the app.
      trialStartDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
    },
  );

  // Returns whether the 7-day trial window is still open right now.
  // Does NOT consider isSubscribed — callers should check
  // (trialActive || isSubscribed-and-not-expired) together, or just use
  // canUseApp() below.
  Guardian.prototype.isTrialActive = function () {
    const TRIAL_DAYS = 7;
    const trialEnd = new Date(this.trialStartDate);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    return new Date() < trialEnd;
  };

  Guardian.prototype.getTrialDaysLeft = function () {
    if (!this.isTrialActive()) return 0;
    const TRIAL_DAYS = 7;
    const trialEnd = new Date(this.trialStartDate);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    const msLeft = trialEnd - new Date();
    return Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  };

  // Whether the guardian can currently use gated features — either the
  // trial is still running, or they have an active, non-expired paid plan.
  // This is the single source of truth used both by getProfile (to report
  // status to the client) and by createRequest (to actually enforce it).
  Guardian.prototype.canUseApp = function () {
    const subscriptionActive =
      this.isSubscribed &&
      this.subscriptionExpiresAt &&
      new Date() < new Date(this.subscriptionExpiresAt);
    return this.isTrialActive() || subscriptionActive;
  };

  Guardian.associate = (models) => {
    Guardian.belongsTo(models.users, { foreignKey: "userId", as: "user" });

    Guardian.hasMany(models.guardianstudents, {
      foreignKey: "guardianId",
      as: "guardianStudents",
    });

    Guardian.belongsToMany(models.students, {
      through: models.guardianstudents,
      foreignKey: "guardianId",
      otherKey: "studentId",
      as: "students",
    });
  };

  return Guardian;
};