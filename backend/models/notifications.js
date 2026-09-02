module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "notifications",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: true },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      notifType: {
        type: DataTypes.ENUM(
          "info",
          "success",
          "warning",
          "error",
          "emergency",
          "sos",
          "alert",
          "message",
        ),
        defaultValue: "info",
      },
      message: { type: DataTypes.TEXT },
      roleId: { type: DataTypes.UUID, allowNull: true },
      isGlobal: { type: DataTypes.BOOLEAN, defaultValue: false },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      entityType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      entityId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
    },
  );

  Notification.associate = (models) => {
    Notification.belongsTo(models.users, {
      foreignKey: "userId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    Notification.belongsTo(models.role, { foreignKey: "roleId", as: "role" });
  };

  return Notification;
};
