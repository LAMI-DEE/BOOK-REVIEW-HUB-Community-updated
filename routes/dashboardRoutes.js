import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { getDashboardBooks, getDashboardMetrics } from '../controllers/dashboardController.js';

const router = express.Router();

// Route to get dashboard data
router.get('/dashboard/metrics', verifyToken, getDashboardMetrics);
router.get('/dashboard/books', verifyToken, getDashboardBooks);

export default router;