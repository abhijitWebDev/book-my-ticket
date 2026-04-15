import express from "express";
import {
  register,
  login,
  logout,
  refresh,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.mjs";
import { validate } from "../middleware/validate.mjs";
import { registerDto, loginDto, forgotPasswordDto, resetPasswordDto } from "../dtos/auth.dto.mjs";
import { asyncHandler } from "../utils/asyncHandler.mjs";

const router = express.Router();

// Auth
router.post("/register", validate(registerDto), asyncHandler(register));
router.post("/login",    validate(loginDto),    asyncHandler(login));
router.post("/refresh",                         asyncHandler(refresh));
router.post("/logout",                          asyncHandler(logout));

// Email verification
router.get("/verify-email", asyncHandler(verifyEmail));

// Password reset
router.post("/forgot-password", validate(forgotPasswordDto), asyncHandler(forgotPassword));
router.post("/reset-password",  validate(resetPasswordDto),  asyncHandler(resetPassword));

export default router;
