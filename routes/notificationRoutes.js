import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { getUserNotifications } from '../controllers/notificationController.js';
import { query } from '../db/db.js';

const router = express.Router();

router.get("/notifications/", verifyToken, getUserNotifications);
//marks-read once user clicks on notification with specified id frontend would send
router.patch("/notifications/:id/mark-read", verifyToken, async (req, res) => {
    const {id} = req.params;
    try{
        await query(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND receiver_id = $2`,[id, req.user.id]);
        res.status(200).json({message: "Notification marked as read"});
    } catch(err) {
        console.error("the marking as read error: ", err);
        res.status(500).json({error: "Failed to mark as read"});
    }
});

export default router;