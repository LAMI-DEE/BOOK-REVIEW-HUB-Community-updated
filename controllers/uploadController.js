
import cloudinary from "../utils/cloudinary.js";

const uploadProfileImage = async (filePath) => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: "BookReviewHub-Profiles",
        });
        return result.secure_url;
    } catch (err) {
        throw new Error("Upload failed: " + err.message);
    }
};

const uploadBookCover = async (filePath) => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: "BookReviewHub-BookCovers",//different from profile-piic upload folder
        });
        return result.secure_url;
    } catch (err) {
        throw new Error("Book Cover Upload failed: " + err.message);
    }
};
export { uploadProfileImage, uploadBookCover };