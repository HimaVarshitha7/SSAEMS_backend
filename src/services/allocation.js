import Preference from '../models/Preference.js';
import Subject from '../models/Subject.js';
import Session from '../models/Session.js';
import Allotment from '../models/Allotment.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';

function cmpByRules(a,b, rules){
  for(const key of rules){
    if(key==='percent'){
      const d = (b.percent||0) - (a.percent||0);
      if(d!==0) return d;
    }else if(key==='cgpa'){
      const d = (b.cgpa||0) - (a.cgpa||0);
      if(d!==0) return d;
    }else if(key==='dob'){
      const d = new Date(a.dob||0) - new Date(b.dob||0); // earlier dob wins
      if(d!==0) return d;
    }else if(key==='roll'){
      const d = String(a.roll||'').localeCompare(String(b.roll||''));
      if(d!==0) return d;
    }
  }
  return 0;
}

function meetsEligibility(student, subject){
  const minP = subject.eligibility?.minPercent ?? 0;
  if((student.percent||0) < minP) return false;
  return true;
}

export async function allocate(sessionId, actorId){
  const session = await Session.findById(sessionId).lean();
  if(!session) throw new Error('Session not found');
  if(session.locked) throw new Error('Session is locked');

  const subjects = await Subject.find({ sessionId, active:true }).lean();
  const caps = new Map(subjects.map(s => [String(s._id), s.capacity]));
  const subjById = new Map(subjects.map(s => [String(s._id), s]));

  const prefs = await Preference.find({ sessionId }).populate('student').lean();
  const students = prefs.map(p => ({ prefId: p._id, student: p.student, choices: p.choices }));

  // sort students
  const ordered = students.sort((x,y)=> cmpByRules(x.student, y.student, session.rules?.tiebreak || ['percent','cgpa','dob','roll']));

  const results = [];
  const waitlist = [];

  for(const s of ordered){
    let assigned = false;
    const sortedChoices = [...s.choices].sort((a,b)=> (a.rank||0)-(b.rank||0));
    for(const c of sortedChoices){
      const subj = subjById.get(String(c.subject));
      if(!subj) continue;
      if(!meetsEligibility(s.student, subj)) continue;
      const left = caps.get(String(c.subject)) ?? 0;
      if(left>0){
        caps.set(String(c.subject), left-1);
        results.push({ student: s.student._id, subject: c.subject, rank: c.rank, method:'auto' });
        assigned = true;
        break;
      }
    }
    if(!assigned){
      waitlist.push({ student: s.student._id, reason:'capacity_or_eligibility' });
    }
  }

  await Allotment.deleteMany({ sessionId });
  const toInsert = results.map(r => ({ ...r, sessionId }));
  await Allotment.insertMany(toInsert);

  await AuditLog.create({ sessionId, actor: actorId, action:'allocation_run', payload:{ results: toInsert.length, waitlist: waitlist.length, caps: Object.fromEntries(caps) } });

  return { assigned: toInsert.length, waitlisted: waitlist.length, remaining: Object.fromEntries(caps) };
}
