"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("guardians", "trialStartDate", {
      type: Sequelize.DATE,
      allowNull: false,
      // Existing guardians get "now" as their trial start when this runs —
      // adjust this if you'd rather grandfather existing users in as
      // already-subscribed/unlimited instead of starting their trial clock
      // the day this migration deploys.
      defaultValue: Sequelize.NOW,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("guardians", "trialStartDate");
  },
};