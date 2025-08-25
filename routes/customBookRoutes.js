import express from 'express';
import { addCustomBook } from '../controllers/addCustomBookController.js';
import { getCustomBooks, getCustomBookById } from '../controllers/getCustomBookController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';
import upload from '../middleware/uploadMiddleware,multer.js';

const router = express.Router();

router.post('/custom-books', verifyToken, isAdmin, upload.single('cover_img_file'), addCustomBook);
router.get('/custom-books', getCustomBooks);
router.get('/custom-books/:id', getCustomBookById);

export default router;