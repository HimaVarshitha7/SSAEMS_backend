import dotenv from 'dotenv';
dotenv.config();
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import { hashPassword } from '../src/utils/password.js';

const email = process.argv[2] || 'admin@example.com';
const password = process.argv[3] || 'Admin@123';
const name = process.argv[4] || 'Admin';

(async () => {
  await connectDB();
  const hash = await hashPassword(password);
  const user = await User.create({ name, email, role:'admin', hash });
  console.log('Admin created:', { email, password, id: user._id });
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
