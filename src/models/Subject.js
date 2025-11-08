import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    // 🔹 link to session
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Session", index: true }, // ✅ add this

    code: {
      type: String,
      required: [true, "Subject code is required"],
      trim: true,
      uppercase: true,
      unique: true,
    },
    title: { type: String, required: [true, "Subject title is required"], trim: true },
    capacity: { type: Number, required: [true, "Capacity is required"], min: [1, "Capacity must be at least 1"] },
    year: { type: Number, required: [true, "Year is required"], min: [1, "Year must be >= 1"], max: [4, "Year must be <= 4"] },
    semester: { type: Number, required: [true, "Semester is required"], min: [1, "Semester must be >= 1"], max: [8, "Semester must be <= 8"] },
    eligibleBranches: {
      type: [String],
      default: [],
      set: (arr) => (arr || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean),
    },
    eligibility: { minPercent: { type: Number, default: 0 } },
    active: { type: Boolean, default: true }, // optional but helpful
  },
  { timestamps: true }
);

subjectSchema.index({ code: 1 }, { unique: true });

export default mongoose.models.Subject || mongoose.model("Subject", subjectSchema);
