import { query } from "../db/db.js";
import axios from "axios";

// Fetch reviews + user info, with optional search + pagination
// const getReviewsByBook = async (bookId, page = 1, search = "") => {
//   const limit = 9;
//   const offset = (page - 1) * limit;

//   const values = [`%${search.toLowerCase()}%`, bookId, limit, offset];

//   const result = await query(`
//     SELECT r.rating, r.review_text, u.username, u.profile_img
//     FROM reviews r
//     JOIN users u ON r.user_id = u.id
//     WHERE r.book_id = $2
//       AND (LOWER(u.username) ILIKE $1 OR LOWER(r.review_text) ILIKE $1)
//     ORDER BY r.id DESC
//     LIMIT $3 OFFSET $4
//   `, values);

//   return result.rows;
// };
export const getReviewsByBook = async (req, res) => {
  try {
    if (!req.params || !req.params.bookId) {
      throw new Error("Book ID parameter is missing");
    }
    
    const { bookId } = req.params;
    
    const reviews = await query(
      `SELECT r.id, r.rating, r.review_text, r.created_at,
              u.username, u.profile_img
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.book_id = $1
       ORDER BY r.created_at DESC`,
      [bookId]
    );

    const stats = await query(
      `SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS avg_rating
       FROM reviews WHERE book_id = $1`,
      [bookId]
    );

    if (!res || typeof res.status !== 'function') {
      throw new Error("Invalid response object");
    }

    res.status(200).json({
      reviews: reviews.rows,
      review_count: parseInt(stats.rows[0].count) || 0,
      average_rating: parseFloat(stats.rows[0].avg_rating) || 0
    });
  } catch (err) {
    console.error("Error fetching reviews:", err);
    if (res && typeof res.status === 'function') {
      res.status(500).json({ message: "Internal server error" });
    } else {
      console.error("Cannot send error response - invalid response object");
    }
  }
};

// Review count and average rating
const getReviewStats = async (bookId) => {
  const stats = await query(`
    SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS avg_rating
    FROM reviews
    WHERE book_id = $1
  `, [bookId]);

  return {
    count: parseInt(stats.rows[0].count),
    avg_rating: parseFloat(stats.rows[0].avg_rating) || 0,
  };
};

// Fallback: Fetch from OpenLibrary API
const fetchApiBookDetails = async (bookId) => {
  try {
    const url = `https://openlibrary.org/works/${bookId}.json`;
    const res = await axios.get(url);
    const data = res.data;

    const title = data.title || "Untitled";
    const genre = data.subjects?.slice(0, 4) || [];
    const description = typeof data.description === "string"
      ? data.description
      : data.description?.value || null;

    const authorKey = data.authors?.[0]?.author?.key;
    let author = "Unknown Author";
    if (authorKey) {
      const authorRes = await axios.get(`https://openlibrary.org${authorKey}.json`);
      author = authorRes.data?.name || "Unknown Author";
    }

    const coverId = data.covers?.[0];
    const cover_img = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
      : null;

    return { title, author, cover_img, genre, description };
  } catch (err) {
    console.error("Error fetching OpenLibrary details:", err.message);
    return null;
  }
};

// 🌟 Main Controller 🌟
export const getBookDetails = async (req, res) => {
  try {
    if (!req.params || !req.params.bookId) {
      throw new Error("Book ID parameter is missing");
    }

    const { bookId } = req.params;
    const { page = 1, search = "" } = req.query;

    // 1. Try reviewed_books
    const reviewed = await query("SELECT * FROM reviewed_books WHERE book_key = $1", [bookId]);

    let bookData;

    if (reviewed.rowCount > 0) {
      const book = reviewed.rows[0];
      bookData = {
        book_key: book.book_key,
        title: book.title,
        author: book.author,
        cover_img: book.cover_img,
        genre: book.genre?.slice(0, 4) || [],
        description: book.description || null,
      };
    } else {
      // 2. Try custom_books
      const custom = await query("SELECT * FROM custom_books WHERE book_key = $1", [bookId]);
      if (custom.rowCount > 0) {
        const book = custom.rows[0];
        bookData = {
          book_key: book.book_key,
          title: book.title,
          author: book.author,
          cover_img: book.cover_img,
          genre: book.genre?.slice(0, 4) || [],
          description: book.description || null,
        };
      } else {
        // 3. Fallback: OpenLibrary
        const fetched = await fetchApiBookDetails(bookId);
        if (!fetched) {
          if (res && typeof res.status === 'function') {
            return res.status(404).json({ message: "Book not found" });
          }
          throw new Error("Book not found");
        }

        bookData = {
          book_key: bookId,
          ...fetched,
        };
      }
    }

    // 4. Get review stats
    const stats = await getReviewStats(bookId);

    // 5. Response
    if (!res || typeof res.status !== 'function') {
      throw new Error("Invalid response object");
    }

    res.status(200).json({
      ...bookData,
      review_count: stats.count,
      average_rating: stats.avg_rating,
    });

  } catch (err) {
    console.error("Error in getBookDetails:", err.message);
    if (res && typeof res.status === 'function') {
      res.status(500).json({ message: "Internal server error" });
    } else {
      console.error("Cannot send error response - invalid response object");
    }
  }
};