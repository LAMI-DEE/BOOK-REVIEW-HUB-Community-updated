import { query } from "../db/db.js";
import { uploadBookCover } from "./uploadController.js";

export const addCustomBook = async (req, res) => {
    const bodyData = req.file ? req.body : JSON.parse(JSON.stringify(req.body));
    const {book_key, title, author, genre, description, cover_img:cover_img_input} = bodyData;
    const userId = req.user.id;

    let cover_img = null;
    if(req.file) {
        const uploadedUrl = await uploadBookCover(req.file.path);
        cover_img = uploadedUrl;
    } else if (cover_img_input){
         //check if its a valid image URL ending with right extension (jpg,png or jpeg)
            const isImageUrl = /\.(jpg|jpeg|png)(\?.*)?$/i.test(cover_img_input);
             if(isImageUrl){
                cover_img = cover_img_input;

            } else {
                return res.status(400).json({ message: "Invalid image URL. Must end with .jpg, .jpeg or .png/Copy image Address not image"});
            }
    }

    try{
        const result = await query(
            'INSERT INTO custom_books (book_key, title, author, genre, description, cover_img, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', 
            [book_key, title, author, genre, description, cover_img, , userId]);
        res.status(201).json({
            message: 'Custom book added successfully',
            book: result.rows[0],
        });
    } catch(err) {
        console.error('Error adding custom book:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};