// src/routes/admin.users.routes.js
import express from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 🔐 DEV-ONLY guard. Replace with real JWT+isAdmin in prod.
function requireAdmin(req, res, next) {
  if ((req.headers["x-test-role"] || "") === "admin") return next();
  return res.status(403).json({ error: "Admin only" });
}

/**
 * GET /api/admin/users?search=&role=&page=1&limit=20
 * - search in name/email/roll (case-insensitive)
 * - filter by role (optional)
 * - pagination
 */
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const { search = "", role = "", page = "1", limit = "20" } = req.query;
    const q = {};
    if (search?.trim()) {
      const s = String(search).trim();
      q.$or = [
        { name: { $regex: s, $options: "i" } },
        { email: { $regex: s, $options: "i" } },
        { roll: { $regex: s, $options: "i" } },
      ];
    }
    if (role && ["student", "coordinator", "admin"].includes(role)) {
      q.role = role;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const [items, total] = await Promise.all([
      User.find(q)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * lim)
        .limit(lim)
        .select("-hash") // never send hash
        .lean(),
      User.countDocuments(q),
    ]);

    res.json({
      items,
      total,
      page: pageNum,
      limit: lim,
      pages: Math.ceil(total / lim),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to list users" });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Accepts JSON or multipart/form-data (upload.none()).
 * Editable fields: name, email, role, roll, year, branch, active, password (re-hash).
 */
router.patch("/users/:id", requireAdmin, upload.none(), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, email, role, roll, year, branch, active, password,
    } = req.body || {};

    const update = {};
    if (name != null) update.name = String(name).trim();
    if (email != null) update.email = String(email).trim().toLowerCase();
    if (role != null) {
      const r = String(role).trim();
      if (!["student", "coordinator", "admin"].includes(r)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      update.role = r;
    }
    if (roll != null) update.roll = String(roll).trim();
    if (year != null) update.year = String(year).trim(); // your schema keeps year as String
    if (branch != null) update.branch = String(branch).trim().toUpperCase();
    if (active != null) update.active = String(active) === "true" || active === true;

    // password reset (optional)
    if (password) {
      update.hash = await bcrypt.hash(String(password), 10);
    }

    const doc = await User.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    })
      .select("-hash")
      .lean();

    if (!doc) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true, user: doc });
  } catch (e) {
    if (e?.code === 11000 && e?.keyPattern?.email) {
      return res.status(409).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: e.message || "Failed to update user" });
  }
});

/**
 * DELETE /api/admin/users/:id
 * HARD delete.
 */
router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await User.deleteOne({ _id: id });
    if (r.deletedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ ok: true, deleted: id });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to delete user" });
  }
});

export default router;
