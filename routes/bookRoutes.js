import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { getAllCustomBooks, searchBooks, recommendBook, getAllRecommendedBooks, deleteRecommendedBook } from '../controllers/bookController.js';
import { isAdmin } from '../middleware/adminMiddleware.js';
import { getBookDetails } from '../controllers/getBookDetailsController.js';

const router = express.Router();

router.get('/custom-books', verifyToken, isAdmin, getAllCustomBooks); // Route to get all custom books [admin only]
router.get('/search', searchBooks);     // Route to search for books(both custom and API)
router.get("/books/:bookId", getBookDetails);
router.post('/recommend-book', verifyToken, recommendBook); // Route to recommend a book [all users]
router.get('/allrecommended-books', verifyToken, isAdmin, getAllRecommendedBooks); // Route to get all recommended books [admin only]
router.delete('/recommended-books/:id', verifyToken, isAdmin, deleteRecommendedBook); // Route to delete a recommended book [admin only]

export default router;