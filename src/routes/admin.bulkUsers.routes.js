// src/routes/admin.bulkUsers.routes.js
import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// 🔐 DEV-ONLY guard. Replace with real JWT+isAdmin middleware in prod.
function requireAdmin(req, res, next) {
  // if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  if ((req.headers["x-test-role"] || "") === "admin") return next();
  return res.status(403).json({ error: "Admin only" });
}

function ok(v) {
  return v !== undefined && v !== null && String(v).trim().length > 0;
}

/* =========================
   POST /api/admin/bulk-students
   CSV header EXACTLY:
   email,name,password,regNo,year,semester,branch
   ========================= */
router.post("/bulk-students", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const text = req.file.buffer.toString("utf8");
    const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true });

    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const line = i + 2;
      const r = rows[i];
      try {
        const email = (r.email || "").toLowerCase().trim();
        const name = (r.name || "").trim();
        const password = String(r.password || "");
        const regNo = (r.regNo || "").trim();
        const yearNum = Number(r.year);
        const semNum = Number(r.semester);
        const branch = (r.branch || "").trim();

        if (!ok(email)) throw new Error("Missing email");
        if (!ok(name)) throw new Error("Missing name");
        if (!ok(password)) throw new Error("Missing password");
        if (!ok(regNo)) throw new Error("Missing regNo");
        if (!Number.isFinite(yearNum)) throw new Error("Invalid year");
        if (!Number.isFinite(semNum)) throw new Error("Invalid semester");
        if (!ok(branch)) throw new Error("Missing branch");

        const exists = await User.findOne({ email }).lean();
        if (exists) { out.push({ line, status: "skipped", email, reason: "Already exists" }); continue; }

        const hash = await bcrypt.hash(password, 10);

        const u = await User.create({
          name,
          email,
          role: "student",
          roll: regNo,                 // schema has `roll`
          year: String(yearNum),       // schema keeps year as String
          branch,
          hash,                        // 🔐 store hash (not password)
          active: true,
        });

        out.push({ line, status: "created", email, id: u._id.toString() });
      } catch (e) {
        out.push({ line, status: "error", email: r?.email || "-", reason: e.message || String(e) });
      }
    }

    return res.json({ ok: true, summary: { total: rows.length, rows: out } });
  } catch (e) {
    console.error("bulk-students error:", e);
    return res.status(500).json({ error: e.message || "Failed to process students CSV" });
  }
});

/* =========================
   POST /api/admin/bulk-faculty
   CSV header EXACTLY:
   email,name,password,department
   NOTE: your enum is ['student','coordinator','admin'] → use 'coordinator'
   ========================= */
router.post("/bulk-faculty", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const text = req.file.buffer.toString("utf8");
    const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true });

    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const line = i + 2;
      const r = rows[i];
      try {
        const email = (r.email || "").toLowerCase().trim();
        const name = (r.name || "").trim();
        const password = String(r.password || "");
        const department = (r.department || r.branch || "").trim();

        if (!ok(email)) throw new Error("Missing email");
        if (!ok(name)) throw new Error("Missing name");
        if (!ok(password)) throw new Error("Missing password");

        const exists = await User.findOne({ email }).lean();
        if (exists) { out.push({ line, status: "skipped", email, reason: "Already exists" }); continue; }

        const hash = await bcrypt.hash(password, 10);

        const u = await User.create({
          name,
          email,
          role: "coordinator",         // enum-safe
          branch: department || undefined,
          hash,                        // 🔐
          active: true,
        });

        out.push({ line, status: "created", email, id: u._id.toString() });
      } catch (e) {
        out.push({ line, status: "error", email: r?.email || "-", reason: e.message || String(e) });
      }
    }

    return res.json({ ok: true, summary: { total: rows.length, rows: out } });
  } catch (e) {
    console.error("bulk-faculty error:", e);
    return res.status(500).json({ error: e.message || "Failed to process faculty CSV" });
  }
});


// -----------------------------
// Manual create endpoints (FormData-friendly)
// -----------------------------

// POST /api/admin/create-student
// body: (JSON or multipart) { email,name,password,regNo,year,semester,branch }
router.post("/create-student", requireAdmin, upload.none(), async (req, res) => {
  try {
    const { email, name, password, regNo, year, semester, branch } = req.body || {};
    const e = String(email || "").toLowerCase().trim();

    if (!e) return res.status(400).json({ error: "Email required" });
    if (!name) return res.status(400).json({ error: "Name required" });
    if (!password) return res.status(400).json({ error: "Password required" });
    if (!regNo) return res.status(400).json({ error: "regNo required" });
    if (year == null || year === "") return res.status(400).json({ error: "Year required" });
    if (semester == null || semester === "") return res.status(400).json({ error: "Semester required" });
    if (!branch) return res.status(400).json({ error: "Branch required" });

    const exists = await User.findOne({ email: e }).lean();
    if (exists) return res.status(409).json({ error: "Email already exists" });

    const hash = await bcrypt.hash(String(password), 10);
    const u = await User.create({
      name: String(name).trim(),
      email: e,
      role: "student",
      roll: String(regNo).trim(),
      year: String(year),                          // schema stores year as String
      branch: String(branch).trim().toUpperCase(),
      hash,
      active: true,
    });

    return res.status(201).json({ ok: true, id: u._id.toString() });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed to create student" });
  }
});

// POST /api/admin/create-faculty
// body: (JSON or multipart) { email,name,password,department }
router.post("/create-faculty", requireAdmin, upload.none(), async (req, res) => {
  try {
    const { email, name, password, department } = req.body || {};
    const e = String(email || "").toLowerCase().trim();

    if (!e) return res.status(400).json({ error: "Email required" });
    if (!name) return res.status(400).json({ error: "Name required" });
    if (!password) return res.status(400).json({ error: "Password required" });

    const exists = await User.findOne({ email: e }).lean();
    if (exists) return res.status(409).json({ error: "Email already exists" });

    const hash = await bcrypt.hash(String(password), 10);
    const u = await User.create({
      name: String(name).trim(),
      email: e,
      role: "coordinator",                           // enum-safe
      branch: String(department || "").trim().toUpperCase() || undefined,
      hash,
      active: true,
    });

    return res.status(201).json({ ok: true, id: u._id.toString() });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed to create faculty" });
  }
});

export default router;
