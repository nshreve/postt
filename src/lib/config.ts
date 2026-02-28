import fs from 'fs/promises';
import path from 'path';
import Conf from 'conf';
import type { BlogConfig, AuthToken } from '../types/index.js';

export const API_URL = process.env.BLOG_API_URL || 'https://postt-api.orangestudio.workers.dev';

const POSTS_DIR = 'posts';
const BLOG_ID_FILE = '.postt';

// Global config stored in user's home directory
const globalConfig = new Conf<{
  auth?: AuthToken;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  blogs?: Record<string, BlogConfig>; // keyed by directory path
}>({
  projectName: 'postt',
});

export function getAuthToken(): AuthToken | undefined {
  return globalConfig.get('auth');
}

export function setAuthToken(token: AuthToken): void {
  globalConfig.set('auth', token);
}

export function clearAuthToken(): void {
  globalConfig.delete('auth');
}

export function getUser() {
  return globalConfig.get('user');
}

export function setUser(user: { id: string; username: string; email: string }) {
  globalConfig.set('user', user);
}

export function clearUser(): void {
  globalConfig.delete('user');
}

export function isAuthenticated(): boolean {
  const token = getAuthToken();
  if (!token) return false;
  return token.expiresAt > Date.now();
}

// Blog config stored in global config, keyed by directory path
// Also stores blog ID in .postt file for cross-machine sync
export async function getBlogConfig(dir = process.cwd()): Promise<BlogConfig | null> {
  // First check global config
  const blogs = globalConfig.get('blogs') || {};
  if (blogs[dir]) {
    return blogs[dir];
  }

  // Check for .postt file (cloned repo scenario)
  const idFilePath = path.join(dir, BLOG_ID_FILE);
  try {
    const blogId = (await fs.readFile(idFilePath, 'utf-8')).trim();
    if (blogId) {
      // We have a blog ID but no local config - they need to sync
      // Return partial config so blogExists() returns true
      return { id: blogId, title: '', subdomain: '', url: '', createdAt: '' };
    }
  } catch {
    // No .postt file
  }

  return null;
}

export async function saveBlogConfig(config: BlogConfig, dir = process.cwd()): Promise<void> {
  // Save to global config
  const blogs = globalConfig.get('blogs') || {};
  blogs[dir] = config;
  globalConfig.set('blogs', blogs);

  // Also write blog ID to .postt file for cross-machine sync
  const idFilePath = path.join(dir, BLOG_ID_FILE);
  await fs.writeFile(idFilePath, config.id);
}

export function needsSync(config: BlogConfig | null): boolean {
  // If we have a blog ID but no title, it's a partial config from .postt file
  return config !== null && !!config.id && !config.title;
}

export async function syncBlogConfig(dir = process.cwd()): Promise<BlogConfig | null> {
  const config = await getBlogConfig(dir);
  if (!config || !needsSync(config)) {
    return config;
  }

  // Need to sync from API - import dynamically to avoid circular deps
  const { getBlog } = await import('./api.js');

  try {
    const blogInfo = await getBlog(config.id);
    const fullConfig: BlogConfig = {
      id: blogInfo.id,
      title: blogInfo.title,
      subdomain: blogInfo.subdomain,
      url: blogInfo.url,
      createdAt: blogInfo.createdAt,
    };
    await saveBlogConfig(fullConfig, dir);
    return fullConfig;
  } catch {
    // API call failed (not authenticated or network issue)
    return config;
  }
}

export async function initBlogDirectory(dir = process.cwd()): Promise<void> {
  const postsDir = path.join(dir, POSTS_DIR);
  const publicDir = path.join(dir, 'public', 'images');

  await fs.mkdir(postsDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });
}

export async function blogExists(dir = process.cwd()): Promise<boolean> {
  const config = await getBlogConfig(dir);
  return config !== null;
}

export function getPostsDirectory(dir = process.cwd()): string {
  return path.join(dir, POSTS_DIR);
}
