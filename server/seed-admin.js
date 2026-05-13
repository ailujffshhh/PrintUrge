/**
 * Creates an admin user if one with ADMIN_EMAIL does not exist.
 * Run from server/: npm run seed:admin
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@printurge.local";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const name = process.env.ADMIN_NAME || "PrintUrge Admin";

  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "printurge",
  });

  const [rows] = await pool.execute("SELECT id FROM users WHERE email = ?", [email]);
  if (rows.length) {
    console.log("Admin already exists:", email);
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.execute(
    "INSERT INTO users (role_id, name, email, password_hash, status) VALUES (1, ?, ?, ?, 'active')",
    [name, email, hash]
  );
  console.log("Admin created:", email);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
