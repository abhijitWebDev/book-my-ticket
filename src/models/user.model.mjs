import pool from "../db.mjs";

export const UserModel = {
  findByEmail(email) {
    return pool.query("SELECT * FROM users WHERE email = $1", [email]);
  },

  create(name, email, passwordHash) {
    return pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at",
      [name, email, passwordHash]
    );
  },

  findById(id) {
    return pool.query(
      "SELECT id, name, email, is_verified, created_at FROM users WHERE id = $1",
      [id]
    );
  },

  markVerified(id) {
    return pool.query(
      "UPDATE users SET is_verified = TRUE WHERE id = $1",
      [id]
    );
  },

  updatePassword(id, passwordHash) {
    return pool.query(
      "UPDATE users SET password_hash = $2 WHERE id = $1",
      [id, passwordHash]
    );
  },
};
