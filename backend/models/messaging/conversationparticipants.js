// models/conversationparticipants.js

module.exports = (sequelize, DataTypes) => {
  const ConversationParticipant = sequelize.define(
    "conversationparticipants",
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
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM("admin", "member"),
        defaultValue: "member",
        allowNull: false,
      },
      lastReadMessageId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      isMuted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      joinedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
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
      indexes: [
        {
          unique: true,
          fields: ["conversationId", "userId"],
        },
      ],
    },
  );

  ConversationParticipant.associate = (models) => {
    ConversationParticipant.belongsTo(models.conversations, {
      foreignKey: "conversationId",
      as: "conversation",
    });

    ConversationParticipant.belongsTo(models.users, {
      foreignKey: "userId",
      as: "user",
    });

    ConversationParticipant.belongsTo(models.messages, {
      foreignKey: "lastReadMessageId",
      as: "lastRead",
    });
  };

  return ConversationParticipant;
};
