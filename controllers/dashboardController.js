import { query } from '../db/db.js';
import axios from 'axios';

// Enhanced recommendation system with genre awareness
const recommendationSystem = {
  userHistory: new Map(),
  
  getHistory(userId) {
    return this.userHistory.get(userId) || {
      shownBooks: [],
      shownCount: new Map(),
      lastShown: new Date(0)
    };
  },
  
  updateHistory(userId, bookKeys) {
    const history = this.getHistory(userId);
    const now = new Date();
    
    // Reset history if it's been more than 1 hour
    if (now - history.lastShown > 3600000) {
      history.shownBooks = [];
      history.shownCount = new Map();
    }
    
    bookKeys.forEach(key => {
      history.shownBooks.push(key);
      history.shownCount.set(key, (history.shownCount.get(key) || 0) + 1);
    });
    
    // Keep only the last 20 shown books
    history.shownBooks = history.shownBooks.slice(-20);
    history.lastShown = now;
    this.userHistory.set(userId, history);
  },
  
  getExcludedKeys(userId) {
    const history = this.getHistory(userId);
    return history.shownBooks.slice(-10); // Exclude last 10 shown books
  }
};

const fetchBookDetailsFromOpenLibrary = async (bookId) => {
  try {
    const response = await axios.get(`https://openlibrary.org/works/${bookId}.json`);
    const data = response.data;
    
    let description = 'No description available';
    if (typeof data.description === 'string') {
      description = data.description;
    } else if (data.description?.value) {
      description = data.description.value;
    }

    return {
      description,
      first_publish_year: data.first_publish_year
    };
  } catch (error) {
    console.error("Error fetching book details from Open Library:", error.message);
    return {
      description: 'No description available',
      first_publish_year: null
    };
  }
};

const fetchBooksByGenreFromAPI = async (genres, limit = 5, excludeKeys = []) => {
  try {
    if (!genres || genres.length === 0) return [];
    
    const shuffledGenres = [...genres].sort(() => 0.5 - Math.random());
    const results = [];

    for (const genre of shuffledGenres) {
      if (results.length >= limit) break;
      
      const formattedGenre = genre.toLowerCase().replace(/\s+/g, '_');
      const url = `https://openlibrary.org/subjects/${formattedGenre}.json?limit=${limit * 3}`;
      
      const res = await axios.get(url);
      if (res.data?.works?.length > 0) {
        const filteredWorks = res.data.works.filter(
          work => !excludeKeys.includes(work.key.replace('/works/', ''))
        );
        
        const shuffledWorks = filteredWorks.sort(() => 0.5 - Math.random());
        
        for (const work of shuffledWorks.slice(0, limit - results.length)) {
          results.push({
            book_key: work.key.replace('/works/', ''),
            title: work.title,
            author: work.authors?.[0]?.name || 'Unknown Author',
            cover_img: work.cover_id 
              ? `https://covers.openlibrary.org/b/id/${work.cover_id}-M.jpg` 
              : null,
            genre: [genre],
            source: 'api',
            avg_rating: null,
            review_count: 0
          });
        }
      }
    }
    return results;
  } catch (err) {
    console.error("Error fetching books by genre from API:", err.message);
    return [];
  }
};

