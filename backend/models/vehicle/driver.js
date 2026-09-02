module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define(
    "drivers",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      profileImage: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      idNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      licenseNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      gender: {
        type: DataTypes.ENUM("male", "female", "other"),
        allowNull: false,
        defaultValue: "male",
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      identityVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      licenseVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      emergencyRideEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
    },
  );

  Driver.associate = (models) => {
    Driver.belongsTo(models.users, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return Driver;
};
