import { query } from "../db/db.js";


export const isAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(403).json({ message: 'User ID missing from token' });
    }

    const result = await query('SELECT is_admin FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!result.rows[0].is_admin) {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    next();
  } catch (err) {
    console.error('Admin check failed:', err);
    res.status(500).json({ message: 'Server error' });
  }
};