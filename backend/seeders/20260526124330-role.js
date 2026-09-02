"use strict";

const { v4: uuidv4 } = require("uuid");

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if roles already exist
    const existingRoles = await queryInterface.sequelize.query(
      `SELECT name FROM role WHERE name IN ('admin', 'super-admin', 'student', 'teacher', 'chef', 'guardian', 'driver', 'senior-teacher', 'nurse', 'sports-director', 'procurement-officer', 'bursar', 'guard')`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    const existingRoleNames = new Set(existingRoles.map((r) => r.name));

    const rolesToInsert = [];
    const allRoles = ["admin", "super-admin", "student", "guardian", "driver"];

    for (const roleName of allRoles) {
      if (!existingRoleNames.has(roleName)) {
        rolesToInsert.push({
          id: uuidv4(),
          name: roleName,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (rolesToInsert.length > 0) {
      await queryInterface.bulkInsert("role", rolesToInsert, {});
      console.log(`✅ Inserted ${rolesToInsert.length} new roles`);
    } else {
      console.log("✅ All roles already exist, skipping...");
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("role", null, {});
  },
};
