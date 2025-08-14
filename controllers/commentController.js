//comments  on reviews
import { query } from "../db/db.js";
import { sendNotification } from "../utils/sendNotification.js";

// Step 17: Comment on a review
export const postComment = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;
  const { text } = req.body;

  if (!text) return res.status(400).json({ message: "Comment text is required" });

  try {
    const result = await query(
      `INSERT INTO comments (review_id, user_id, text) 
       VALUES ($1, $2, $3) RETURNING *`,
      [reviewId, userId, text]
    );
    res.status(201).json({ message: "Comment posted", comment: result.rows[0] });
  } catch (err) {
    console.error("Error posting comment:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Step 18: Get comments for a review
export const getCommentsByReview = async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user ? req.user.id : null;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    // Get paginated comments
    const commentsQuery = await query(
      `SELECT c.id AS comment_id, c.text, c.user_id, c.created_at,
              u.username, u.profile_img,
              (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) AS likes_count,
              EXISTS (
                SELECT 1 FROM comment_likes 
                WHERE comment_id = c.id AND user_id = $2
              ) AND $2 IS NOT NULL AS liked_by_user
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.review_id = $1
       ORDER BY c.created_at DESC
       LIMIT $3 OFFSET $4`,
      [reviewId, userId, limit, offset]
    );

    // Get total count
    const countQuery = await query(
      `SELECT COUNT(*) FROM comments WHERE review_id = $1`,
      [reviewId]
    );

    res.status(200).json({
      comments: commentsQuery.rows,
      totalCount: parseInt(countQuery.rows[0].count)
    });
  } catch (err) {
    console.error("Error getting comments:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Like a comment
export const likeComment = async (req, res) => {
  const userId = req.user.id;
  const { commentId } = req.params;

  try {
    // 1. Get comment details (author + reviewId)
    const commentQuery = await query(
      `SELECT user_id, review_id FROM comments WHERE id = $1`,
      [commentId]
    );

    if (!commentQuery.rows[0]) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const { user_id: commentAuthorId, review_id: reviewId } = commentQuery.rows[0];

    // 2. Insert like (skip if already exists)
    await query(
      `INSERT INTO comment_likes (user_id, comment_id)
       VALUES ($1, $2) ON CONFLICT (user_id, comment_id) DO NOTHING`,
      [userId, commentId]
    );

    // 3. Get updated like count
    const likesCount = await query(
      `SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1`,
      [commentId]
    );

    // 4. Send notification (if not liking your own comment)
    if (userId !== commentAuthorId) {
      const sender = await query(
        `SELECT username FROM users WHERE id = $1`,
        [userId]
      );

      await sendNotification({
        senderId: userId,
        receiverId: commentAuthorId,
        type: "like_comment",
        message: `${sender.rows[0]?.username || "Someone"} liked your comment`,
        targetType: "comment",
        targetId: commentId,
        reviewId: reviewId
      });
    }

    res.status(200).json({ 
      success: true,
      likesCount: parseInt(likesCount.rows[0].count)
    });

  } catch (err) {
    console.error("Error liking comment:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Unlike a comment
export const unlikeComment = async (req, res) => {
  const userId = req.user.id;
  const { commentId } = req.params;

  try {
    // 1. Delete the like
    await query(
      `DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2`,
      [userId, commentId]
    );

    // 2. Get updated like count
    const likesCount = await query(
      `SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1`,
      [commentId]
    );

    res.status(200).json({ 
      success: true,
      likesCount: parseInt(likesCount.rows[0].count)
    });

  } catch (err) {
    console.error("Error unliking comment:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
//toggle comment like
export const toggleCommentLike = async (req, res) => {
  const userId = req.user.id;
  const { commentId } = req.params;
  if (!commentId || isNaN(commentId)){
    return res.status(400).json({ message: "Invalid comment ID" });
  }

  try {
    // 1. Get comment details (author + reviewId)
    const commentQuery = await query(
      `SELECT user_id, review_id FROM comments WHERE id = $1`,
      [commentId]
    );

    if (!commentQuery.rows[0]) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const { user_id: commentAuthorId, review_id: reviewId } = commentQuery.rows[0];

    // 2. Check if like exists
    const likeExistsQuery = await query(
      `SELECT 1 FROM comment_likes WHERE user_id = $1 AND comment_id = $2`,
      [userId, commentId]
    );

    const likeExists = likeExistsQuery.rows.length > 0;
    let action = '';

    // 3. Toggle like status
    if (likeExists) {
      await query(
        `DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2`,
        [userId, commentId]
      );
      action = 'unliked';
    } else {
      await query(
        `INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2)`,
        [userId, commentId]
      );
      action = 'liked';
      
      // 4. Send notification (if not liking your own comment)
      if (userId !== commentAuthorId) {
        const sender = await query(
          `SELECT username FROM users WHERE id = $1`,
          [userId]
        );

        await sendNotification({
          senderId: userId,
          receiverId: commentAuthorId,
          type: "like_comment",
          message: `${sender.rows[0]?.username || "Someone"} liked your comment`,
          targetType: "comment",
          targetId: commentId,
          reviewId: reviewId
        });
      }
    }

    // 5. Get updated like count
    const likesCount = await query(
      `SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1`,
      [commentId]
    );

    res.status(200).json({ 
      success: true,
      action,
      likesCount: parseInt(likesCount.rows[0].count),
      isLiked: !likeExists // Return the new state
    });

  } catch (err) {
    console.error("Error toggling comment like:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

//delete comment
export const deleteComment = async (req, res) => {
  const userId = req.user.id;
  const { commentId } = req.params;
  
  if (!commentId || isNaN(commentId)){
    return res.status(400).json({ message: "Invalid comment ID" });
  }

  try {
    // Check if comment exists and belongs to user
    const existing = await query(
      'SELECT * FROM comments WHERE id = $1 AND user_id = $2',
      [commentId, userId]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Comment not found or not authorized' });
    }
    
    await query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ message: 'Server error' });
  }
};