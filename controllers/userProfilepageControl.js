import { query } from "../db/db.js";
import axios from "axios";

// Helper: Get user info + followers/following count
const getUserInfo = async (userId) => {
  const userRes = await query(
    `SELECT id, username, profile_img, bio, favorite_genres FROM users WHERE id = $1`,
    [userId]
  );
  const user = userRes.rows[0];

  const followersRes = await query(
    `SELECT COUNT(*) FROM followers WHERE following_id = $1`,
    [userId]
  );
  const followingRes = await query(
    `SELECT COUNT(*) FROM followers WHERE follower_id = $1`,
    [userId]
  );

  return {
    ...user,
    followers: parseInt(followersRes.rows[0].count),
    following: parseInt(followingRes.rows[0].count),
  };
};

// Helper: Get user reviews with book info (paginated)
const getUserReviewsWithBooks = async (userId, page = 1, limit = 9) => {
  const offset = (page - 1) * limit;
  const res = await query(
    `SELECT r.id AS review_id, r.rating, r.review_text, r.created_at, r.book_id,
            rb.title, rb.author, rb.cover_img, rb.genre, rb.description
     FROM reviews r
     JOIN reviewed_books rb ON r.book_id = rb.book_key
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const countRes = await query(
    `SELECT COUNT(*) FROM reviews WHERE user_id = $1`,
    [userId]
  );

  return {
    reviews: res.rows,
    total_reviews: parseInt(countRes.rows[0].count),
    current_page: page,
    total_pages: Math.ceil(countRes.rows[0].count / limit),
  };
};

export const getUserProfilePage = async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;

  try {
    const userInfo = await getUserInfo(userId);
    const reviewData = await getUserReviewsWithBooks(userId, page);

    res.status(200).json({
      user: userInfo,
      stats: {
        total_reviews: reviewData.total_reviews,
        followers: userInfo.followers,
        following: userInfo.following,
      },
      reviews: reviewData.reviews,
      pagination: {
        current_page: reviewData.current_page,
        total_pages: reviewData.total_pages,
      },
    });
  } catch (err) {
    console.error("Error fetching user profile page:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
