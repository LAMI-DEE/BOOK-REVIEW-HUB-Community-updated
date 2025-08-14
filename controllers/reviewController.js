//CRUD for reviews
import { query } from '../db/db.js';
import axios from 'axios';
import { sendNotification } from '../utils/sendNotification.js';
import {formatDistanceToNow} from 'date-fns';

// 📦 Utility function to fetch API book details
const fetchApiBookDetails = async (bookId) => {
  try {
    const url = `https://openlibrary.org/works/${bookId}.json`;
    const res = await axios.get(url);
    const data = res.data;

    const genre = data.subjects?.slice(0, 4) || [];
    const title = data.title || "Untitled";

    const authorKey = data.authors?.[0]?.author?.key;
    let author = "Unknown Author";
    if (authorKey) {
      const authorRes = await axios.get(`https://openlibrary.org${authorKey}.json`);
      author = authorRes.data?.name || "Unknown Author";
    }

    const coverId = data.covers?.[0];
    const cover_img = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
      : null;

    const description = typeof data.description === 'string'
      ? data.description
      : data.description?.value || null;

    return { title, author, cover_img, genre, description };
  } catch (err) {
    console.error("Error fetching book details:", err.message);
    return null;
  }
};


export const createReview = async (req, res) => {
  const userId = req.user.id;
  const { rating, review_text } = req.body;
  const { bookId } = req.params;

  if (!rating || !review_text) {
    return res.status(400).json({ message: "Rating and review text are required" });
  }

  try {
    // 1. Check for existing user review
    const existingReview = await query(
      "SELECT * FROM reviews WHERE user_id = $1 AND book_id = $2",
      [userId, bookId]
    );
    if (existingReview.rows.length > 0) {
      return res.status(409).json({ message: "You have already reviewed this book" });
    }

    let book_source = "api";
    let bookDetails = null;

    // 2. Check custom books first
    const customCheck = await query(
      "SELECT * FROM custom_books WHERE book_key = $1", 
      [bookId]
    );

    if (customCheck.rows.length > 0) {
      book_source = "custom";
      bookDetails = {
        title: customCheck.rows[0].title,
        author: customCheck.rows[0].author,
        cover_img: customCheck.rows[0].cover_img,
        genre: customCheck.rows[0].genre,
        description: customCheck.rows[0].description
      };
    } else {
      // 3. Fetch from API if not custom
      bookDetails = await fetchApiBookDetails(bookId);
      if (!bookDetails) {
        return res.status(404).json({ message: "Book not found" });
      }
    }

    // 4. Insert to reviewed_books (with conflict protection)
    await query(
      `INSERT INTO reviewed_books (
        book_key, title, author, cover_img, 
        genre, source, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (book_key) DO NOTHING`,  // ← This prevents duplicate errors
      [
        bookId,
        bookDetails.title,
        bookDetails.author,
        bookDetails.cover_img,
        bookDetails.genre,
        book_source,
        bookDetails.description
      ]
    );

    // 5. Create the review
    const result = await query(
      `INSERT INTO reviews (
        user_id, book_id, book_source, 
        rating, review_text
      ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, bookId, book_source, rating, review_text]
    );

    res.status(201).json({
      message: "Review created successfully",
      review: result.rows[0]
    });

  } catch (err) {
    console.error("Error creating review:", err.message);
    
    // Handle specific errors
    if (err.code === '23505') { // PostgreSQL unique violation
      return res.status(409).json({ 
        message: "Duplicate book entry prevented" 
      });
    }
    
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserBookReview = async (req, res) => {
  try {
    if (!req.params || !req.params.bookId) {
      throw new Error("Book ID parameter is missing");
    }
    if (!req.user || !req.user.id) {
      throw new Error("User authentication missing");
    }

    const { bookId } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT r.id, r.rating, r.review_text, r.created_at, 
              u.username, u.profile_img
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.book_id = $1 AND r.user_id = $2`,
      [bookId, userId]
    );

    if (!res || typeof res.status !== 'function') {
      throw new Error("Invalid response object");
    }

    res.status(200).json({
      review: result.rows[0] || null
    });
  } catch (err) {
    console.error("Error fetching user review:", err);
    if (res && typeof res.status === 'function') {
      res.status(500).json({ message: "Internal server error" });
    } else {
      console.error("Cannot send error response - invalid response object");
    }
  }
};

