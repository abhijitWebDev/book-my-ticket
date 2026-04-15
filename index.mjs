import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authenticate } from "./src/middleware/auth.mjs";
import authRouter from "./src/routes/auth.mjs";
import seatsRouter from "./src/routes/seats.mjs";
import pool from "./src/db.mjs";
import { APIError } from "./src/utils/APIError.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const port = process.env.PORT || 8080;

// ---------------------------------------------------------------------------
// Auto-migrate: create users table and add user_id column to seats if needed
// ---------------------------------------------------------------------------
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           SERIAL PRIMARY KEY,
        name         VARCHAR(255) NOT NULL,
        email        VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at   TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS seats (
        id       SERIAL PRIMARY KEY,
        name     VARCHAR(255),
        isbooked INT DEFAULT 0
      )
    `);

    // Seed seats only if the table is empty
    await pool.query(`
      INSERT INTO seats (isbooked)
      SELECT 0 FROM generate_series(1, 20)
      WHERE NOT EXISTS (SELECT 1 FROM seats LIMIT 1)
    `);

    // Add user_id FK to seats (idempotent – safe to run every time)
    await pool.query(`
      ALTER TABLE seats
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)
    `);

    // Refresh token store
    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         SERIAL PRIMARY KEY,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Email verification & password-reset token store
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id         SERIAL PRIMARY KEY,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       VARCHAR(30) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Track whether a user has verified their email
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // Payment transaction log
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        seat_id    INTEGER NOT NULL REFERENCES seats(id),
        amount     INTEGER NOT NULL,
        card_last4 CHAR(4) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log("Database schema is up to date.");
  } catch (err) {
    console.error("DB init error:", err.message);
    process.exit(1);
  }
}

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://127.0.0.1:5500",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json()); // parse JSON request bodies

// ── API routes (must come before static so POST/PUT reach the router) ────────
app.use("/api/auth",  authRouter);
app.use("/api/seats", seatsRouter);

// ── Static files & HTML frontend ─────────────────────────────────────────────
app.use(express.static(__dirname));
app.get("/", (_req, res) => res.sendFile(__dirname + "/index.html"));
// Password-reset emails link here; serve the SPA so JS can pick up ?token=
app.get("/reset-password", (_req, res) => res.sendFile(__dirname + "/index.html"));

// ── Legacy endpoints (kept for backwards compatibility) ──────────────────────

// GET /seats – list all seats (public, unchanged)
app.get("/seats", async (_req, res) => {
  const result = await pool.query("select * from seats");
  res.send(result.rows);
});

// PUT /:id/:name – book a seat (now requires authentication)
// The name in the URL is still accepted but the booking is tied to the
// authenticated user so it cannot be spoofed.
app.put("/:id/:name", authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    // Use the authenticated user's name from the JWT for security
    const name = req.user.name;
    const userId = req.user.userId;

    const conn = await pool.connect();
    await conn.query("BEGIN");

    const sql = "SELECT * FROM seats where id = $1 and isbooked = 0 FOR UPDATE";
    const result = await conn.query(sql, [id]);

    if (result.rowCount === 0) {
      await conn.query("ROLLBACK");
      conn.release();
      return res.status(409).json({ error: "Seat already booked" });
    }

    // Prevent the same user from booking more than one seat
    const userBooking = await conn.query(
      "SELECT id FROM seats WHERE user_id = $1 AND isbooked = 1",
      [userId]
    );
    if (userBooking.rows.length > 0) {
      await conn.query("ROLLBACK");
      conn.release();
      return res.status(409).json({ error: "You have already booked a seat" });
    }

    const sqlU = "update seats set isbooked = 1, name = $2, user_id = $3 where id = $1";
    const updateResult = await conn.query(sqlU, [id, name, userId]);

    await conn.query("COMMIT");
    conn.release();
    res.send(updateResult);
  } catch (ex) {
    console.log(ex);
    res.status(500).json({ error: "Booking failed" });
  }
});

// ── Global error handler ──────────────────────────────────────────────────────
// Must be registered after all routes. Express identifies it by the 4-arg signature.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      success: false,
      statusCode: err.statusCode,
      message: err.message,
      ...(err.details.length > 0 && { details: err.details }),
    });
  }

  console.error(err);
  res.status(500).json({ success: false, statusCode: 500, message: "Internal server error" });
});

// ── Start server ─────────────────────────────────────────────────────────────
await initDB();
app.listen(port, (err) => {
  if (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
  console.log(`Server running on port ${port}`);
});
