module.exports = (sequelize, DataTypes) => {
  const UserSubscription = sequelize.define(
    "usersubscriptions",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      guardianId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      planId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(
          "active",
          "expired",
          "cancelled",
          "pending_payment",
        ),
      },
      startDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },

      endDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      autoRenew: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      paymentReference: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentMethod: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "free_trial",
      },
      amountPaid: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "USD",
      },

      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
    },
  );

  UserSubscription.associate = (models) => {
    UserSubscription.belongsTo(models.guardians, {
      foreignKey: "guardianId",
      as: "guardian",
    });
    UserSubscription.belongsTo(models.subscriptionplans, {
      foreignKey: "planId",
      as: "plan",
    });
  };

  return UserSubscription;
};
