import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { parse } from 'csv-parse';
import mongoose from 'mongoose';

import Subject from '../models/Subject.js';
import Student from '../models/Student.js';
import Preference from '../models/Preference.js';
import User from '../models/User.js';
import Allotment from '../models/Allotment.js';
import Session from '../models/Session.js';

/* ---------- helpers ---------- */
const UPLOAD_DIR = path.resolve('./uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
export const uploadMw = multer({ storage }).single('file');

function csvToArr(v) {
  return Array.isArray(v)
    ? v
    : String(v || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

async function resolveSessionId(sessionId) {
  if (sessionId && mongoose.isValidObjectId(sessionId)) {
    const s = await Session.findById(sessionId).select("_id").lean();
    if (s) return s._id;
  }
  const fallback = await Session.findOne({ active: true, locked: { $ne: true } })
    .sort({ createdAt: -1 })
    .select("_id")
    .lean();
  if (!fallback) throw Object.assign(new Error("No active session found. Please create a session."), { status: 400 });
  return fallback._id;
}

/* ---------- IMPORT STUDENTS CSV ---------- */
export const importStudentsCSV = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'CSV file is required' });

    const students = [];
    const stream = fs.createReadStream(req.file.path)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }));

    stream.on('data', (row) => {
      const doc = {
        roll: row.roll?.toString().trim(),
        name: row.name?.toString().trim(),
        email: row.email?.toString().trim(),
      };
      if (doc.roll && doc.name && doc.email) students.push(doc);
    });

    stream.on('error', (err) => {
      fs.unlink(req.file.path, () => {});
      res.status(400).json({ message: 'Invalid CSV', error: err.message });
    });

    stream.on('end', async () => {
      try {
        if (!students.length) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ message: 'CSV contained no valid rows' });
        }
        await Student.insertMany(students, { ordered: false }).catch(() => {});
        res.json({ message: 'Students imported successfully', count: students.length });
      } catch (err) {
        res.status(500).json({ message: err.message });
      } finally {
        fs.unlink(req.file.path, () => {});
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- LIST SUBJECTS (for faculty UI) ---------- */
export const listSubjects = async (req, res) => {
  try {
    const { sessionId, year, semester, active } = req.query;
    const sid = await resolveSessionId(sessionId);

    const q = { sessionId: sid };
    if (year) q.year = Number(year);
    if (semester) q.semester = Number(semester);
    if (active !== undefined) q.active = active === "true";

    const subjects = await Subject.find(q)
      .select("code title capacity year semester eligibleBranches requiresPrevElectives")
      .sort({ year: 1, semester: 1, code: 1 })
      .lean();

    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------- CREATE SUBJECT ---------- */
export const createSubject = async (req, res) => {
  try {
    const sid = await resolveSessionId(req.body.sessionId);

    const b = req.body || {};
    const code = (b.code ?? "").toString().trim().toUpperCase();
    const title = (b.title ?? b.name ?? "").toString().trim();
    const capacity = Number(b.capacity);
    const year = Number(b.year);
    const semester = Number(b.semester);

    const eligibleBranches = csvToArr(b.eligibleBranches).map((s) => s.toUpperCase());
    const requiresPrevElectives = csvToArr(b.requiresPrevElectives).map((s) => s.toUpperCase());

    if (!code || !title) return res.status(400).json({ message: "code and title are required" });
    if (!Number.isFinite(capacity) || capacity < 1) return res.status(400).json({ message: "capacity must be a positive number" });
    if (!Number.isInteger(year) || year < 1 || year > 4) return res.status(400).json({ message: "year must be between 1 and 4" });
    if (!Number.isInteger(semester) || semester < 1 || semester > 8) return res.status(400).json({ message: "semester must be between 1 and 8" });

    const subject = new Subject({
      sessionId: sid,
      code,
      title,
      capacity,
      year,
      semester,
      eligibleBranches,
      requiresPrevElectives,   // ✅
      eligibility: { minPercent: Number(b?.eligibility?.minPercent ?? 0) },
      active: true,
    });

    await subject.save();
    return res.status(201).json({ message: "Subject created", subject });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Subject code already exists", duplicateKey: err.keyValue });
    }
    if (err?.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        details: Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message])),
      });
    }
    console.error("[createSubject] unexpected error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ---------- UPDATE SUBJECT ---------- */
export const updateSubject = async (req, res) => {
  try {
    const b = req.body || {};
    const update = {};

    if (b.title ?? b.name) {
      const title = (b.title ?? b.name ?? "").toString().trim();
      if (!title) return res.status(400).json({ message: "title cannot be empty" });
      update.title = title;
    }
    if (b.capacity !== undefined) {
      const capacity = Number(b.capacity);
      if (!Number.isFinite(capacity) || capacity < 1) return res.status(400).json({ message: "capacity must be a positive number" });
      update.capacity = capacity;
    }
    if (b.year !== undefined) {
      const year = Number(b.year);
      if (!Number.isInteger(year) || year < 1 || year > 4) return res.status(400).json({ message: "year must be between 1 and 4" });
      update.year = year;
    }
    if (b.semester !== undefined) {
      const semester = Number(b.semester);
      if (!Number.isInteger(semester) || semester < 1 || semester > 8) return res.status(400).json({ message: "semester must be between 1 and 8" });
      update.semester = semester;
    }
    if (b.eligibleBranches !== undefined) {
      update.eligibleBranches = csvToArr(b.eligibleBranches).map((s) => s.toUpperCase());
    }
    if (b.requiresPrevElectives !== undefined) {
      update.requiresPrevElectives = csvToArr(b.requiresPrevElectives).map((s) => s.toUpperCase());
    }
    if (b.eligibility?.minPercent !== undefined) {
      const mp = Number(b.eligibility.minPercent);
      if (!Number.isFinite(mp) || mp < 0 || mp > 100) return res.status(400).json({ message: "eligibility.minPercent must be 0-100" });
      update["eligibility.minPercent"] = mp;
    }

    const updated = await Subject.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: "Subject not found" });

    return res.json({ message: "Subject updated", subject: updated });
  } catch (err) {
    console.error("[updateSubject] unexpected error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ---------- RUN ALLOCATION (greedy with eligibility) ---------- */
export const runAllocation = async (req, res) => {
  try {
    const sid = await resolveSessionId(req.body?.sessionId);

    // preferences of this session
    const prefs = await Preference.find({ sessionId: sid })
      .populate("student", "branch previousElective cgpa")
      .lean();

    const subjects = await Subject.find({ sessionId: sid, active: true }).lean();

    const seatLeft = new Map(subjects.map((s) => [String(s._id), s.capacity]));
    const subById = new Map(subjects.map((s) => [String(s._id), s]));

    const results = [];

    // rank wise greedy 1..5
    for (let rank = 1; rank <= 5; rank++) {
      for (const p of prefs) {
        if (results.some((r) => String(r.student) === String(p.student))) continue;

        const choice = (p.choices || []).find((c) => c.rank === rank);
        if (!choice) continue;

        const sidStr = String(choice.subject);
        const subj = subById.get(sidStr);
        if (!subj) continue;

        const branch = (p.student.branch || "").toUpperCase();
        const prev = (p.student.previousElective || "").toUpperCase();

        const branchOk = !subj.eligibleBranches?.length || subj.eligibleBranches.includes(branch);
        const prevOk = !subj.requiresPrevElectives?.length || (prev && subj.requiresPrevElectives.includes(prev));
        const seats = seatLeft.get(sidStr) || 0;

        if (branchOk && prevOk && seats > 0) {
          seatLeft.set(sidStr, seats - 1);
          results.push({ student: p.student._id, subject: subj._id, sessionId: sid, rank });
        }
      }
    }

    await Allotment.deleteMany({ sessionId: sid });
    if (results.length) await Allotment.insertMany(results);

    res.json({ message: "Allocation completed", allocated: results.length });
  } catch (err) {
    console.error("runAllocation error", err);
    res.status(500).json({ message: err.message });
  }
};

/* ---------- REASSIGN STUDENT ---------- */
export const reassign = async (req, res) => {
  try {
    const { studentId, subjectId, sessionId } = req.body;
    if (!studentId || !subjectId) return res.status(400).json({ message: 'studentId and subjectId are required' });
    const sid = await resolveSessionId(sessionId);

    const [stu, subj] = await Promise.all([
      User.findById(studentId).select("branch previousElective"),
      Subject.findById(subjectId)
    ]);
    if (!stu) return res.status(404).json({ message: 'Student not found' });
    if (!subj) return res.status(404).json({ message: 'Subject not found' });

    // eligibility check (same as allocation)
    const branch = (stu.branch || "").toUpperCase();
    const prev = (stu.previousElective || "").toUpperCase();
    const branchOk = !subj.eligibleBranches?.length || subj.eligibleBranches.includes(branch);
    const prevOk = !subj.requiresPrevElectives?.length || (prev && subj.requiresPrevElectives.includes(prev));
    if (!branchOk || !prevOk) return res.status(400).json({ message: "Student not eligible for selected subject" });

    await Allotment.findOneAndUpdate(
      { student: studentId, sessionId: sid },
      { $set: { subject: subjectId } },
      { upsert: true }
    );

    res.json({ message: 'Student reassigned successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
