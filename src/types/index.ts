export interface BlogConfig {
  id: string;
  title: string;
  subdomain: string;
  url: string;
  createdAt: string;
}

export interface PostFrontmatter {
  title: string;
  date: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  slug?: string;
}

export interface Post {
  slug: string;
  title: string;
  date: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  content: string;
  filepath: string;
  modifiedAt?: Date;
}

export interface User {
  id: string;
  username: string;
  email: string;
  githubId: string;
  plan: 'free' | 'pro';
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
