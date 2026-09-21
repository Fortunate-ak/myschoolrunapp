module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("guardians", "paymentMethod", {
      type: Sequelize.ENUM("card", "ecocash", "onemoney", "bank_transfer", "cash_on_pickup"),
      allowNull: true,
    });
    await queryInterface.addColumn("guardians", "paymentReference", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("guardians", "paymentMethod");
    await queryInterface.removeColumn("guardians", "paymentReference");
  },
};
