import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { updateUserProfile } from '../controllers/userController.js';
import { getUserProfile, searchUsers } from '../controllers/userController.js';
import { getUserReviews } from '../controllers/userController.js';
import { getUserProfilePage } from '../controllers/userProfilepageControl.js';
import { followUser, unfollowUser, allFollowers, allFollowing, toggleFollowUser, checkFollowStatus } from '../controllers/userController.js';
import upload from '../middleware/uploadMiddleware,multer.js';

const router = express.Router();

router.put('/user/update', verifyToken, upload.single('profile_img'), updateUserProfile);
router.get('/user/:id', getUserProfile);
router.get('/user/:id/reviews', getUserReviews);
router.get('/users/search', searchUsers); // Route to search for users
router.get("/users/:userId/profile-page", getUserProfilePage);
router.post("/users/follow/:id", verifyToken, followUser);
router.post("/users/unfollow/:id", verifyToken, unfollowUser);
router.get('/users/:id/followers', allFollowers);
router.get('/users/:id/following', allFollowing);
router.post("/users/:id/toggle-follow",verifyToken ,toggleFollowUser);
router.get("/users/:id/am-following", verifyToken, checkFollowStatus);

export default router;