export const updateReview = async (req, res) => {
    const userId = req.user.id; // Get the user ID from the token
    const reviewId = req.params.id;
    const {rating, review_text} = req.body;

    try{
        const result = await query('SELECT * FROM reviews WHERE id = $1', [reviewId]);
        if (result.rows.length === 0) {
            return res.status(404).json({message: 'Review not found'});
        }
        const review = result.rows[0];

        if(review.user_id !== userId){
            return res.status(403).json({message: 'Not authorized to edit this review'});
        }

        const updated = await query(`UPDATE reviews SET rating = $1, review_text = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,[rating, review_text, reviewId]);
        res.status(200).json({
            message: 'Review updated successfully',
            result: updated.rows[0]
        });
    }catch (err) {
        console.error('Error updating reviews:', err);
        res.status(500).json({message: 'Server error'});
    }
};
export const getReviewsByBook = async (req, res) => {
  const { bookId } = req.params;
  const { source } = req.query;

  try {
    const result = await query(`
      SELECT r.*, u.username, u.profile_img,
             rb.title, rb.author, rb.cover_img, rb.genre
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN reviewed_books rb ON r.book_id = rb.book_key
      WHERE r.book_id = $1 AND r.book_source = $2
    `, [bookId, source]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No reviews found for this book" });
    }

    res.status(200).json({
      message: "Reviews retrieved successfully",
      reviews: result.rows
    });

  } catch (err) {
    console.error("Error fetching reviews:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const deleteReview = async (req, res) => {
    const userId = req.user.id;
    const reviewId = req.params.id;

    try {
        // 1. Verify review exists and belongs to user
        const existing = await query('SELECT * FROM reviews WHERE id = $1', [reviewId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ message: 'Review not found' });
        }
        
        const review = existing.rows[0];
        if (review.user_id !== userId) {
            return res.status(403).json({ message: 'Not authorized to delete this review'});
        }

        // 2. Store book_id before deletion
        const bookId = review.book_id;
        const bookSource = review.book_source;

        // 3. Delete the review
        await query('DELETE FROM reviews WHERE id = $1', [reviewId]);

        // 4. Check if any reviews remain for this book
        const remainingReviews = await query(
            'SELECT 1 FROM reviews WHERE book_id = $1 LIMIT 1',
            [bookId]
        );

        // 5. If no reviews left, delete from reviewed_books
        if (remainingReviews.rowCount === 0) {
            await query(
                'DELETE FROM reviewed_books WHERE book_key = $1 AND source = $2',
                [bookId, bookSource]
            );
        }

        res.status(200).json({ message: 'Review deleted successfully' });

    } catch (err) {
        console.error('Error deleting review:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
// ========================
// Like a Review
// ========================
export const likeReview = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;

  try {
    // First check if already liked
    const liked = await query(
      "SELECT * FROM review_likes WHERE user_id = $1 AND review_id = $2",
      [userId, reviewId]
    );

    if (liked.rowCount > 0) {
      return res.status(400).json({ message: "Already liked this review" });
    }

    // Insert like
    await query(
      "INSERT INTO review_likes (user_id, review_id) VALUES ($1, $2)",
      [userId, reviewId]
    );

    // Remove any existing unlike
    await query(
      "DELETE FROM review_unlikes WHERE user_id = $1 AND review_id = $2",
      [userId, reviewId]
    );

    const sender = await query("SELECT username FROM users WHERE id = $1",[userId]);
    //send notifications to review author
    const result = await query("SELECT user_id FROM reviews WHERE id = $1",[reviewId]);
    const reviewAuthorId = result.rows[0].user_id;
    await sendNotification({
      senderId: userId,
      receiverId: reviewAuthorId,
      type: "like_review",
      message: `${sender.rows[0]?.username || "Someone "} liked your review`,
      targetType: "review",
      targetId: reviewId
    });

    res.status(201).json({ message: "Review liked" });
  } catch (err) {
    console.error("Error liking review:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ========================
// Unlike a Review
// ========================
export const unlikeReview = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;

  try {
    const unliked = await query(
      "SELECT * FROM review_unlikes WHERE user_id = $1 AND review_id = $2",
      [userId, reviewId]
    );

    if (unliked.rowCount > 0) {
      return res.status(400).json({ message: "Already unliked this review" });
    }

    // Insert unlike
    await query(
      "INSERT INTO review_unlikes (user_id, review_id) VALUES ($1, $2)",
      [userId, reviewId]
    );

    // Remove any existing like
    await query(
      "DELETE FROM review_likes WHERE user_id = $1 AND review_id = $2",
      [userId, reviewId]
    );

     const sender = await query("SELECT username FROM users WHERE id = $1",[userId]);
    //send notifications to review author
    const result = await query("SELECT user_id FROM reviews WHERE id = $1",[reviewId]);
    const reviewAuthorId = result.rows[0].user_id;
    await sendNotification({
      senderId: userId,
      receiverId: reviewAuthorId,
      type: "like_review",
      message: `${sender.rows[0]?.username || "Someone "} dis-liked your review`,
      targetType: "review",
      targetId: reviewId
    });
    res.status(201).json({ message: "Review unliked" });
  } catch (err) {
    console.error("Error unliking review:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
// Remove like
export const removeLike = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;

  try {
    await query("DELETE FROM review_likes WHERE user_id = $1 AND review_id = $2", [userId, reviewId]);
    res.status(200).json({ message: "Like removed" });
  } catch (err) {
    console.error("Error removing like:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Remove unlike
export const removeUnlike = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;

  try {
    await query("DELETE FROM review_unlikes WHERE user_id = $1 AND review_id = $2", [userId, reviewId]);
    res.status(200).json({ message: "Unlike removed" });
  } catch (err) {
    console.error("Error removing unlike:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getReviewWithBookDetails = async (req, res) => {
  const { reviewId } = req.params;
  
  try {
    const reviewQuery = `
      SELECT r.*, u.username, u.profile_img,
             rb.title, rb.author, rb.cover_img, rb.genre
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      JOIN reviewed_books rb ON r.book_id = rb.book_key
      WHERE r.id = $1
    `;
    
    const reviewResult = await query(reviewQuery, [reviewId]);
    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    const review = reviewResult.rows[0];
    
    // Get likes and unlikes count
    const likesCount = await query(
      'SELECT COUNT(*) FROM review_likes WHERE review_id = $1',
      [reviewId]
    );
    const unlikesCount = await query(
      'SELECT COUNT(*) FROM review_unlikes WHERE review_id = $1',
      [reviewId]
    );
    
    res.status(200).json({
      ...review,
      rating: parseFloat(review.rating),
      likes: parseInt(likesCount.rows[0].count),
      unlikes: parseInt(unlikesCount.rows[0].count),
      genres: review.genre || []
    });
  } catch (err) {
    console.error('Error fetching review:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get comments for review with pagination
export const getReviewComments = async (req, res) => {
  const { reviewId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    const commentsQuery = `
      SELECT c.*, u.username, u.profile_img,
             (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) AS likes_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.review_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const commentsResult = await query(commentsQuery, [reviewId, limit, offset]);
    
    // Format comments with relative time
    const comments = commentsResult.rows.map(comment => ({
      ...comment,
      relative_time: formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })
    }));
    
    res.status(200).json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const checkReviewLikeStatus = async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user.id; // From verifyToken middleware

  try {
    // Check if user liked the review
    const likeResult = await query(
      'SELECT 1 FROM review_likes WHERE user_id = $1 AND review_id = $2',
      [userId, reviewId]
    );
    
    // Check if user unliked the review
    const unlikeResult = await query(
      'SELECT 1 FROM review_unlikes WHERE user_id = $1 AND review_id = $2', 
      [userId, reviewId]
    );

    res.status(200).json({
      liked: likeResult.rowCount > 0,
      unliked: unlikeResult.rowCount > 0
    });

  } catch (err) {
    console.error('Error checking like status:', err);
    res.status(500).json({ message: 'Server error' });
  }
};




