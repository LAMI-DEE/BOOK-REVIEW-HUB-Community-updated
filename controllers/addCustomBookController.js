import { query } from "../db/db.js";
import { uploadBookCover } from "./uploadController.js";

export const addCustomBook = async (req, res) => {
    try {
        // Get text fields from req.body (already parsed by express)
        const { 
            book_key, 
            title, 
            author, 
            genre, 
            description, 
            cover_img: cover_img_input 
        } = req.body;

        const userId = req.user.id;

        let cover_img = null;
        
        // Handle file upload
        if (req.file) {
            const uploadedUrl = await uploadBookCover(req.file.path);
            cover_img = uploadedUrl;
        } 
        // Handle URL if no file was uploaded
        else if (cover_img_input) {
            const isImageUrl = /\.(jpg|jpeg|png)(\?.*)?$/i.test(cover_img_input);
            if (isImageUrl) {
                cover_img = cover_img_input;
            } else {
                return res.status(400).json({ 
                    message: "Invalid image URL. Must end with .jpg, .jpeg or .png" 
                });
            }
        } else {
            return res.status(400).json({ 
                message: "Either an image file or URL is required" 
            });
        }

        // Parse genre if it's a string (from form data)
        let genresArray;
        try {
            genresArray = typeof genre === 'string' ? JSON.parse(genre) : genre;
            if (!Array.isArray(genresArray)) {
                throw new Error('Genres must be an array');
            }
        } catch (err) {
            return res.status(400).json({ 
                message: "Invalid genres format" 
            });
        }

        const result = await query(
            'INSERT INTO custom_books (book_key, title, author, genre, description, cover_img, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', 
            [book_key, title, author, genresArray, description, cover_img, userId]
        );
        
        res.status(201).json({
            message: 'Custom book added successfully',
            book: result.rows[0],
        });
    } catch (err) {
        console.error('Error adding custom book:', err);
        
        if (err.code === '23505') { // Unique violation (book_key already exists)
            return res.status(409).json({ 
                message: 'A book with this key already exists' 
            });
        }
        
        res.status(500).json({ 
            message: 'Internal server error' 
        });
    }
};