import { query } from '../db/db.js';

export const getCommunityFeed = async (req, res) => {
  const userId = req.user.id;

  try {
    const userResult = await query(
      'SELECT favorite_genres FROM users WHERE id = $1',
      [userId]
    );
    const genres = userResult.rows[0]?.favorite_genres || [];

    const result = await query(`
      SELECT r.*, u.username, u.profile_img,
        COALESCE(rb.title, cb.title) AS title,
        COALESCE(rb.author, cb.author) AS author,
        COALESCE(rb.cover_img, cb.cover_img) AS cover_img,
        COALESCE(rb.genre, cb.genre) AS genre
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN reviewed_books rb ON r.book_source = 'api' AND r.book_id = rb.book_key
      LEFT JOIN custom_books cb ON r.book_source = 'custom' AND r.book_id = cb.book_key
      ORDER BY r.created_at DESC
      LIMIT 30
    `);

    const filtered = result.rows.filter((review) => {
      return review.genre?.some((g) => genres.includes(g));
    });

    let feed = [...filtered];

    if (feed.length < 7) {
      const extras = result.rows
        .filter((r) => !feed.some((f) => f.id === r.id))
        .sort(() => 0.5 - Math.random())
        .slice(0, 7 - feed.length);

      feed = [...feed, ...extras];
    }

    res.status(200).json({
      message: 'Feed generated successfully',
      total: feed.length,
      feed,
    });
  } catch (err) {
    console.error('Error generating community feed:', err);
    res.status(500).json({ message: 'Server error' });
  }
};