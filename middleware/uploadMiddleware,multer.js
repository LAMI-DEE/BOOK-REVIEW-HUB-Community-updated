import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary"
import cloudinary  from "../utils/cloudinary.js";

// 1:Create a Cloudinary storage engine for multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary, //the one we configured in utils earlier

    params: {
        folder: "BookReviewHub-Profiles", // sets as folder name in cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png'], //acceptable image types
        transformation: [{ width: 500, height: 500, crop: 'limit' }] //Optional resizing for when saving on cloudinary
    }
});
//2: create the multer middleware
const upload = multer({
    storage: storage, //Use cloudinary as Storage
    limits: {
        fileSize: 3 * 1024 * 1024 //Max size = 3MB
    }
});

export default upload;