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

  console.log('[Deploy] Deploying blog to KV:', subdomain);

  // Generate and store index page
  const indexHtml = generateIndexHtml(posts, blog);
  await env.BLOG_CONTENT.put(`blog:${subdomain}:/index.html`, indexHtml);
  console.log('[Deploy] Saved index.html');

  // Generate and store each post
  for (const post of posts.filter((p) => p.status === 'published')) {
    const postHtml = generatePostHtml(post, blog.title);
    await env.BLOG_CONTENT.put(`blog:${subdomain}:/${post.slug}/index.html`, postHtml);
    console.log('[Deploy] Saved post:', post.slug);
  }

  // Store blog metadata for lookups
  await env.BLOG_CONTENT.put(`meta:${subdomain}`, JSON.stringify({
    title: blog.title,
    subdomain: blog.subdomain,
    updatedAt: new Date().toISOString(),
  }));

  const url = `https://${subdomain}.postt.io`;
  console.log('[Deploy] Done! URL:', url);

  return { url };
}

// For future custom domain support
export async function addCustomDomain(
  subdomain: string,
  customDomain: string,
  env: Env
): Promise<void> {
  // Store mapping: domain:example.com -> subdomain
  await env.BLOG_CONTENT.put(`domain:${customDomain}`, subdomain);
  console.log('[Deploy] Added custom domain mapping:', customDomain, '->', subdomain);
}
