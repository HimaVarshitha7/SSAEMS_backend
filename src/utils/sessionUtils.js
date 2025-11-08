// src/utils/sessionUtils.js
import Session from '../models/Session.js';

export async function getCurrentSession() {
  // latest unlocked (adjust logic if you use a flag like isActive)
  const session = await Session.findOne({ locked: false })
    .sort({ createdAt: -1 })
    .lean();
  return session || null; // ✅ don't throw
}
