// src/controllers/auth.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
const JWT_SECRET = process.env.JWT_SECRET || "devsecret";
/**
 * POST /api/auth/login
 * Body: { email, password }
 * We ignore client-provided role; server returns the actual role.
 */
export async function login(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+hash +role +active +name +email");
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.hash || "");
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    if (user.active === false) {
      return res.status(403).json({ error: "Account is disabled" });
    }

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      process.env.JWT_SECRET || "devsecret",
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      role: user.role,
      name: user.name,
      email: user.email,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Login failed" });
  }
}

/**
 * POST /api/auth/register  (Admin bootstrap + protected by ADMIN_REG_KEY)
 */
export async function register(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "admin").trim().toLowerCase();
    const adminKey = String(req.body.adminKey || "").trim();

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required." });
    }
    if (role !== "admin") {
      return res.status(403).json({ error: "Public signup disabled for non-admins." });
    }

    const adminCount = await User.countDocuments({ role: "admin" });
    const expectedKey = process.env.ADMIN_REG_KEY || "Admin";
    if (adminCount > 0 && adminKey !== expectedKey) {
      return res.status(403).json({ error: "Invalid Admin Keyword." });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email already registered." });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, hash, role: "admin", active: true });

    return res.json({
      ok: true,
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      bootstrap: adminCount === 0,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Registration failed" });
  }
}
