export function errorHandler(err, req, res, next) {
  // Log once — but DON'T crash
  console.error('[ERR]', err?.message);
  if (err?.stack) console.error(err.stack);

  if (res.headersSent) return next(err);

  // Mongo duplicate safeguard (if it bubbles up here)
  if (err && err.code === 11000) {
    const dupField =
      (err.keyPattern && Object.keys(err.keyPattern)[0]) ||
      (err.keyValue && Object.keys(err.keyValue)[0]) ||
      'field';
    let message = 'Duplicate value';
    if (dupField === 'email') message = 'Email already exists';
    if (dupField === 'name' || dupField === 'username') message = 'Username already exists';
    return res.status(409).json({ error: message, field: dupField, code: 'DUPLICATE' });
  }

  if (err?.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.errors });
  }

  return res.status(err.status || 500).json({ error: err.message || 'Server error' });
}
