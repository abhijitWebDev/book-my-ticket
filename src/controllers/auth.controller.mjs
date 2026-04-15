import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/user.model.mjs";
import { RefreshTokenModel } from "../models/refreshToken.model.mjs";
import { VerificationTokenModel } from "../models/verificationToken.model.mjs";
import { APIResponse } from "../utils/APIResponse.mjs";
import { APIError } from "../utils/APIError.mjs";
import { emailService } from "../utils/emailService.mjs";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCESS_SECRET = process.env.JWT_SECRET || "dev_access_secret";
const REFRESH_DAYS  = 7;
const ACCESS_EXPIRY = "15m";
const APP_URL       = process.env.APP_URL || "http://localhost:8080";

const TOKEN_TYPES = {
  EMAIL_VERIFICATION: "email_verification",
  PASSWORD_RESET:     "password_reset",
};

// ─── Token helpers ────────────────────────────────────────────────────────────

function signAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, name: user.name },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
}

function generateRawToken() {
  return crypto.randomBytes(40).toString("hex"); // 80-char URL-safe string
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function expiryFromNow(hours) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === "production";

function setAccessCookie(res, token) {
  res.cookie("access_token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: 15 * 60 * 1000,
  });
}

function setRefreshCookie(res, token) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
}

function clearAuthCookies(res) {
  res.clearCookie("access_token",  { httpOnly: true, secure: isProd, sameSite: "strict" });
  res.clearCookie("refresh_token", { httpOnly: true, secure: isProd, sameSite: "strict", path: "/api/auth" });
}

// ─── Shared: issue access + refresh tokens ────────────────────────────────────

async function issueTokens(res, user) {
  const accessToken = signAccessToken(user);
  const rawRefresh  = generateRawToken();

  await RefreshTokenModel.create(
    hashToken(rawRefresh),
    user.id,
    expiryFromNow(REFRESH_DAYS * 24)
  );

  setAccessCookie(res, accessToken);
  setRefreshCookie(res, rawRefresh);

  return { accessToken, refreshToken: rawRefresh };
}

// ─── Shared: create a verification/reset token and return the raw value ───────

async function createVerificationToken(userId, type, expiryHours) {
  // Invalidate any existing token of this type for the user first
  await VerificationTokenModel.deleteByUserId(userId, type);

  const raw  = generateRawToken();
  const hash = hashToken(raw);
  await VerificationTokenModel.create(hash, userId, type, expiryFromNow(expiryHours));
  return raw;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

export async function register(req, res) {
  const { name, email, password } = req.body;

  const existing = await UserModel.findByEmail(email);
  if (existing.rows.length > 0) {
    throw new APIError(409, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await UserModel.create(name, email, passwordHash);
  const user = result.rows[0];

  const { accessToken, refreshToken } = await issueTokens(res, user);

  // Send verification email (fire-and-forget)
  const rawToken  = await createVerificationToken(user.id, TOKEN_TYPES.EMAIL_VERIFICATION, 24);
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${rawToken}`;
  emailService.sendVerificationEmail(user, verifyUrl).catch((err) =>
    console.error("[EmailService] Verification email failed:", err.message)
  );

  return new APIResponse(res, 201, "Registration successful. Please verify your email.", {
    user,
    accessToken,
    refreshToken,
  });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const result = await UserModel.findByEmail(email);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new APIError(401, "Invalid email or password");
  }

  const { accessToken, refreshToken } = await issueTokens(res, user);

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    is_verified: user.is_verified,
    created_at: user.created_at,
  };
  return new APIResponse(res, 200, "Login successful", {
    user: safeUser,
    accessToken,
    refreshToken,
  });
}

export async function refresh(req, res) {
  const rawToken = req.cookies?.refresh_token;
  if (!rawToken) throw new APIError(401, "Refresh token missing");

  const tokenHash = hashToken(rawToken);
  const found = await RefreshTokenModel.findByHash(tokenHash);
  if (found.rows.length === 0) throw new APIError(401, "Invalid or expired refresh token");

  // Rotate: delete the used token before issuing a new one
  await RefreshTokenModel.deleteByHash(tokenHash);

  const userResult = await UserModel.findById(found.rows[0].user_id);
  if (userResult.rows.length === 0) throw new APIError(401, "User not found");

  const { accessToken, refreshToken } = await issueTokens(res, userResult.rows[0]);
  return new APIResponse(res, 200, "Token refreshed", { accessToken, refreshToken });
}

export async function logout(req, res) {
  const rawToken = req.cookies?.refresh_token;
  if (rawToken) {
    await RefreshTokenModel.deleteByHash(hashToken(rawToken));
  }
  clearAuthCookies(res);
  return new APIResponse(res, 200, "Logged out successfully");
}

// ─── Email verification ───────────────────────────────────────────────────────

export async function verifyEmail(req, res) {
  const { token } = req.query;
  if (!token) throw new APIError(400, "Verification token is required");

  const found = await VerificationTokenModel.findByHash(
    hashToken(token),
    TOKEN_TYPES.EMAIL_VERIFICATION
  );

  if (found.rows.length === 0) {
    throw new APIError(400, "Invalid or expired verification token");
  }

  const { user_id } = found.rows[0];
  await UserModel.markVerified(user_id);
  await VerificationTokenModel.deleteByHash(hashToken(token));

  return new APIResponse(res, 200, "Email verified successfully");
}

// ─── Forgot password ──────────────────────────────────────────────────────────

export async function forgotPassword(req, res) {
  const { email } = req.body;

  const result = await UserModel.findByEmail(email);
  // Always respond with 200 to avoid leaking which emails are registered
  if (result.rows.length === 0) {
    return new APIResponse(res, 200, "If that email is registered, a reset link has been sent.");
  }

  const user     = result.rows[0];
  const rawToken = await createVerificationToken(user.id, TOKEN_TYPES.PASSWORD_RESET, 1);
  const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;

  emailService.sendPasswordReset(user, resetUrl).catch((err) =>
    console.error("[EmailService] Password reset email failed:", err.message)
  );

  return new APIResponse(res, 200, "If that email is registered, a reset link has been sent.");
}

// ─── Reset password ───────────────────────────────────────────────────────────

export async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token) throw new APIError(400, "Reset token is required");

  const found = await VerificationTokenModel.findByHash(
    hashToken(token),
    TOKEN_TYPES.PASSWORD_RESET
  );

  if (found.rows.length === 0) {
    throw new APIError(400, "Invalid or expired reset token");
  }

  const { user_id } = found.rows[0];
  const passwordHash = await bcrypt.hash(password, 12);

  await UserModel.updatePassword(user_id, passwordHash);
  await VerificationTokenModel.deleteByHash(hashToken(token));

  // Revoke all refresh tokens so existing sessions can't be reused
  await RefreshTokenModel.deleteByUserId(user_id);

  return new APIResponse(res, 200, "Password reset successfully. Please log in again.");
}
