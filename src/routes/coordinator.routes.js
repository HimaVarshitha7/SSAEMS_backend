// src/routes/coordinator.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  listSubjects,
  createSubject,
  updateSubject,
  importStudentsCSV,
  runAllocation,
  reassign,
  uploadMw,
} from "../controllers/coordinator.controller.js";

const r = Router();

// subjects (faculty)
r.get("/subjects", auth, listSubjects);
r.post("/subjects", auth, createSubject);
r.put("/subjects/:id", auth, updateSubject);

// upload students csv (for a specific session/workflow)
r.post("/students/import", auth, uploadMw, importStudentsCSV);

// allocation admin/faculty
r.post("/allocation/run", auth, runAllocation);
r.post("/allocation/reassign", auth, reassign);

export default r;
