import express from 'express';
import { addCustomBook } from '../controllers/addCustomBookController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.post('/custom-books', verifyToken, isAdmin, addCustomBook);

export default router;