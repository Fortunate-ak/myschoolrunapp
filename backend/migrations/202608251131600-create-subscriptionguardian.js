// migrations/XXXXXXXX-add-subscription-to-guardians.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("guardians", "isSubscribed", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn("guardians", "subscriptionPlan", {
      type: Sequelize.ENUM("basic", "family", "premium"),
      allowNull: true,
    });
    await queryInterface.addColumn("guardians", "subscriptionExpiresAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("guardians", "isSubscribed");
    await queryInterface.removeColumn("guardians", "subscriptionPlan");
    await queryInterface.removeColumn("guardians", "subscriptionExpiresAt");
  },
};