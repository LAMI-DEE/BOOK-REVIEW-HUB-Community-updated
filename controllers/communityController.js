
import { query } from '../db/db.js';

const getCommunityFeed = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        r.id AS review_id,
        r.rating,
        r.review_text,
        u.id AS user_id,
        u.username,
        u.profile_img,
        COALESCE(rb.title, cb.title) AS book_title,
        COALESCE(rb.cover_img, cb.cover_img) AS book_cover,
        COALESCE(rb.genre, cb.genre) AS genres
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN reviewed_books rb ON r.book_source = 'api' AND r.book_id = rb.book_key
      LEFT JOIN custom_books cb ON r.book_source = 'custom' AND r.book_id = cb.book_key
      ORDER BY r.created_at DESC
      LIMIT 12
    `);

    const formattedReviews = result.rows.map(review => ({
      ...review,
      genres: review.genres ? review.genres.slice(0, 3).join(', ') : '',
      rating: Number(review.rating) || 0
    }));

    res.status(200).json(formattedReviews);
  } catch (error) {
    console.error('Error fetching community feed:', error);
    res.status(500).json({ error: 'Failed to fetch community feed' });
  }
};

export { getCommunityFeed };