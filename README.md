# Book My Ticket

A full-stack cinema seat booking application built for the **ChaiCode Hackathon**.

Users can register, log in, and book (or release) a seat for the currently showing film. Seats are locked at the database level using `SELECT … FOR UPDATE` transactions to prevent double-booking under concurrent requests.

---

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Backend    | Node.js (ESM), Express 5                      |
| Database   | PostgreSQL (via `pg` connection pool)          |
| Auth       | JWT access tokens + HTTP-only refresh cookies |
| Validation | Joi                                           |
| Email      | autosendjs (Autosend API)                     |
| Frontend   | Vanilla JS, Tailwind CSS (CDN)                |

---

## Features

- **Register / Login** with full client-side and server-side validation
- **Email verification** link sent on registration (24-hour expiry)
- **Forgot / Reset password** flow via time-limited single-use tokens (1-hour expiry)
- **JWT authentication** — 15-minute access tokens rotated via 7-day refresh tokens
- **Seat booking** with row-level `FOR UPDATE` locks to prevent race conditions
- **One seat per user** — each account can hold at most one seat at a time
- **Tiered pricing** — Front Row (seats 1–8) ₹100, Back Row (seats 9–20) ₹150
- **Booking confirmation emails** sent via Autosend
- **Auto-migrate** — the full database schema is created/updated on server start; no manual migrations needed

---

## Project Structure

```
book-my-ticket/
├── index.mjs                    # Express app entry point + DB auto-migration
├── index.html                   # Single-page frontend
├── main.js                      # Frontend JS (auth, seat grid, API calls)
├── package.json
├── .env.example                 # Environment variable template
└── src/
    ├── db.mjs                   # pg connection pool
    ├── controllers/
    │   ├── auth.controller.mjs  # register, login, logout, refresh, verify, forgot/reset password
    │   └── seats.controller.mjs # getSeats, bookSeat, releaseSeat
    ├── routes/
    │   ├── auth.mjs             # /api/auth/* routes
    │   └── seats.mjs            # /api/seats/* routes
    ├── models/
    │   ├── user.model.mjs
    │   ├── seat.model.mjs
    │   ├── refreshToken.model.mjs
    │   └── verificationToken.model.mjs
    ├── middleware/
    │   ├── auth.mjs             # JWT authenticate middleware
    │   └── validate.mjs         # Joi validation middleware factory
    ├── dtos/
    │   ├── auth.dto.mjs         # Joi schemas for auth endpoints
    │   └── seats.dto.mjs        # Joi schema for seat ID param
    └── utils/
        ├── APIError.mjs         # Custom error class with statusCode + details
        ├── APIResponse.mjs      # Consistent success response envelope
        ├── asyncHandler.mjs     # Wraps async controllers for error forwarding
        ├── emailService.mjs     # Autosend wrapper with app-level template helpers
        └── pricing.mjs          # Seat tier / price lookup (shared by server and frontend)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in the values in `.env`:

| Variable            | Description                                             | Default                        |
|---------------------|---------------------------------------------------------|--------------------------------|
| `PORT`              | Port the server listens on                              | `8080`                         |
| `DATABASE_URL`      | PostgreSQL connection string                            | —                              |
| `JWT_SECRET`        | Secret used to sign JWT access tokens                   | `dev_access_secret` (insecure) |
| `APP_URL`           | Public base URL (used in email links)                   | `http://localhost:8080`        |
| `CORS_ORIGIN`       | Allowed CORS origin for the frontend                    | `http://127.0.0.1:5500`        |
| `MOVIE_NAME`        | Film name shown in the UI and emails                    | `Dhurandhar The Revenge`       |
| `AUTOSEND_API_KEY`  | Autosend API key (emails are silently skipped if unset) | —                              |
| `EMAIL_FROM`        | Sender address for outgoing emails                      | `noreply@example.com`          |

### 3. Start the server

```bash
# Development — auto-restarts on file changes
npm run dev

# Production
npm start
```

The server applies all database migrations on first start; no manual SQL is needed.

Open `http://localhost:8080` in your browser.

> **Live Server users:** If you open `index.html` via VS Code Live Server (port 5500), the frontend automatically prefixes API calls with `http://127.0.0.1:8080`. Ensure the backend is running and `CORS_ORIGIN` is set to `http://127.0.0.1:5500`.

---

## API Reference

All responses follow a uniform envelope:

**Success**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "...",
  "data": {}
}
```

**Error**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "...",
  "details": ["field-level messages — only present on validation errors"]
}
```

> **Protected routes** require a valid JWT passed as `Authorization: Bearer <token>` header, or via the `access_token` HTTP-only cookie (set automatically on login).

---

### POST `/api/auth/register`

Create a new account. Sends a verification email on success.

**Request body**
```json
{
  "name": "Jassi",
  "email": "jassi@example.com",
  "password": "secret123"
}
```

| Field      | Rules                          |
|------------|--------------------------------|
| `name`     | string, 2–100 chars, required  |
| `email`    | valid email, required          |
| `password` | string, 6–128 chars, required  |

**Response `201`**
```json
{
  "data": {
    "user": { "id": 1, "name": "Jassi", "email": "jassi@example.com", "created_at": "..." },
    "accessToken": "<jwt>",
    "refreshToken": "<token>"
  }
}
```

---

### POST `/api/auth/login`

Log in with existing credentials.

