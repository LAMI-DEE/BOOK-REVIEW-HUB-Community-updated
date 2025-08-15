// Main express app
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js'; // Importing review routes
import customBookRoutes from './routes/customBookRoutes.js';
import feedRoutes from './routes/feedRoutes.js';
import bookRoutes from './routes/bookRoutes.js'; // Importing book routes
import commentRoutes from "./routes/commentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import dashboardRoutes from './routes/dashboardRoutes.js'; // Importing dashboard routes
import communityRoutes from './routes/communityRoutes.js';
import testRoutes from './testRoutes.js'; // Importing test routes for testing purposes


dotenv.config();
const app = express();

app.use(cors({
    origin: [
            'http://localhost:5173',
            /\.vercel\.app$/  // Allow Vercel deployments
        ],//Frontend URL
    credentials: true // Allow cookies to be sent
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', reviewRoutes); // Use review routes for handling book reviews
app.use('/api', customBookRoutes);
app.use('/api', bookRoutes); // Use book routes for handling books stuffs
app.use('/api', feedRoutes);
app.use("/api", commentRoutes);
app.use("/api", notificationRoutes);
app.use('/api', dashboardRoutes); // Use dashboard routes for handling dashboard data
app.use('/api', communityRoutes); // Use community routes for handling community feed

app.use('/api/test', testRoutes); // Use test routes for testing purposes

export default app;