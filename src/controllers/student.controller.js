// src/controllers/student.controller.js
import mongoose from "mongoose";
import Preference from "../models/Preference.js";
import Allotment from "../models/Allotment.js";
import Session from "../models/Session.js";
import User from "../models/User.js";
import Subject from "../models/Subject.js";

const getUid = (req) => req.user?.sub || req.user?.id;

/* resolve active session or given one */
async function resolveSessionId(sessionId) {
  if (sessionId && mongoose.isValidObjectId(sessionId)) {
    const s = await Session.findById(sessionId).select("_id").lean();
    if (s) return s._id;
  }
  const fallback = await Session.findOne({ active: true, locked: { $ne: true } })
    .sort({ createdAt: -1 })
    .select("_id")
    .lean();
  if (!fallback) {
    const err = new Error("No active session found. Please create a session.");
    err.status = 400;
    throw err;
  }
  return fallback._id;
}

// ---------- GET /api/me ----------
export const me = async (req, res, next) => {
  try {
    const user = await User.findById(getUid(req))
      .select("name email roll year branch cgpa role previousElective semester")
      .lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      id: user._id,
      role: user.role,
      name: user.name,
      roll: user.roll,
      year: user.year,
      branch: user.branch,
      cgpa: user.cgpa,
      previousElective: user.previousElective,
      semester: user.semester,
      email: user.email,
    });
  } catch (err) { next(err); }
};

// ---------- PUT /api/me ----------
export const updateMe = async (req, res, next) => {
  try {
    const { name, regNo, year, branch, cgpa, previousElective, semester } = req.body;
    const update = { name, roll: regNo, year, branch, cgpa, previousElective, semester };
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const doc = await User.findByIdAndUpdate(getUid(req), { $set: update }, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: "User not found" });

    res.json({
      ok: true,
      user: {
        id: doc._id,
        name: doc.name,
        roll: doc.roll,
        branch: doc.branch,
        year: doc.year,
        cgpa: doc.cgpa,
        previousElective: doc.previousElective,
        semester: doc.semester,
      },
    });
  } catch (err) { next(err); }
};

// ---------- GET /api/me/preferences ----------
export const getMyPreferences = async (req, res, next) => {
  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const sid = await resolveSessionId(req.query.sessionId);
    const doc = await Preference.findOne({ student: uid, sessionId: sid })
      .populate({ path: "choices.subject", select: "code title" })
      .lean();

    if (!doc) return res.json({ sessionId: sid.toString(), choices: [], locked: false });

    const choices = (doc.choices || []).map((c) => ({
      subject: c.subject?._id?.toString?.() || c.subject,
      rank: c.rank,
      label: c.subject ? `${c.subject.code || ""}${c.subject.code ? " — " : ""}${c.subject.title || ""}` : "",
    }));

    res.json({ sessionId: doc.sessionId.toString(), choices, locked: !!doc.locked, updatedAt: doc.updatedAt });
  } catch (err) { next(err); }
};

// ---------- POST /api/preferences ----------
// Accepts subject as Mongo ObjectId OR as subject CODE (e.g., "DBMS")
export const upsertPreferences = async (req, res, next) => {
  try {
    const uid = getUid(req);
    const { sessionId, choices } = req.body;
    const sid = await resolveSessionId(sessionId);

    const out = [];
    const ranks = new Set();

    for (const c of (choices || [])) {
      let subj = c.subject;
      const rank = Number(c.rank);

      if (!Number.isInteger(rank) || rank < 1) {
        return res.status(400).json({ error: "Invalid rank" });
      }
      if (ranks.has(rank)) return res.status(400).json({ error: "Duplicate rank" });
      ranks.add(rank);

      let subjectId = null;
      if (mongoose.isValidObjectId(subj)) {
        subjectId = subj;
      } else {
        const code = String(subj || "").trim().toUpperCase();
        if (!code) return res.status(400).json({ error: "Invalid subject" });
        const found = await Subject.findOne({ sessionId: sid, code }).select("_id").lean();
        if (!found) return res.status(400).json({ error: `Subject not found for code: ${code}` });
        subjectId = found._id;
      }
      out.push({ subject: subjectId, rank });
    }

    const doc = await Preference.findOneAndUpdate(
      { student: uid, sessionId: sid },
      { $set: { choices: out, submittedAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ ok: true, id: doc._id });
  } catch (err) { next(err); }
};





// ---------- GET /api/allotment ----------
export const myAllotment = async (req, res, next) => {
  try {
    const { sessionId } = req.query;
    const sid = await resolveSessionId(sessionId);

    const doc = await Allotment.findOne({ student: getUid(req), sessionId: sid })
      .populate("subject", "code title")
      .lean();

    if (!doc) return res.json({ assigned: false });

    res.json({
      assigned: true,
      subject: { id: doc.subject._id, code: doc.subject.code, title: doc.subject.title },
      rank: doc.rank ?? null,
      savedAt: doc.updatedAt || doc.createdAt,
    });
  } catch (err) { next(err); }
};

// ---------- GET /api/subjects/available ----------
export const listAvailableSubjects = async (req, res, next) => {
  try {
    const { sessionId, semester, year: qYear } = req.query;

    // resolve active session (sid)
    let sid = null;
    try {
      sid = await resolveSessionId(sessionId);
    } catch {
      // if there is no active session, continue with a null sid
      sid = null;
    }

    // find student and infer year/branch
    const student = await User.findById(getUid(req))
      .select("year branch previousElective")
      .lean();

    const year = qYear != null ? Number(qYear) : (student?.year ?? null);
    if (!year) return res.status(400).json({ error: "Student year not set" });

    const branch = (student?.branch || "").toUpperCase();
    const prev = (student?.previousElective || "").toUpperCase();

    // base query builder
    const buildQuery = (useSession) => ({
      ...(useSession && sid ? { sessionId: sid } : {}),
      year,
      active: true,
      ...(semester ? { semester: Number(semester) } : {}),
      $or: [
        { eligibleBranches: { $size: 0 } },
        { eligibleBranches: { $in: [branch] } },
      ],
    });

    // try WITH sessionId first
    let q = buildQuery(true);
    let subjects = await Subject.find(q)
      .select("_id code title capacity year semester eligibleBranches requiresPrevElectives active")
      .sort("code")
      .lean();

    // if none found (likely because your existing docs don't have sessionId), try WITHOUT sessionId
    if (!subjects.length) {
      q = buildQuery(false);
      subjects = await Subject.find(q)
        .select("_id code title capacity year semester eligibleBranches requiresPrevElectives active")
        .sort("code")
        .lean();
    }

    // previous elective requirement
    subjects = subjects.filter((s) => {
      const reqs = s.requiresPrevElectives || [];
      if (!reqs.length) return true;
      if (!prev) return false;
      return reqs.includes(prev);
    });

    res.json(subjects);
  } catch (err) { next(err); }
};

