import { query } from "../db/db.js";

export const getCustomBooks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await query('SELECT COUNT(*) FROM custom_books');
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    // Get paginated books
    const result = await query(
      `SELECT * FROM custom_books ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.status(200).json({
      books: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Error fetching custom books:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCustomBookById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM custom_books WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    res.status(200).json({ book: result.rows[0] });
  } catch (err) {
    console.error('Error fetching custom book:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};