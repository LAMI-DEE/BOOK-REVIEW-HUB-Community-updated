import express from "express";
import { getCommunityFeed } from "../controllers/communityController.js";


const router = express.Router();
// Route to get community feed
router.get("/community/feed", getCommunityFeed);   

export default router;