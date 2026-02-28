import type { Env } from '../types.js';
import { generatePostHtml, type PostData } from '../templates/post.js';
import { generateIndexHtml, type BlogData } from '../templates/index.js';

export type { PostData, BlogData };

export async function deployToCloudflarePages(
  blog: BlogData,
  posts: PostData[],
  env: Env
): Promise<{ url: string }> {
  const subdomain = blog.subdomain;
  const publishedPosts = posts.filter((p) => p.status === 'published');
  const currentSlugs = new Set(publishedPosts.map((p) => p.slug));

  // Generate and store index page
  const indexHtml = generateIndexHtml(posts, blog);
  await env.BLOG_CONTENT.put(`blog:${subdomain}:/index.html`, indexHtml);

  // Generate and store each published post
  for (const post of publishedPosts) {
    const postHtml = generatePostHtml(post, blog.title);
    await env.BLOG_CONTENT.put(`blog:${subdomain}:/${post.slug}/index.html`, postHtml);
  }

  // Delete KV entries for posts that no longer exist
  const existingKeys = await env.BLOG_CONTENT.list({ prefix: `blog:${subdomain}:/` });
  for (const key of existingKeys.keys) {
    const match = key.name.match(/^blog:[^:]+:\/([^/]+)\/index\.html$/);
    if (match && !currentSlugs.has(match[1])) {
      await env.BLOG_CONTENT.delete(key.name);
    }
  }

  // Store blog metadata
  await env.BLOG_CONTENT.put(`meta:${subdomain}`, JSON.stringify({
    title: blog.title,
    subdomain: blog.subdomain,
    updatedAt: new Date().toISOString(),
  }));

  return { url: `https://${subdomain}.postt.io` };
}

export async function addCustomDomain(
  subdomain: string,
  customDomain: string,
  env: Env
): Promise<void> {
  await env.BLOG_CONTENT.put(`domain:${customDomain}`, subdomain);
}
