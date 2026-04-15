/**
 * Seat pricing rules (shared by controller and can be inlined in frontend).
 *
 *   Seats  1–8   → Front Row  ₹100
 *   Seats  9–20  → Back Row   ₹150
 */
export function getSeatPrice(seatId) {
  return Number(seatId) <= 8
    ? { price: 100, category: "Front Row" }
    : { price: 150, category: "Back Row" };
}
