const bcrypt = require("bcryptjs");
const db = require("../models");
const User = db.users;
const Role = db.role;

const createAdminIfEmpty = async () => {
  const role = await Role.findOne({ where: { name: "admin" } });
  const admin = await User.findOne({
    where: { roleId: role.id },
  });

  if (admin) {
    console.log("⏩ Admin already exists");
    return;
  }

  const hashedPassword = await bcrypt.hash(
    process.env.DEFAULT_ADMIN_PASSWORD,
    10,
  );

  await User.create({
    fullname: process.env.DEFAULT_ADMIN_NAME,
    email: process.env.DEFAULT_ADMIN_EMAIL,
    password: hashedPassword,
    roleId: role.id,
  });

  console.log("✔ First admin created");
};

module.exports = createAdminIfEmpty;
