import pool from "../db.mjs";
import { SeatModel } from "../models/seat.model.mjs";
import { APIResponse } from "../utils/APIResponse.mjs";
import { APIError } from "../utils/APIError.mjs";
import { emailService } from "../utils/emailService.mjs";
import { getSeatPrice } from "../utils/pricing.mjs";

export async function getSeats(_req, res) {
  const result = await SeatModel.findAll();
  return new APIResponse(res, 200, "Seats fetched successfully", result.rows);
}

export async function bookSeat(req, res) {
  const seatId = req.params.id;
  const { userId, name: userName, email: userEmail } = req.user;

  const { price, category } = getSeatPrice(seatId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const seatResult = await SeatModel.findByIdForUpdate(client, seatId);
    if (seatResult.rows.length === 0) throw new APIError(404, "Seat not found");
    if (seatResult.rows[0].isbooked === 1) throw new APIError(409, "Seat is already booked");

    const userBooking = await SeatModel.findByUserId(client, userId);
    if (userBooking.rows.length > 0) throw new APIError(409, "You have already booked a seat");

    await SeatModel.book(client, seatId, userName, userId);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  emailService
    .sendBookingConfirmation({ name: userName, email: userEmail }, { seatId, category, price })
    .catch((err) => console.error("[EmailService] Booking confirmation failed:", err.message));

  return new APIResponse(res, 200, `Seat ${seatId} booked successfully`, {
    seatId,
    category,
    price,
    bookedBy: userName,
  });
}

export async function releaseSeat(req, res) {
  const seatId = req.params.id;
  const { userId } = req.user;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const seatResult = await SeatModel.findByIdForUpdate(client, seatId);
    if (seatResult.rows.length === 0) throw new APIError(404, "Seat not found");

    const seat = seatResult.rows[0];
    if (seat.isbooked === 0)     throw new APIError(409, "Seat is not booked");
    if (seat.user_id !== userId) throw new APIError(403, "You can only release your own seat");

    const result = await SeatModel.release(client, seatId, userId);
    if (result.rowCount === 0)   throw new APIError(403, "You can only release your own seat");

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return new APIResponse(res, 200, `Seat ${seatId} released successfully`, { seatId });
}
