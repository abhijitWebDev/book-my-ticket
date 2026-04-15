import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET || "dev_access_secret";

export function authenticate(req, res, next) {
  const token =
    req.cookies?.access_token ??
    req.headers.authorization?.slice(7); // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ success: false, statusCode: 401, message: "Authentication required." });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    req.user = decoded; // { userId, email, name, iat, exp }
    next();
  } catch {
    return res.status(401).json({ success: false, statusCode: 401, message: "Invalid or expired access token" });
  }
}
