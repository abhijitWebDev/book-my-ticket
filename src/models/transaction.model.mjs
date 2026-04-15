import pool from "../db.mjs";

export const TransactionModel = {
  create({ userId, seatId, amount, cardLast4 }) {
    return pool.query(
      `INSERT INTO transactions (user_id, seat_id, amount, card_last4)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [userId, seatId, amount, cardLast4]
    );
  },

  existsForSeatAndUser(seatId, userId) {
    return pool.query(
      `SELECT 1 FROM transactions WHERE seat_id = $1 AND user_id = $2 LIMIT 1`,
      [seatId, userId]
    );
  },
};
