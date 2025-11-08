// backend/routes/subjects.js
import express from "express";
import Subject from "../models/Subject.js";

const router = express.Router();

/** GET /api/subjects?year=2&semester=5 */
router.get("/", async (req, res) => {
  try {
    const q = {};
    if (req.query.year)     q.year     = Number(req.query.year);
    if (req.query.semester) q.semester = Number(req.query.semester);

    // if you use sessionId, infer it here (e.g., from req.user/session)
    // if (req.sessionId) q.sessionId = req.sessionId;

    const list = await Subject.find(q).sort({ code: 1 }).lean();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to fetch subjects" });
  }
});

/** POST /api/subjects */
router.post("/", async (req, res) => {
  try {
    const {
      code, title, capacity, year, semester,
      eligibleBranches = [], eligibility = { minPercent: 0 }, sessionId
    } = req.body || {};

    if (!code || !title) return res.status(400).json({ error: "code and title are required" });

    const doc = await Subject.create({
      code: String(code).toUpperCase().trim(),
      title: String(title).trim(),
      capacity: Number(capacity) || 0,
      year: Number(year) || 1,
      semester: Number(semester) || 1,
      eligibleBranches,
      eligibility,
      sessionId,
    });

    res.status(201).json(doc);
  } catch (e) {
    // handle duplicate code nicely
    if (e.code === 11000) return res.status(409).json({ error: "Subject code already exists" });
    res.status(500).json({ error: e.message || "Failed to create subject" });
  }
});

/** PUT /api/subjects/:id */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const update = {};

    if (req.body.title != null)        update.title = String(req.body.title).trim();
    if (req.body.capacity != null)     update.capacity = Number(req.body.capacity) || 0;
    if (req.body.year != null)         update.year = Number(req.body.year);
    if (req.body.semester != null)     update.semester = Number(req.body.semester);
    if (req.body.eligibleBranches)     update.eligibleBranches = req.body.eligibleBranches;
    if (req.body.eligibility)          update.eligibility = req.body.eligibility;

    const doc = await Subject.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
    if (!doc) return res.status(404).json({ error: "Subject not found" });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to update subject" });
  }
});

export default router;
