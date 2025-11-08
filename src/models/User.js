import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  roll: { type: String, index: true },   // ✅ only roll is indexed (ok)
  name: { type: String },                // ❌ no index, no unique
  email: { type: String, unique: true, sparse: true }, 
  role: { type: String, enum: ['student','coordinator','admin'], default: 'student' },
  percent: Number,
  cgpa: Number,
  dob: Date,
  branch: String,
  year: String,
  previousElective: String,
  hash: String,
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
