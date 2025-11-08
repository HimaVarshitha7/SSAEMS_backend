import mongoose from "mongoose";

const AllocationRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true, index: true }, // e.g., "2025-06-sem4"
  name: { type: String, default: "" },
  status: { type: String, enum: ["DRAFT", "FINALIZED"], default: "DRAFT" },
  createdBy: { type: String, default: "" }, // user id/email (optional)
  createdAt: { type: Date, default: Date.now },
  finalizedAt: { type: Date }
});

export default mongoose.model("AllocationRun", AllocationRunSchema);
