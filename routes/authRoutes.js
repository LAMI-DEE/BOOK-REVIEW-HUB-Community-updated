import express from 'express';
import { registerUser, loginUser } from '../controllers/authController.js';
import upload from '../middleware/uploadMiddleware,multer.js';

const router = express.Router();

router.post('/register',upload.single('profile_img'), registerUser);
router.post('/login', loginUser);

export default router;