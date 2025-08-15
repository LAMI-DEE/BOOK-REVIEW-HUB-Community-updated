//handles register and login requests
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/db.js';
import { uploadProfileImage } from './uploadController.js'; //function controlling getting cloudinary url

const SALT_ROUNDS = 10;

//Register
export const registerUser = async (req, res) => {
    const { username, email, password, bio, profile_img: profile_img_input, favorite_genres } = req.body;

    try {
        // Check if email already exists
        const existing = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        
        // Handle image upload if file was sent
        let profile_img = null;
        if (req.file) {
            const uploadedUrl = await uploadProfileImage(req.file.path);
            profile_img = uploadedUrl;
        } else if (profile_img_input) {
            const isImageUrl = /\.(jpg|jpeg|png)(\?.*)?$/i.test(profile_img_input);
            if (isImageUrl) {
                profile_img = profile_img_input;
            } else {
                return res.status(400).json({ message: "Invalid image URL. Must end with .jpg, .jpeg or .png/Copy image Address not image" });
            }
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await query(
            'INSERT INTO users (username, email, password, bio, profile_img, favorite_genres) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [username, email, hashedPassword, bio, profile_img, favorite_genres]
        );
        
        // Generate token for the new user (same as login)
        const newUser = result.rows[0];
        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, is_admin: newUser.is_admin }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );
        
        // Return token and user data similar to login
        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                bio: newUser.bio,
                profile_img: newUser.profile_img,
                favorite_genres: newUser.favorite_genres
            }
        });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const loginUser = async (req, res) => {
    const {email, password} = req.body;

    try{
        //Check if user exists
        const user = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const valid = await bcrypt.compare(password, user.rows[0].password);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.rows[0].id, email: user.rows[0].email, is_admin: user.rows[0].is_admin}, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.rows[0].id,
                username: user.rows[0].username,
                email: user.rows[0].email,
                bio: user.rows[0].bio,
                profile_img: user.rows[0].profile_img,
                favorite_genres: user.rows[0].favorite_genres
            }
        });
    }catch(err){
        console.error('Error logging in user:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};





///auth for admin and user is the token verification