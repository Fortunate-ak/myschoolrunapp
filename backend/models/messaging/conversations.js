// models/conversations.js

module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define(
    "conversations",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("private", "group", "route"),
        defaultValue: "private",
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      classId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      routeId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "For route channels - references vehicleroutes table",
      },
      lastMessageAt: {
        type: DataTypes.DATE,
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

  Conversation.associate = (models) => {
    Conversation.belongsTo(models.users, {
      foreignKey: "createdBy",
      as: "creator",
    });

    // Add association to vehicleroutes for route channels
    Conversation.belongsTo(models.vehicleroutes, {
      foreignKey: "routeId",
      as: "route",
    });

    Conversation.hasMany(models.conversationparticipants, {
      foreignKey: "conversationId",
      as: "participants",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    Conversation.hasMany(models.messages, {
      foreignKey: "conversationId",
      as: "messages",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return Conversation;
};
