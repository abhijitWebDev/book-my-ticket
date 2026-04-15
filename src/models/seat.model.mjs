import pool from "../db.mjs";

export const SeatModel = {
  findAll() {
    return pool.query("SELECT * FROM seats ORDER BY id ASC");
  },

  // Must be called with a transaction client to hold the row lock
  findByIdForUpdate(client, seatId) {
    return client.query("SELECT * FROM seats WHERE id = $1 FOR UPDATE", [seatId]);
  },

  findByUserId(client, userId) {
    return client.query(
      "SELECT id FROM seats WHERE user_id = $1 AND isbooked = 1",
      [userId]
    );
  },

  book(client, seatId, name, userId) {
    return client.query(
      "UPDATE seats SET isbooked = 1, name = $1, user_id = $2 WHERE id = $3",
      [name, userId, seatId]
    );
  },

  // Returns rowCount = 0 if seat doesn't exist or isn't owned by this user
  release(client, seatId, userId) {
    return client.query(
      "UPDATE seats SET isbooked = 0, name = NULL, user_id = NULL WHERE id = $1 AND user_id = $2",
      [seatId, userId]
    );
  },
};
