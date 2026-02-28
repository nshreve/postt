-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blogs table
CREATE TABLE blogs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  custom_domain TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posts table (metadata only - content stored locally)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blog_id, slug)
);

-- Indexes
CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_blogs_user_id ON blogs(user_id);
CREATE INDEX idx_blogs_subdomain ON blogs(subdomain);
CREATE INDEX idx_posts_blog_id ON posts(blog_id);
CREATE INDEX idx_posts_slug ON posts(blog_id, slug);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_blogs_updated_at
  BEFORE UPDATE ON blogs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policies (service role bypasses these)
-- Users can read their own data
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth.uid()::text = id::text);

-- Users can read their own blogs
CREATE POLICY blogs_select_own ON blogs
  FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth.uid()::text = id::text));

-- Users can insert/update/delete their own blogs
CREATE POLICY blogs_insert_own ON blogs
  FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth.uid()::text = id::text));

CREATE POLICY blogs_update_own ON blogs
  FOR UPDATE
  USING (user_id IN (SELECT id FROM users WHERE auth.uid()::text = id::text));

CREATE POLICY blogs_delete_own ON blogs
  FOR DELETE
  USING (user_id IN (SELECT id FROM users WHERE auth.uid()::text = id::text));

-- Posts policies
CREATE POLICY posts_select_own ON posts
  FOR SELECT
  USING (blog_id IN (
    SELECT id FROM blogs WHERE user_id IN (
      SELECT id FROM users WHERE auth.uid()::text = id::text
    )
  ));

CREATE POLICY posts_insert_own ON posts
  FOR INSERT
  WITH CHECK (blog_id IN (
    SELECT id FROM blogs WHERE user_id IN (
      SELECT id FROM users WHERE auth.uid()::text = id::text
    )
  ));

CREATE POLICY posts_update_own ON posts
  FOR UPDATE
  USING (blog_id IN (
    SELECT id FROM blogs WHERE user_id IN (
      SELECT id FROM users WHERE auth.uid()::text = id::text
    )
  ));

CREATE POLICY posts_delete_own ON posts
  FOR DELETE
  USING (blog_id IN (
    SELECT id FROM blogs WHERE user_id IN (
      SELECT id FROM users WHERE auth.uid()::text = id::text
    )
  ));
