// src/middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "devsecret";
const ALLOW_DEV_BYPASS = process.env.ALLOW_DEV_BYPASS === "1"; // ✅ default off

export const auth = async (req, res, next) => {
  try {
    // DEV-ONLY backdoor, guarded by env flag
    const testRole = ALLOW_DEV_BYPASS ? req.header("x-test-role") : null;
    if (testRole) {
      req.user = { id: "dev-user-id", sub: "dev-user-id", role: testRole };
      return next();
    }

    const hdr = req.headers.authorization || "";
    if (!hdr.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }

    const token = hdr.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: "Invalid token: " + (e?.message || "verify failed") });
    }

    const userId = payload.sub || payload.id;
    if (!userId) return res.status(401).json({ error: "Token missing subject" });

    const user = await User.findById(userId).select("_id role roll name");
    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = { id: user._id, sub: user._id, role: user.role, roll: user.roll, name: user.name };
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
};
