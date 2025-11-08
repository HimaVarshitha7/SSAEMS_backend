import mongoose from 'mongoose';
const auditSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: String,
  payload: mongoose.Schema.Types.Mixed
}, { timestamps: true });
export default mongoose.model('AuditLog', auditSchema);
