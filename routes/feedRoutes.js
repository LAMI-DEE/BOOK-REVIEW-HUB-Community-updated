import express from 'express';
import { getCommunityFeed } from '../controllers/feedController.js';
import { verifyToken } from '../middleware/authMiddleware.js'

const router = express.Router();

router.get('/community-feed', verifyToken, getCommunityFeed);

export default router