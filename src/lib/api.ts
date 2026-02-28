import { getAuthToken, syncBlogConfig, API_URL } from './config.js';
import { refreshTokenIfNeeded } from './auth.js';
import { savePost, getAllPosts } from './posts.js';
import type { Post } from '../types/index.js';

interface CreateBlogResponse {
  id: string;
  title: string;
  subdomain: string;
  url: string;
  createdAt: string;
}

interface DeployResponse {
  success: boolean;
  url: string;
  deployedAt: string;
}

interface BlogInfo {
  id: string;
  title: string;
  subdomain: string;
  url: string;
  customDomain?: string;
  createdAt: string;
  updatedAt: string;
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  await refreshTokenIfNeeded();
  const token = getAuthToken();

  if (!token) {
    throw new Error('Not authenticated. Run `postt login` first.');
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function checkSubdomainAvailability(subdomain: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/blogs/check-subdomain?subdomain=${subdomain}`);
  const data = await response.json() as { available: boolean };
  return data.available;
}

export async function createBlog(title: string, subdomain: string): Promise<CreateBlogResponse> {
  const response = await authFetch('/blogs', {
    method: 'POST',
    body: JSON.stringify({ title, subdomain }),
  });

  if (!response.ok) {
    const errorData = await response.json() as { error?: string; message?: string };
    throw new Error(errorData.message || errorData.error || 'Failed to create blog');
  }

  return response.json() as Promise<CreateBlogResponse>;
}

export async function getBlog(blogId: string): Promise<BlogInfo> {
  const response = await authFetch(`/blogs/${blogId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch blog info');
  }

  return response.json() as Promise<BlogInfo>;
}

export async function deployBlog(
  blogId: string,
  posts: Array<{
    slug: string;
    title: string;
    content: string;
    date: string;
    status: 'draft' | 'published';
  }>
): Promise<DeployResponse> {
  const response = await authFetch(`/blogs/${blogId}/deploy`, {
    method: 'POST',
    body: JSON.stringify({ posts }),
  });

  if (!response.ok) {
    const error = await response.json() as { message: string };
    throw new Error(error.message || 'Failed to deploy blog');
  }

  return response.json() as Promise<DeployResponse>;
}

export async function updateBlog(
  blogId: string,
  updates: { title?: string; subdomain?: string; customDomain?: string }
): Promise<BlogInfo> {
  const response = await authFetch(`/blogs/${blogId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json() as { message: string };
    throw new Error(error.message || 'Failed to update blog');
  }

  return response.json() as Promise<BlogInfo>;
}

export async function deleteBlog(blogId: string): Promise<void> {
  const response = await authFetch(`/blogs/${blogId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json() as { message?: string; error?: string };
    throw new Error(error.message || error.error || 'Failed to delete blog');
  }
}

export async function publishPostAndDeploy(post: Post, content: string): Promise<string | null> {
  post.content = content;
  post.status = 'published';
  post.publishedAt = new Date().toISOString();
  await savePost(post);

  const config = await syncBlogConfig();
  if (!config) return null;

  const allPosts = await getAllPosts();
  const publishedPosts = allPosts
    .filter((p) => p.status === 'published')
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      content: p.content,
      date: p.date,
      status: p.status,
    }));

  await deployBlog(config.id, publishedPosts);
  return config.url;
}