**Request body**
```json
{
  "email": "jassi@example.com",
  "password": "secret123"
}
```

**Response `200`**
```json
{
  "data": {
    "user": { "id": 1, "name": "Jassi", "email": "jassi@example.com", "is_verified": true, "created_at": "..." },
    "accessToken": "<jwt>",
    "refreshToken": "<token>"
  }
}
```

Sets `access_token` (15 min) and `refresh_token` (7 days) as HTTP-only cookies.

**Errors**

| Status | Message                    |
|--------|----------------------------|
| `401`  | Invalid email or password  |

---

### POST `/api/auth/logout`

Clears session cookies and invalidates the refresh token.

**Request body** — none

**Response `200`** — `data: null`

---

### POST `/api/auth/refresh`

Issues a new access token using the `refresh_token` cookie. The old refresh token is deleted and a new one is set (rotation).

**Request body** — none (reads `refresh_token` cookie automatically)

**Response `200`**
```json
{
  "data": {
    "accessToken": "<new-jwt>",
    "refreshToken": "<new-token>"
  }
}
```

**Errors**

| Status | Message                            |
|--------|------------------------------------|
| `401`  | Refresh token missing              |
| `401`  | Invalid or expired refresh token   |

---

### GET `/api/auth/verify-email?token=<token>`

Verifies a user's email address using the token from the verification email.

**Query param** — `token` (the raw token from the email link)

**Response `200`** — `"Email verified successfully"`

**Errors**

| Status | Message                                    |
|--------|--------------------------------------------|
| `400`  | Verification token is required             |
| `400`  | Invalid or expired verification token      |

---

### POST `/api/auth/forgot-password`

Sends a password-reset link to the given email. Always responds with `200` to avoid revealing registered addresses.

**Request body**
```json
{
  "email": "jassi@example.com"
}
```

**Response `200`** — `"If that email is registered, a reset link has been sent."`

---

### POST `/api/auth/reset-password`

Resets the password using the token from the reset email. Invalidates all existing sessions on success.

**Request body**
```json
{
  "token": "<token-from-email>",
  "password": "newpassword123"
}
```

| Field      | Rules                         |
|------------|-------------------------------|
| `token`    | string, required              |
| `password` | string, 6–128 chars, required |

**Response `200`** — `"Password reset successfully. Please log in again."`

**Errors**

| Status | Message                         |
|--------|---------------------------------|
| `400`  | Reset token is required         |
| `400`  | Invalid or expired reset token  |

---

### GET `/api/seats`

List all 20 seats with their current booking status. **Public — no auth required.**

**Response `200`**
```json
{
  "data": [
    { "id": 1, "name": null,    "isbooked": 0, "user_id": null },
    { "id": 2, "name": "Jassi", "isbooked": 1, "user_id": 1   }
  ]
}
```

---

### POST `/api/seats/:id/book` — **Protected**

Book a seat by its ID. A user can hold at most one seat at a time.

**URL param** — `id`: integer seat number (1–20)

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request body** — none

**Response `200`**
```json
{
  "data": {
    "seatId": "5",
    "category": "Front Row",
    "price": 100,
    "bookedBy": "Jassi"
  }
}
```

**Errors**

| Status | Message                         |
|--------|---------------------------------|
| `401`  | Authentication required         |
| `404`  | Seat not found                  |
| `409`  | Seat is already booked          |
| `409`  | You have already booked a seat  |

---

### DELETE `/api/seats/:id/book` — **Protected**

Release a seat you previously booked.

**URL param** — `id`: integer seat number (1–20)

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request body** — none

**Response `200`**
```json
{
  "data": { "seatId": "5" }
}
```

**Errors**

| Status | Message                            |
|--------|------------------------------------|
| `401`  | Authentication required            |
| `404`  | Seat not found                     |
| `409`  | Seat is not booked                 |
| `403`  | You can only release your own seat |

---

### Legacy endpoints

These are kept for backwards compatibility with the original starter code.

| Method | Path          | Auth     | Description                              |
|--------|---------------|----------|------------------------------------------|
| GET    | `/seats`      |          | Same as `GET /api/seats`                 |
| PUT    | `/:id/:name`  | Required | Book a seat (name taken from JWT, not URL) |

---

## Authentication Flow

```
1. Register / Login  →  access token (15 min) + refresh token cookie (7 days)

2. Protected requests:
     Authorization: Bearer <accessToken>
   or the access_token cookie is read automatically (same-origin)

3. POST /api/auth/refresh  →  rotates both tokens (old refresh token is deleted)

4. POST /api/auth/logout   →  deletes refresh token from DB, clears both cookies
```

---

## Key Design Decisions

- **Row-level locking** — `SELECT … FOR UPDATE` inside a transaction prevents two concurrent requests from booking the same seat.
- **One seat per user** — enforced inside the same transaction as the seat lock to prevent TOCTOU races.
- **Token rotation** — each use of a refresh token deletes the old one and issues a new pair, limiting the blast radius of a stolen token.
- **Email enumeration protection** — `POST /api/auth/forgot-password` always returns `200` regardless of whether the address is registered.
- **Auto-migration** — `initDB()` runs `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements on every startup, making the app deployable with zero manual setup.
- **Uniform response shape** — `APIResponse` and `APIError` enforce a consistent JSON envelope across every endpoint, making frontend error handling straightforward.

---

## License

ISC
