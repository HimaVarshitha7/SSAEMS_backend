import mongoose from 'mongoose';
const prefSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', index: true },
  choices: [{
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    rank: Number
  }],
  submittedAt: Date,
  locked: { type: Boolean, default: false }
}, { timestamps: true });
export default mongoose.model('Preference', prefSchema);
