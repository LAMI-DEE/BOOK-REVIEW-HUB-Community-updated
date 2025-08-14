//book search/custom search
import { query } from "../db/db.js";
import axios from "axios";

export const getAllCustomBooks = async (req, res) => {
    try{
        const result = await query('SELECT * FROM custom_books ORDER BY created_at DESC');
        res.status(200).json({
            message: 'Custom books retrieved successfully',
            books: result.rows,
        });
    }catch(err){
        console.error('Error fetching custom books:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};


// Helper: Check if reviewed_book already exists
const getReviewedBook = async (book_key, source) => {
  const result = await query(
    'SELECT * FROM reviewed_books WHERE book_key = $1 AND source = $2',
    [book_key, source]
  );
  return result.rows[0] || null;
};

export const searchBooks = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ message: 'Search query is required' });

  try {
    const openLibRes = await axios.get(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12`
    );
    const openLibBooks = openLibRes.data.docs.slice(0, 12);

    const apiBooks = await Promise.all(openLibBooks.map(async (book) => {
      try {
        const workKey = book.key; // e.g. "/works/OL123W"
        const workRes = await axios.get(`https://openlibrary.org${workKey}.json`);
        const workData = workRes.data;

        const genre = workData.subjects?.slice(0, 3) || [];
        const description = typeof workData.description === 'string'
          ? workData.description
          : workData.description?.value || null;

        return {
          source: 'api',
          book_key: workKey.replace('/works/', ''), // normalize
          title: book.title,
          author: book.author_name?.[0] || 'Unknown',
          cover_img: book.cover_i
            ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
            : null,
          genre,
          description,
        };
      } catch {
        return null;
      }
    }));

    const keyword = `%${q.toLowerCase()}%`;
    const customResult = await query(
      'SELECT * FROM custom_books WHERE LOWER(title) ILIKE $1 OR LOWER(author) ILIKE $1 LIMIT 5',
      [keyword]
    );

    const customBooks = customResult.rows.map(book => ({
      source: 'custom',
      book_key: book.book_key,
      title: book.title,
      author: book.author,
      cover_img: book.cover_img,
      genre: book.genre?.slice(0, 3) || [],
      description: book.description || null,
    }));

    const merged = [...apiBooks.filter(Boolean), ...customBooks];
    res.status(200).json({ results: merged });

  } catch (err) {
    console.error('Book search failed:', err.message);
    res.status(500).json({ message: 'Internal server error during search' });
  }
};

export const recommendBook = async (req, res) => {
    const { title, author } = req.body;
    const userId = req.user.id;

    if (!title || !author) {
        return res.status(400).json({ message: 'Title and author are required' });
    }

    try {
        const result = await query(
            'INSERT INTO recommended_books (title, author, recommended_by) VALUES ($1, $2, $3) RETURNING *',
            [title, author, userId]
        );
        
        res.status(201).json({
            message: 'Book recommendation submitted successfully',
            recommendation: result.rows[0]
        });
    } catch (err) {
        console.error('Error recommending book:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getAllRecommendedBooks = async (req, res) => {
    try {
        const result = await query(`
            SELECT rb.*, u.username, u.profile_img 
            FROM recommended_books rb
            JOIN users u ON rb.recommended_by = u.id
            ORDER BY rb.created_at DESC
        `);
        
        res.status(200).json({
            message: 'Recommended books retrieved successfully',
            books: result.rows
        });
    } catch (err) {
        console.error('Error fetching recommended books:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteRecommendedBook = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await query('DELETE FROM recommended_books WHERE id = $1 RETURNING *', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Recommended book not found' });
        }
        
        res.status(200).json({
            message: 'Recommended book deleted successfully',
            book: result.rows[0]
        });
    } catch (err) {
        console.error('Error deleting recommended book:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// export const searchBooks = async (req, res) => {
//   const { q } = req.query;
//   if (!q) {
//     return res.status(400).json({ message: 'Search query is required' });
//   }

//   try {
//     // === 1. SEARCH OPENLIBRARY ===
//     const openLibRes = await axios.get(
//       `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6`
//     );
//     const openLibBooks = openLibRes.data.docs.slice(0, 6);

//     const apiBooks = await Promise.all(
//       openLibBooks.map(async (book) => {
//         const workKey = book.key; // Example: /works/OL123W

//         // Check if book was reviewed before (get enriched data)
//         const reviewed = await getReviewedBook(workKey, 'api');
//         if (reviewed) {
//           return {
//             source: 'api',
//             book_key: reviewed.book_id,
//             title: reviewed.title,
//             author: reviewed.author,
//             cover_img: reviewed.cover_img,
//             genre: reviewed.genre
//           };
//         }

//         // Fallback to fetching fresh Open Library details
//         try {
//           const workRes = await axios.get(`https://openlibrary.org${workKey}.json`);
//           const genre = workRes.data.subjects?.slice(0, 3) || [];

//           return {
//             source: 'api',
//             book_key: workKey,
//             title: book.title,
//             author: book.author_name?.[0] || 'Unknown',
//             cover_img: book.cover_i
//               ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
//               : null,
//             genre
//           };
//         } catch (err) {
//           return null;
//         }
//       })
//     );

//     // === 2. SEARCH CUSTOM BOOKS ===
//     const keyword = `%${q.toLowerCase()}%`;
//     const customResult = await query(
//       'SELECT * FROM custom_books WHERE LOWER(title) ILIKE $1 OR LOWER(author) ILIKE $1 LIMIT 5',
//       [keyword]
//     );

//     const customBooks = await Promise.all(
//       customResult.rows.map(async (book) => {
//         const reviewed = await getReviewedBook(book.book_key, 'custom');
//         return reviewed
//           ? {
//               source: 'custom',
//               book_key: reviewed.book_key,
//               title: reviewed.title,
//               author: reviewed.author,
//               cover_img: reviewed.cover_img,
//               genre: reviewed.genre
//             }
//           : {
//               source: 'custom',
//               book_key: book.book_key,
//               title: book.title,
//               author: book.author,
//               cover_img: book.cover_img,
//               genre: book.genre?.slice(0, 3) || []
//             };
//       })
//     );

//     // === 3. MERGE RESULTS & RETURN ===
//     const merged = [...apiBooks.filter(Boolean), ...customBooks];

//     res.status(200).json({ results: merged });
//   } catch (err) {
//     console.error('Book search failed:', err.message);
//     res.status(500).json({ message: 'Internal server error during search' });
//   }
// };