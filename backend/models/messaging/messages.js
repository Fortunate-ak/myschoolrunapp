// models/messages.js - updated version

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    "messages",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      conversationId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      messageType: {
        type: DataTypes.ENUM("text", "file", "image", "system"),
        defaultValue: "text",
        allowNull: false,
      },
      isEdited: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      editedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      deletedFor: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      readBy: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      deliveredTo: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
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

  Message.associate = (models) => {
    Message.belongsTo(models.conversations, {
      foreignKey: "conversationId",
      as: "conversation",
    });

    Message.belongsTo(models.users, {
      foreignKey: "senderId",
      as: "sender",
    });

    Message.hasMany(models.messageattachments, {
      foreignKey: "messageId",
      as: "attachments",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return Message;
};
