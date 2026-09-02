module.exports = (sequelize, DataTypes) => {
  const MessageAttachment = sequelize.define(
    "messageattachments",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      messageId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      fileName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      filePath: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileSize: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      mimeType: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
    },
  );

  MessageAttachment.associate = (models) => {
    MessageAttachment.belongsTo(models.messages, {
      foreignKey: "messageId",
      as: "message",
    });
  };

  return MessageAttachment;
};
