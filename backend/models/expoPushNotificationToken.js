module.exports = (sequelize, DataTypes) => {
  const PushNotificationToken = sequelize.define(
    "pushnotificationtokens",
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
      expoPushToken: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      deviceName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      deviceType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      platform: {
        type: DataTypes.ENUM("ios", "android", "web"),
        allowNull: true,
      },
      appVersion: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastUsed: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
    },
  );

  PushNotificationToken.associate = (models) => {
    PushNotificationToken.belongsTo(models.users, {
      foreignKey: "userId",
      as: "user",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return PushNotificationToken;
};