const fetchRandomBooks = async (limit = 5, excludeKeys = []) => {
  try {
    // First try random books from reviewed_books
    const reviewedBooksQuery = `
      SELECT 
        rb.*,
        AVG(r.rating) as avg_rating,
        COUNT(r.id) as review_count
      FROM reviewed_books rb
      LEFT JOIN reviews r ON rb.book_key = r.book_id
      ${excludeKeys.length > 0 ? 'WHERE rb.book_key NOT IN ($1)' : ''}
      GROUP BY rb.book_key
      ORDER BY random()
      LIMIT $${excludeKeys.length > 0 ? 2 : 1}
    `;
    
    const reviewedBooksResult = await query(
      reviewedBooksQuery,
      excludeKeys.length > 0 ? [excludeKeys] : []
    );
    
    let results = reviewedBooksResult.rows.map(book => ({
      ...book,
      source: 'reviewed'
    }));
    
    // If still need more, try custom_books
    if (results.length < limit) {
      const customBooksQuery = `
        SELECT 
          cb.*,
          AVG(r.rating) as avg_rating,
          COUNT(r.id) as review_count
        FROM custom_books cb
        LEFT JOIN reviews r ON cb.book_key = r.book_id
        ${excludeKeys.length > 0 ? 'WHERE cb.book_key NOT IN ($1)' : ''}
        GROUP BY cb.id
        ORDER BY random()
        LIMIT $${excludeKeys.length > 0 ? 2 : 1}
      `;
      
      const customBooksResult = await query(
        customBooksQuery,
        excludeKeys.length > 0 ? [excludeKeys] : []
      );
      
      results = [
        ...results,
        ...customBooksResult.rows.map(book => ({
          ...book,
          source: 'custom'
        }))
      ];
    }
    
    // If still need more, fetch random from Open Library
    if (results.length < limit) {
      const randomSubjects = ['fiction', 'science', 'history', 'romance', 'fantasy'];
      const apiBooks = await fetchBooksByGenreFromAPI(
        randomSubjects,
        limit - results.length,
        excludeKeys
      );
      results = [...results, ...apiBooks];
    }
    
    return results.slice(0, limit);
  } catch (err) {
    console.error("Error fetching random books:", err.message);
    return [];
  }
};

const processBookData = (book) => ({
  ...book,
  genres: book.genre || [],
  description: book.description || 'No description available',
  avg_rating: book.avg_rating ? Number(parseFloat(book.avg_rating).toFixed(1)) : null,
  review_count: book.review_count ? parseInt(book.review_count) : 0,
  is_new: book.source === 'api' && (!book.review_count || book.review_count === 0)
});

// Metrics endpoint
export const getDashboardMetrics = async (req, res) => {
  const userId = req.user.id;
  
  try {
    const metricsQuery = `
      SELECT 
        COUNT(*) as total_reviews,
        AVG(NULLIF(rating, 0)) as avg_rating
      FROM reviews
      WHERE user_id = $1
    `;
    const metricsResult = await query(metricsQuery, [userId]);
    const metrics = metricsResult.rows[0];
    
    res.status(200).json({
      total_reviews: parseInt(metrics.total_reviews) || 0,
      avg_rating: metrics.avg_rating ? parseFloat(metrics.avg_rating).toFixed(1) : '0.0'
    });
    
  } catch (err) {
    console.error("Metrics error:", {
      message: err.message,
      userId,
      stack: err.stack
    });
    res.status(500).json({ 
      message: "Internal server error",
      error: err.message 
    });
  }
};

