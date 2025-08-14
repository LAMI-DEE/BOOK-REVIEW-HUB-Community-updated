import { query } from "../db/db.js";

/**
 * Sends a notification from one user to another
 * @param {Object} options
 * @param {number} options.senderId - ID of user sending the notification
 * @param {number} options.receiverId - ID of user receiving the notification
 * @param {string} options.type - Type of notification (e.g., 'follow', 'like_review', 'comment')
 * @param {string} options.message - Message to show in the UI
 * @param {string} [options.targetType] - Optional: 'review', 'comment'
 * @param {number} [options.targetId] - Optional: ID of the review or comment
 */
export async function sendNotification({
  senderId,
  receiverId,
  type,
  message,
  targetType,
  targetId
}) {
  try {
    await query(
      `INSERT INTO notifications 
      (sender_id, receiver_id, type, message, target_type, target_id)
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [senderId, receiverId, type, message, targetType, targetId]
    );
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
}