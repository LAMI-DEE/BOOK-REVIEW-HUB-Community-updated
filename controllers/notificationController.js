import { query } from "../db/db.js";

//Get notifications for a user

// Updated notificationController.js
export const getUserNotifications = async (req, res) => {
    const userId = req.user.id;
    const offset = parseInt(req.query.offset) || 0;

    try {
        const result = await query(`
            SELECT 
                n.*,
                u.username as sender_username,
                u.profile_img as sender_profile_img
            FROM notifications n
            JOIN users u ON n.sender_id = u.id
            WHERE n.receiver_id = $1 
            ORDER BY n.created_at DESC 
            LIMIT 25 OFFSET $2`,
            [userId, offset]
        );
        res.status(200).json({ notifications: result.rows });
    } catch (err) {
        console.error("Error fetching notifications:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};




// export const getUserNotifications = async (req, res) => {
//     const userId = req.user.id;
//     const offset = parseInt(req.query.offset) || 0;

//     try {
//         const result = await query(`SELECT * FROM notifications WHERE receiver_id = $1 ORDER BY created_at DESC LIMIT 25 OFFSET $2`,[userId, offset]);
//         res.status(200).json({notifications: result.rows });
//     } catch (err) {
//         console.error("Error fetching notifications:", err);
//         res.status(500).json({message: "Internal server error"});
//     }
// };