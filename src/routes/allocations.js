import express from "express";
import Allocation from "../models/Allocation.js";
import AllocationRun from "../models/AllocationRun.js";

const router = express.Router();

// latest FINALIZED runId helper
async function getLatestRunId() {
  const run = await AllocationRun.findOne({ status: "FINALIZED" }).sort({ finalizedAt: -1 }).lean();
  return run?.runId || null;
}

/**
 * POST /api/allocations/runs/:runId/finalize
 * Body: { name, results: [{ roll, subjectCode, subjectName, cgpa, preferenceRank }] }
 */
router.post("/runs/:runId/finalize", async (req, res, next) => {
  try {
    const { runId } = req.params;
    const { name, results } = req.body || {};

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: "No results to persist" });
    }

    await AllocationRun.updateOne(
      { runId },
      {
        $setOnInsert: { runId, createdAt: new Date() },
        $set: { name: name || runId, status: "FINALIZED", finalizedAt: new Date() },
      },
      { upsert: true }
    );

    const ops = results.map((r) => ({
      updateOne: {
        filter: { runId, roll: r.roll },
        update: {
          $set: {
            runId,
            roll: r.roll,
            subjectCode: r.subjectCode,
            subjectName: r.subjectName || "",
            cgpa: r.cgpa ?? null,
            preferenceRank: r.preferenceRank ?? null,
            source: r.source || "SYSTEM",
          },
        },
        upsert: true,
      },
    }));

    await Allocation.bulkWrite(ops, { ordered: false });

    res.json({ ok: true, runId, count: results.length });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/allocations/students/:roll/allocation?runId=optional
 * Returns latest FINALIZED run by default.
 */
router.get("/debug/check", async (req, res, next) => {
  try {
    const count = await Allocation.countDocuments({});
    const one = await Allocation.findOne({}).lean();
    res.json({ collection: "allocations", count, sample: one });
  } catch (e) { next(e); }
});

/**
 * GET /api/allocations/runs/:runId/subjects/:code/roster
 */
router.get("/runs/:runId/subjects/:code/roster", async (req, res, next) => {
  try {
    const { runId, code } = req.params;
    const list = await Allocation.find({ runId, subjectCode: code }, { _id: 0 }).lean();
    res.json({ runId, subjectCode: code, count: list.length, students: list });
  } catch (err) {
    next(err);
  }
});

export default router;
