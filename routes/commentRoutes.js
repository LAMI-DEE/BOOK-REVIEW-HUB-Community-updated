import express from "express";
import {
  postComment,
  getCommentsByReview,
  likeComment,
  unlikeComment,
  deleteComment,
  toggleCommentLike
} from "../controllers/commentController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Step 17: Post a comment
router.post("/reviews/:reviewId/comments", verifyToken, postComment);
// Step 19: Delete a comment
router.delete("/comments/:commentId/delete", verifyToken, deleteComment);

// Step 18: Get all comments for a review
router.get("/reviews/:reviewId/comments", getCommentsByReview); // Route to get comments for a review

// Like & Unlike comment
router.post("/comments/:commentId/like", verifyToken, likeComment);
router.delete("/comments/:commentId/unlike", verifyToken, unlikeComment);
//toggle comment like
router.post("/comments/:commentId/toggle-like", verifyToken, toggleCommentLike);

export default router;
