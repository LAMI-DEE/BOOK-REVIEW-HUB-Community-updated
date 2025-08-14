//user profile,following, and other user-related functionalities
import { query } from '../db/db.js';
import { uploadProfileImage } from './uploadController.js';
import { sendNotification } from '../utils/sendNotification.js';
import { io, onlineUsers } from '../server.js'

export const updateUserProfile = async (req, res) => {
    
    const loggedInUserId = req.user.id; // Get the logged-in user's ID from the token


    const { username, bio, email, profile_img:profile_img_input} = req.body;
    let favorite_genres = [];
    try{
        favorite_genres = JSON.parse(req.body.favorite_genres || '[]');
    }catch(err){
        console.error('Error parsing favorite_genres:', err);
        return res.status(400).json({ message: 'Invalid favorite_genres format' });
    }

    try{
        let profile_img = null;

        if (req.file){
            //User uploaded a new image file -so do to cloudinary
            profile_img = await uploadProfileImage(req.file.path);
        } else if (profile_img_input){
            //User provided an external image URL ,Validate
             const isImageUrl = /\.(jpg|jpeg|png)(\?.*)?$/i.test(profile_img_input);

            if(isImageUrl){
                profile_img = profile_img_input;

            } else {
                return res.status(400).json({ message: "Invalid image URL. Must end with .jpg, .jpeg or .png/Copy image not image Address"});
            }
        }
        if (!profile_img){
            const current = await query('SELECT profile_img FROM users WHERE id = $1', [loggedInUserId]);
            profile_img = current.rows[0]?.profile_img || null;
        }
        const result = await query(
            'UPDATE users SET username = $1, email = $2, bio = $3, profile_img = $4, favorite_genres = $5 WHERE id = $6 RETURNING *',
            [username, email, bio, profile_img, favorite_genres, loggedInUserId]
        );
        res.json({
            message: 'Profile updated successfully',
            user: result.rows[0]
        });
    } catch(error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({message:'Internal server error'});
    }
};
export const getUserProfile = async (req, res) => {
    const {id} = req.params; // Get the user ID from the request parameters
    try{
        const result = await query('SELECT id, username, email, bio, profile_img, favorite_genres, created_at FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({user: result.rows[0] });
    }catch(err){
        console.error('Error fetching user:', err);
        res.status(500).json({message: 'Server error'});
    }
};
export const getUserReviews = async (req, res) => {
  const { id } = req.params; // From route: /users/:id/reviews

  try {
    const result = await query(`
  SELECT 
    r.id, r.book_id, r.book_source, r.rating, r.review_text, r.created_at, r.updated_at,
    COALESCE(rb.title, cb.title) AS title,
    COALESCE(rb.author, cb.author) AS author,
    COALESCE(rb.cover_img, cb.cover_img) AS cover_img,
    COALESCE(rb.genre, cb.genre) AS genre,
    r.book_source AS book_source_full
  FROM reviews r
  LEFT JOIN reviewed_books rb ON r.book_id = rb.book_key
  LEFT JOIN custom_books cb ON r.book_source = 'custom' AND r.book_id = cb.book_key
  WHERE r.user_id = $1
  ORDER BY r.created_at DESC
`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No reviews found for this user' });
    }

    res.status(200).json({
      user_id: id,
      total: result.rows.length,
      reviews: result.rows
    });

  } catch (err) {
    console.error('Error fetching user reviews:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
export const searchUsers = async (req, res) => {
    const keyword = req.query.q;
    if (!keyword || keyword.trim() === '') {
        return res.status(400).json({ message: 'Search keyword is required' });
    }

    try{
        const searchTerm = `%${keyword.toLowerCase()}%`;
        const result = await query(
            'SELECT id, username, profile_img, bio FROM users WHERE LOWER(username) LIKE $1 OR LOWER(email) LIKE $1 LIMIT 8',
            [searchTerm]
        );

        if (result.rows.length === 0) {
            return res.status(204).json({ message: 'No users found' });
        }
        res.status(200).json({
            message: 'Users search successfully',
            results: result.rows
        });
    }catch(err){
        console.error('Error searching users:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const followUser = async (req, res) => {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.id);

    if (followerId ===followingId){
        return res.status(400).json({message: "You cant follow yourself"});
    }
    try{
        const check = await query("SELECT * FROM followers WHERE follower_id = $1 AND following_id = $2",[followerId, followingId]);
        if(check.rows.length > 0){
            return res.status(409).json({message: "Already following this user."});
        }
        await query("INSERT INTO followers (follower_id, following_id) VALUES ($1, $2)", [followerId, followingId]);
        
        const sender = await query("SELECT username FROM users WHERE id = $1",[followerId]);
         const followedUser = await query("SELECT username FROM users WHERE id = $1", [followingId]);
         //notify the person being followed
        await sendNotification({
            senderId: followerId,
            receiverId: followingId,
            type: "follow",
            message: `${sender.rows[0]?.username || "Someone "} started following you`,
            targetType: null,
            targetId: null
        });
        //notify the person who followed(themself)
       await sendNotification({
            senderId: followerId,
            receiverId: followerId,
            type: "follow",
            message: `You are now following ${followedUser.rows[0]?.username || "this user"}.`,
            targetType: null,
            targetId: null
        });
        const followedSocketId = onlineUsers.get(followingId);
        if (followedSocketId) {
            io.to(followedSocketId).emit("notification", 
                {
                    senderId: followerId,
                    type: "follow",
                    message: `${sender.rows[0]?.username || "Someone "} started following you`
                });
        }
        const followerSocketId = onlineUsers.get(followerId);
        if (followerSocketId) {
            io.to(followerSocketId).emit("notification", 
                {
                    senderId: followerId,
                    type: "follow",
                    message: `You are now following ${followedUser.rows[0]?.username || "this user"}.`
                });
        }
        return res.status(200).json({message:`You are now following ${followedUser.rows[0]?.username || "this user"}.`});
    }catch(err){
        console.error("Error in followUser:", err);
        res.status(500).json({message: "Internal Server error."});
    }
};
export const unfollowUser = async (req, res) => {
    const loggedInUserId = req.user.id;
    const targetUserId = parseInt(req.params.id);

    if(loggedInUserId === targetUserId){
        return res.status(400).json({message: "You cant follow yourself."});
    }

    try{
        const existingFollow = await query("SELECT * FROM followers WHERE follower_id = $1 AND following_id = $2", [loggedInUserId, targetUserId]);
        if(existingFollow.rowCount === 0){
            return res.status(409).json({message: "You are not following this user."});
        }

        await query("DELETE FROM followers WHERE follower_id = $1 AND following_id = $2", [loggedInUserId, targetUserId]);
        const unfollowedUser = await query("SELECT username FROM users WHERE id = $1", [targetUserId]);
        await sendNotification({
            senderId: loggedInUserId,
            receiverId: loggedInUserId,
            type: "unfollow",
            message: `You unfollowed ${unfollowedUser.rows[0]?.username || "a user"}`,
            targetType: null,
            targetId: null
        });
        const unfollowerSocketId = onlineUsers.get(loggedInUserId);
        if (unfollowerSocketId) {
            io.to(unfollowerSocketId).emit("notification", 
                {
                    senderId: loggedInUserId,
                    type: "unfollow",
                    message: `You unfollowed ${unfollowedUser.rows[0]?.username || "a user"}`
                });
        }
        res.status(200).json({message: "You have unfollowed the user"});
    }catch(err){
        console.error("Unfollow Error: ", err);
        res.status(500).json({message: "Internal server error."})
    }
};

export  const allFollowers = async (req, res) => {
    const {id} = req.params;//user being viewed
    const currentUserId = req.user?.id; //logged in user(from session/middleware)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    try{
        const countResult =await query("SELECT COUNT(*) FROM followers WHERE following_id = $1", [id]);
        const totalFollowers = parseInt(countResult.rows[0].count);

        const result = await query(`SELECT u.id AS user_id, u.username, u.profile_img, EXISTS (SELECT 1 FROM followers WHERE follower_id = $1 AND following_id = u.id) AS is_following_you FROM followers f JOIN users u ON f.follower_id = u.id WHERE f.following_id = $2 ORDER BY f.created_at DESC LIMIT $3 OFFSET $4`,[currentUserId || 0, id, limit, offset]);
        res.json({
            totalFollowers,
            followers: result.rows
        });
    }catch(err){
        console.error("Error fetching followers: ", err);
        res.status(500).json({message: "Failed to fetch followers, Server error"});
    }
};

export const allFollowing = async (req, res) => {
    const {id} = req.params;//user being viewed
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;
    try{
        const countResult = await query("SELECT COUNT(*) FROM followers WHERE follower_id = $1",[id]);
        const totalFollowing = parseInt(countResult.rows[0].count);
        //list of users they are following
        const result = await query(`SELECT u.id AS user_id, u.username, u.profile_img FROM followers f JOIN users u ON f.following_id = u.id WHERE f.follower_id = $1 ORDER BY f.created_at DESC LIMIT $2 OFFSET $3`, [id, limit, offset]);
        res.json({
            totalFollowing,
            following: result.rows,
        });
    }catch(err){
        console.error("Error fetching following: ", err);
        res.status(500).json({message: "Failed to fetch following, Server error"});
    }
};
export const toggleFollowUser = async (req, res) => {
    const followerId = req.user.id;//depends on auth setup
    const followingId = parseInt(req.params.id);

    if(isNaN(followingId)){
        return res.status(400).json({error: "Invalid User ID"});
    }

    if ( followerId === followingId){
        return res.status(400).json({error: "Invalid follow action"});
    }
    try{
        // Check if already following
        const result = await query(
        `SELECT * FROM followers WHERE follower_id = $1 AND following_id = $2`,
        [followerId, followingId]
        );

        if (result.rows.length > 0) {
      // Unfollow
        await query(
            `DELETE FROM followers WHERE follower_id = $1 AND following_id = $2`,
            [followerId, followingId]
        );
        const unfollowedUser = await query("SELECT username FROM users WHERE id = $1", [followingId]);
        await sendNotification({
            senderId: followerId,
            receiverId: followerId,
            type: "unfollow",
            message: `You unfollowed ${unfollowedUser.rows[0]?.username || "a user"}`,
            targetType: null,
            targetId: null
        });
         const unfollowerSocketId = onlineUsers.get(followerId);
        if (unfollowerSocketId) {
            io.to(unfollowerSocketId).emit("notification", 
                {
                    senderId: followerId,
                    type: "unfollow",
                    message: `You unfollowed ${unfollowedUser.rows[0]?.username || "a user"}`
                });
        }
        return res.status(200).json({ status: "unfollowed" });
        } else {
        // Follow
        await query(
            `INSERT INTO followers (follower_id, following_id) VALUES ($1, $2)`,
            [followerId, followingId]
        );
         const sender = await query("SELECT username FROM users WHERE id = $1",[followerId]);
        await sendNotification({
            senderId: followerId,
            receiverId: followingId,
            type: "follow",
            message: `${sender.rows[0]?.username || "Someone "} started following you`,
            targetType: null,
            targetId: null
        });
         //notify the person who followed( notify themself)
        const followedUser = await query("SELECT username FROM users WHERE id = $1", [followingId]);
       await sendNotification({
            senderId: followerId,
            receiverId: followerId,
            type: "follow",
            message: `You are now following ${followedUser.rows[0]?.username || "this user"}.`,
            targetType: null,
            targetId: null
        });
        const followedSocketId = onlineUsers.get(followingId);
        if (followedSocketId) {
            io.to(followedSocketId).emit("notification", 
                {
                    senderId: followerId,
                    type: "follow",
                    message: `${sender.rows[0]?.username || "Someone "} started following you`
                });
        }
        const followerSocketId = onlineUsers.get(followerId);
        if (followerSocketId) {
            io.to(followerSocketId).emit("notification", 
                {
                    senderId: followerId,
                    type: "follow",
                    message: `You are now following ${followedUser.rows[0]?.username || "this user"}.`
                });
        }
        return res.status(200).json({ status: "followed" });
        }
    }catch(err){
         console.error("Follow/Unfollow Error:", err);
        return res.status(500).json({ error: "Something went wrong, Server error?" });
    }
}; 

export const checkFollowStatus = async (req, res) => {
    try{
        const followerId = req.user.id;
        const followingId = parseInt(req.params.id);
        
        const result = await query('SELECT EXISTS (SELECT 1 FROM followers WHERE follower_id = $1 AND following_id = $2) AS following', [followerId, followingId]);
        res.json({isFollowing: result.rows[0].following});
    }catch(err){
        console.error("Error checking follow status: ", err);
        res.status(500).json({message: "Failed to check follow status, Server error"});
    }
};