// Books endpoint
export const getDashboardBooks = async (req, res) => {
  const userId = req.user.id;
  const limit = 5;
  const minNewBooks = 4;
  const refreshKey = req.query.r;
  
  try {
    // Get user's favorite genres
    const userQuery = `
      SELECT favorite_genres 
      FROM users 
      WHERE id = $1
    `;
    const userResult = await query(userQuery, [userId]);
    const favoriteGenres = userResult.rows[0]?.favorite_genres || [];
    
    // Get excluded book keys
    const excludeKeys = recommendationSystem.getExcludedKeys(userId);
    
    // Get recommended books
    let recommendedBooks = [];
    let usedFallback = false;
    
    if (favoriteGenres.length > 0) {
      // Try reviewed books matching genres
      const reviewedBooksQuery = `
        SELECT 
          rb.*,
          AVG(r.rating) as avg_rating,
          COUNT(r.id) as review_count
        FROM reviewed_books rb
        LEFT JOIN reviews r ON rb.book_key = r.book_id
        WHERE rb.genre && $1
          ${excludeKeys.length > 0 ? 'AND rb.book_key NOT IN ($2)' : ''}
        GROUP BY rb.book_key
        ORDER BY random()
        LIMIT ${limit * 2}
      `;
      
      const reviewedBooksResult = await query(
        reviewedBooksQuery,
        excludeKeys.length > 0 ? [favoriteGenres, excludeKeys] : [favoriteGenres]
      );
      
      // Try custom books matching genres
      const customBooksQuery = `
        SELECT 
          cb.*,
          AVG(r.rating) as avg_rating,
          COUNT(r.id) as review_count
        FROM custom_books cb
        LEFT JOIN reviews r ON cb.book_key = r.book_id
        WHERE cb.genre && $1
          AND NOT EXISTS (
            SELECT 1 FROM reviewed_books rb 
            WHERE rb.book_key = cb.book_key
          )
          ${excludeKeys.length > 0 ? 'AND cb.book_key NOT IN ($2)' : ''}
        GROUP BY cb.id
        ORDER BY random()
        LIMIT ${limit * 2}
      `;
      
      const customBooksResult = await query(
        customBooksQuery,
        excludeKeys.length > 0 ? [favoriteGenres, excludeKeys] : [favoriteGenres]
      );
      
      const genreMatchedBooks = [
        ...reviewedBooksResult.rows,
        ...customBooksResult.rows
      ]
        .sort(() => 0.5 - Math.random())
        .slice(0, limit)
        .map(processBookData);
      
      recommendedBooks = genreMatchedBooks;
      
      if (genreMatchedBooks.length < minNewBooks) {
        usedFallback = true;
      }
    }
    
    if (recommendedBooks.length < limit) {
      const needed = limit - recommendedBooks.length;
      let fallbackBooks = [];
      
      if (favoriteGenres.length > 0) {
        fallbackBooks = await fetchBooksByGenreFromAPI(
          favoriteGenres,
          needed,
          [...excludeKeys, ...recommendedBooks.map(b => b.book_key)]
        );
      }
      
      if (fallbackBooks.length < needed) {
        const randomBooks = await fetchRandomBooks(
          needed - fallbackBooks.length,
          [...excludeKeys, ...recommendedBooks.map(b => b.book_key), ...fallbackBooks.map(b => b.book_key)]
        );
        fallbackBooks = [...fallbackBooks, ...randomBooks];
        usedFallback = true;
      }
      
      recommendedBooks = [
        ...recommendedBooks,
        ...fallbackBooks.map(processBookData)
      ].slice(0, limit);
    }
    
    recommendedBooks = recommendedBooks.slice(0, limit);
    
    // Fetch additional details for featured book if from API
    if (recommendedBooks.length > 0 && recommendedBooks[0].source === 'api') {
      const details = await fetchBookDetailsFromOpenLibrary(recommendedBooks[0].book_key);
      recommendedBooks[0].description = details.description;
    }
    
    // Update recommendation history
    recommendationSystem.updateHistory(
      userId,
      recommendedBooks.map(b => b.book_key)
    );
    
    // Split into featured and others
    const featuredBook = recommendedBooks.length > 0 ? recommendedBooks[0] : null;
    const otherBooks = recommendedBooks.length > 1 ? recommendedBooks.slice(1) : [];
    
    res.status(200).json({
      featured_book: featuredBook,
      recommended_books: otherBooks,
      used_fallback: usedFallback
    });
    
  } catch (err) {
    console.error("Books error:", {
      message: err.message,
      userId,
      stack: err.stack
    });
    res.status(500).json({ 
      message: "Internal server error",
      error: err.message 
    });
  }
};

// Keep the original endpoint for backward compatibility
export const getDashboardData = async (req, res) => {
  try {
    // Get metrics
    const metricsRes = await getDashboardMetrics(req, {
      json: (data) => data
    });
    
    // Get books
    const booksRes = await getDashboardBooks(req, {
      json: (data) => data
    });
    
    // Combine responses
    res.status(200).json({
      metrics: {
        total_reviews: metricsRes.total_reviews,
        avg_rating: metricsRes.avg_rating
      },
      featured_book: booksRes.featured_book,
      recommended_books: booksRes.recommended_books,
      favorite_genres: req.user.favorite_genres || [],
      used_fallback: booksRes.used_fallback
    });
    
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ 
      message: "Internal server error",
      error: err.message 
    });
  }
};
