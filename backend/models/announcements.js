module.exports = (sequelize, DataTypes) => {
  const Announcement = sequelize.define(
    "announcements",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      authorId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT("long"),
        allowNull: false,
      },
      audienceType: {
        type: DataTypes.ENUM(
          "all",
          "student",
          "teacher",
          "guardian",
          "guard",
          "driver",
          "admin",
          "specific_class",
          "specific_grade",
          "multiple_roles",
        ),
        defaultValue: "all",
        allowNull: false,
      },
      audienceIds: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      priority: {
        type: DataTypes.ENUM("low", "medium", "high", "urgent"),
        defaultValue: "medium",
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
    },
  );

  Announcement.associate = (models) => {
    Announcement.belongsTo(models.users, {
      foreignKey: "authorId",
      as: "author",
    });
  };

  return Announcement;
};
