import mongoose from "mongoose";
const SessionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true, sparse: true },
  active: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  startsAt: Date,
  endsAt: Date,
}, { timestamps: true });

export default mongoose.model("Session", SessionSchema);
