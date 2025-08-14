import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { createReview, updateReview, deleteReview, likeReview, unlikeReview, removeLike, removeUnlike, getUserBookReview, getReviewWithBookDetails,  checkReviewLikeStatus } from '../controllers/reviewController.js';
import { getReviewsByBook } from '../controllers/getBookDetailsController.js';

const router = express.Router();

// Route to create a review
router.post('/reviews/:bookId/create', verifyToken, createReview);
router.put('/reviews/:id/update', verifyToken, updateReview); // Route to edit/update a review by ID
router.delete('/reviews/:id/delete', verifyToken, deleteReview); // Route to delete a review by ID
router.get('/reviews/:bookId', getReviewsByBook); // Route to get reviews by book ID
router.post("/reviews/:reviewId/like", verifyToken, likeReview);
router.post("/reviews/:reviewId/unlike", verifyToken, unlikeReview);
router.delete("/reviews/:reviewId/remove-like", verifyToken, removeLike);
router.delete("/reviews/:reviewId/remove-unlike", verifyToken, removeUnlike);
router.get("/review/:bookId/user-review", verifyToken, getUserBookReview);
router.get("/reviews/:reviewId/with-book-details", getReviewWithBookDetails);

router.get("/reviews/:reviewId/check-like", verifyToken, checkReviewLikeStatus); // Route to check if the user liked a review
export default router;