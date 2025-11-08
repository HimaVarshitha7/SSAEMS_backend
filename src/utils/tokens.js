import jwt from 'jsonwebtoken';
export const makeAccess = (user)=> jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
export const makeRefresh = (user)=> jwt.sign({ sub: String(user._id) }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
