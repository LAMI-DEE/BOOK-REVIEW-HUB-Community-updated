CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  bio TEXT,
  profile_img TEXT,
  favorite_genres TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;  
UPDATE users SET is_admin = TRUE WHERE email = 'admin@mail.com';//for updating an email from users to admin

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  book_id TEXT,
  book_source TEXT CHECK (book_source IN ('api', 'custom')),
  rating NUMERIC(2,1) CHECK (rating BETWEEN 0 AND 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS custom_books (
  id SERIAL PRIMARY KEY,
  book_key TEXT UNIQUE NOT NULL, -- this is the key to match with review.book_id
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  genre TEXT[],
  description TEXT,
  cover_img TEXT, -- URL or file path
  created_by INTEGER REFERENCES users(id), -- Admin/user who added the book
  created_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS reviewed_books (
  book_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  cover_img TEXT,
  genre TEXT[],
  source TEXT CHECK (source IN ('api', 'custom')) NOT NULL
);
//add description COLUMN

CREATE TABLE followers (
  id SERIAL PRIMARY KEY,
  follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id)
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  review_id INT REFERENCES reviews(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE comment_likes (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  comment_id INT REFERENCES comments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, comment_id)
);
CREATE TABLE review_likes (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  review_id INT REFERENCES reviews(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, review_id)
);
CREATE TABLE review_unlikes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  review_id INTEGER REFERENCES reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, review_id)
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'follow', 'like_review', 'comment'
    message TEXT NOT NULL,
    target_type TEXT,   -- optional: 'review', 'comment', etc.
    target_id INTEGER,  -- optional: ID of the review/comment
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recommended_books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  recommended_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW());

-- Add an index for better query performance
CREATE INDEX idx_recommended_by ON recommended_books(recommended_by);












//Test
-- 1st review: Open Library API book
INSERT INTO reviews (user_id, book_id, book_source, rating, review_text)
VALUES (
  1,
  'OL123M',  -- Open Library ID
  'api',
  4.5,
  'Absolutely loved the character development in this one!'
);

-- 2nd review: Custom book from your own DB
-- Assume there's a book with id = 3 in your `books` table
INSERT INTO reviews (user_id, book_id, book_source, rating, review_text)
VALUES (
  1,
  3,
  'custom',
  3.0,
  'A decent story, but it dragged in the middle chapters.'
);
INSERT INTO users (username, email, password, is_admin)
VALUES (
  'adminuser',
  'admintheone@email.com',
  '$2b$10$m5vEscBZc30C5XKZ4Zt.SOkthA22iDZHbjiBsu1iIssY5Do3EoXEi', -- hashed password
  TRUE
);








//
DROP TABLE IF EXISTS reviews;



// neon db p0ostgresql::::

-- Users table with admin flag
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  bio TEXT,
  profile_img TEXT,
  favorite_genres TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE
);

-- Reviews table with book source constraint
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL,
  book_source TEXT NOT NULL CHECK (book_source IN ('api', 'custom')),
  rating NUMERIC(2,1) CHECK (rating BETWEEN 0 AND 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- Custom books added by users/admins
CREATE TABLE IF NOT EXISTS custom_books (
  id SERIAL PRIMARY KEY,
  book_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  genre TEXT[],
  description TEXT,
  cover_img TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reviewed books (aggregate of API + custom books)
CREATE TABLE IF NOT EXISTS reviewed_books (
  book_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  cover_img TEXT,
  genre TEXT[],
  source TEXT NOT NULL CHECK (source IN ('api', 'custom')),
  description TEXT
);

-- Follow relationships
CREATE TABLE IF NOT EXISTS followers (
  id SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id)
);

-- Comments on reviews
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Comment likes junction table
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, comment_id)
);

-- Review likes junction table
CREATE TABLE IF NOT EXISTS review_likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, review_id)
);

-- Review unlikes (dislikes)
CREATE TABLE IF NOT EXISTS review_unlikes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, review_id)
);

-- Notifications system
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recommended books
CREATE TABLE IF NOT EXISTS recommended_books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  recommended_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recommended_by ON recommended_books(recommended_by);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_receiver ON notifications(receiver_id);

-- -- Set initial admin (replace email with your actual admin email)
-- INSERT INTO users (username, email, password, is_admin)
-- VALUES ('admin', 'admin@mail.com', '$2a$10$xJw...hashed_password...', TRUE)
-- ON CONFLICT (email) DO UPDATE SET is_admin = TRUE;