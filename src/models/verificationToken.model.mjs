import pool from "../db.mjs";

export const VerificationTokenModel = {
  create(tokenHash, userId, type, expiresAt) {
    return pool.query(
      `INSERT INTO verification_tokens (token_hash, user_id, type, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tokenHash, userId, type, expiresAt]
    );
  },

  findByHash(tokenHash, type) {
    return pool.query(
      `SELECT * FROM verification_tokens
       WHERE token_hash = $1 AND type = $2 AND expires_at > NOW()`,
      [tokenHash, type]
    );
  },

  deleteByHash(tokenHash) {
    return pool.query("DELETE FROM verification_tokens WHERE token_hash = $1", [tokenHash]);
  },

  // Delete all tokens of a given type for a user (e.g. before creating a new one)
  deleteByUserId(userId, type) {
    return pool.query(
      "DELETE FROM verification_tokens WHERE user_id = $1 AND type = $2",
      [userId, type]
    );
  },
};
