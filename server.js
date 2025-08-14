// starts server
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import dotenv from 'dotenv';


dotenv.config();

const PORT = process.env.PORT || 3000;

//create http server from app
const server = http.createServer(app);

//create socket server and attach to http server
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',//Frontend URL
        credentials: true
    }
});
//Store connected users(optional: for targeting)
const onlineUsers = new Map();

// When a user connects
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Listen for user login to track userId
    socket.on('registerUser', (userId) => {
        onlineUsers.set(userId, socket.id);
        console.log(`User ${userId} registered with socket ID ${socket.id}`);
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (let [userId, sockId] of onlineUsers.entries()) {
            if (sockId === socket.id) {
                onlineUsers.delete(userId);
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

export{ io, onlineUsers };