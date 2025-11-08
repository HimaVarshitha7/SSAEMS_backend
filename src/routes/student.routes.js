// src/routes/student.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  me,
  updateMe,
  getMyPreferences,
  upsertPreferences,
  listAvailableSubjects,
  myAllotment,
} from "../controllers/student.controller.js";

const r = Router();

// Profile
r.get("/me", auth, me);
r.put("/me", auth, updateMe);

// Preferences
r.get("/me/preferences", auth, getMyPreferences);   // ✅ fixes 404
r.post("/preferences", auth, upsertPreferences);

// Subjects (filtered for student)
r.get("/subjects/available", auth, listAvailableSubjects);

// Allocation result
r.get("/allotment", auth, myAllotment);

export default r;
