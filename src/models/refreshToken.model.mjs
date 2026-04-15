import pool from "../db.mjs";

export const RefreshTokenModel = {
  create(tokenHash, userId, expiresAt) {
    return pool.query(
      "INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3) RETURNING id",
      [tokenHash, userId, expiresAt]
    );
  },

  findByHash(tokenHash) {
    return pool.query(
      "SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()",
      [tokenHash]
    );
  },

  deleteByHash(tokenHash) {
    return pool.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [tokenHash]);
  },

  deleteByUserId(userId) {
    return pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);
  },
};
