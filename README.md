# SSAEMS Backend (MERN) 🚀

This is a production-ready Express/Mongo backend for **Smart Subject Allocation & Elective Management System**.
It pairs with your React frontend and implements JWT auth, CSV imports, subject management, and a deterministic allocation engine.

## Quick Start

```bash
npm i
cp .env.example .env
# edit .env as needed
npm run seed:admin  # creates an admin user (email/password printed)
npm run dev
```

API runs on `PORT` (default 4000).

## Key Endpoints

### Auth
- `POST /api/auth/login` → `{ token, refresh, role }`
- `POST /api/auth/register` *(bootstrap coordinators/admins)*

### Student
- `GET /api/me`
- `POST /api/preferences` `{ sessionId, choices:[{subject, rank}] }`
- `GET /api/allotment?session=:id`

### Coordinator
- `POST /api/students/import` *(multipart form-data: file=CSV)* with headers: `roll,name,email,percent,cgpa,dob`
- `GET /api/subjects?sessionId=:id`
- `POST /api/subjects`
- `PUT /api/subjects/:id`
- `POST /api/allocate?session=:id`
- `POST /api/reassign` `{ studentId, subjectId, sessionId }`

### Admin
- `POST /api/sessions` `{ name, start, end, rules }`
- `PUT /api/sessions/:id/lock` `{ locked:true }`
- `GET /api/analytics?session=:id`

## Folder Structure
```
src/
  config/db.js
  middleware/auth.js
  models/...
  routes/*.routes.js
  controllers/*.controller.js
  services/allocation.js
scripts/seedAdmin.js
server.js
```

## Notes
- **RBAC** enforced via `permit()` middleware.
- Allocation is **merit-first** using tiebreakers: `percent > cgpa > dob > roll`.
- CSV import is **idempotent** by `roll`.
- Add HTTPS, refresh-token rotation, and rate-limiting in production.
