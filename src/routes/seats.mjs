import express from "express";
import { authenticate } from "../middleware/auth.mjs";
import { validate } from "../middleware/validate.mjs";
import { bookSeatDto } from "../dtos/seats.dto.mjs";
import { getSeats, bookSeat, releaseSeat } from "../controllers/seats.controller.mjs";
import { asyncHandler } from "../utils/asyncHandler.mjs";

const router = express.Router();

router.get("/",              asyncHandler(getSeats));
router.post("/:id/book",    authenticate, validate(bookSeatDto, "params"), asyncHandler(bookSeat));
router.delete("/:id/book",  authenticate, validate(bookSeatDto, "params"), asyncHandler(releaseSeat));

export default router;
