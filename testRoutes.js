import express from 'express';
import { verifyToken } from './middleware/authMiddleware.js';

const router = express.Router();

router.get('/protected', verifyToken, (req, res) => {
  res.json({
    message: `Hello, ${req.user.email}. You’re authenticated.`,
    user: req.user
  });
});

export default router;


//to test this, you can use a tool like Postman or cURL to make a GET request to http://localhost:3000/api/test/protected with a valid JWT token in the Authorization header.
//The token is gottn from the login endpoint of the authRoutes, which is not shown here but is assumed to be implemented in your authController.js.
//so copy the token from the login response and use it in the Authorization header as Bearer <token> when making the request to /api/test/protected.