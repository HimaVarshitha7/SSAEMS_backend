import mongoose from "mongoose";

/**
 * Canonical Allotment schema
 * - Works for both designs:
 *   • runId-based runs (e.g. "2025-11-sem")
 *   • sessionId-based active session
 * Only one of (runId | sessionId) needs to be present.
 */
const AllotmentSchema = new mongoose.Schema(
  {
    // Either set runId for “allocation runs”, or sessionId for “active session”
    runId:       { type: String, index: true, default: null },                  // e.g., "2025-11-sem"
    sessionId:   { type: mongoose.Schema.Types.ObjectId, ref: "Session", default: null },

    // Student & subject
    roll:        { type: String, required: true, index: true },
    subjectCode: { type: String, required: true, index: true },
    subjectName: { type: String, default: "" },

    // Metadata
    cgpa:           { type: Number, default: null },
    preferenceRank: { type: Number, default: null },
    status:         { type: String, enum: ["ALLOCATED", "UNASSIGNED"], default: "ALLOCATED" },
    source:         { type: String, enum: ["SYSTEM", "MANUAL"], default: "SYSTEM" },
  },
  {
    timestamps: true,
    collection: "allotments",   // 👈 force the collection name you use in Atlas
  }
);

/** Uniqueness:
 *  - If runId is present, (runId, roll) must be unique.
 *  - If sessionId is present, (sessionId, roll) must be unique.
 *  Use partial indexes so both can co-exist safely.
 */
AllotmentSchema.index(
  { runId: 1, roll: 1 },
  { unique: true, partialFilterExpression: { runId: { $type: "string" } } }
);

AllotmentSchema.index(
  { sessionId: 1, roll: 1 },
  { unique: true, partialFilterExpression: { sessionId: { $exists: true, $ne: null } } }
);

// Helpful lookups
AllotmentSchema.index({ subjectCode: 1 });
AllotmentSchema.index({ roll: 1 });

const Allotment = mongoose.model("Allotment", AllotmentSchema);
export default Allotment;
