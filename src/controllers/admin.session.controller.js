import Session from "../models/Session.js";

export const createSession = async (req, res, next) => {
  try {
    const { name, code, active = false, locked = false, startsAt, endsAt } = req.body;
    const doc = await Session.create({ name, code, active, locked, startsAt, endsAt });
    res.status(201).json({ ok: true, session: doc });
  } catch (e) { next(e); }
};

export const listSessions = async (req, res, next) => {
  try {
    const list = await Session.find().sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (e) { next(e); }
};

export const setSessionFlags = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { active, locked } = req.body;
    const update = {};
    if (active !== undefined) update.active = !!active;
    if (locked !== undefined) update.locked = !!locked;
    const doc = await Session.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!doc) return res.status(404).json({ error: "Session not found" });
    res.json({ ok: true, session: doc });
  } catch (e) { next(e); }
};
