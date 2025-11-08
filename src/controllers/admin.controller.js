import Session from '../models/Session.js';
import Allotment from '../models/Allotment.js';
import Subject from '../models/Subject.js';

export const createSession = async (req,res)=>{
  const { name, start, end, rules } = req.body;
  const doc = await Session.create({ name, start, end, rules });
  res.json(doc);
};
export const lockSession = async (req,res)=>{
  const { id } = req.params;
  const { locked } = req.body;
  const doc = await Session.findByIdAndUpdate(id, { locked }, { new:true });
  res.json(doc);
};
export const analytics = async (req,res)=>{
  const { sessionId } = req.query;
  const counts = await Allotment.aggregate([
    { $match: { sessionId: new (await import('mongoose')).default.Types.ObjectId(sessionId) } },
    { $group: { _id: '$subject', count: { $sum: 1 } } }
  ]);
  const subjects = await Subject.find({ sessionId }).lean();
  res.json({ distribution: counts, subjects });
};
