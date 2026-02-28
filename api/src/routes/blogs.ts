import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createSupabaseClient } from '../lib/supabase.js';
import { deployToCloudflarePages } from '../lib/deploy.js';

const blogs = new Hono<{ Bindings: Env; Variables: Variables }>();

// Check subdomain availability
blogs.get('/check-subdomain', async (c) => {
  const subdomain = c.req.query('subdomain');

  if (!subdomain) {
    return c.json({ error: 'Missing subdomain' }, 400);
  }

  if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) {
    return c.json({ available: false, reason: 'Invalid subdomain format' });
  }

  const reserved = ['www', 'api', 'app', 'admin', 'blog', 'help', 'support', 'mail'];
  if (reserved.includes(subdomain)) {
    return c.json({ available: false, reason: 'Reserved subdomain' });
  }

  const supabase = createSupabaseClient(c.env);
  const existing = await supabase.getBlogBySubdomain(subdomain);

  return c.json({ available: !existing });
});

// Create new blog
blogs.post('/', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { title, subdomain } = await c.req.json<{ title: string; subdomain: string }>();

    if (!title || !subdomain) {
      return c.json({ error: 'Missing title or subdomain' }, 400);
    }

    if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) {
      return c.json({ error: 'Invalid subdomain format' }, 400);
    }

    const supabase = createSupabaseClient(c.env);

    const existing = await supabase.getBlogBySubdomain(subdomain);
    if (existing) {
      return c.json({ error: 'Subdomain already taken' }, 400);
    }

    const blog = await supabase.createBlog({
      user_id: user.id,
      title,
      subdomain,
      custom_domain: null,
    });

    const url = `https://${subdomain}.postt.io`;

    return c.json({
      id: blog.id,
      title: blog.title,
      subdomain: blog.subdomain,
      url,
      createdAt: blog.created_at,
    });
  } catch (err) {
    console.error('Error creating blog:', err);
    return c.json({ error: 'Failed to create blog' }, 500);
  }
});

// Get blog by ID
blogs.get('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const blogId = c.req.param('id');
  const supabase = createSupabaseClient(c.env);

  const blog = await supabase.getBlogById(blogId);
  if (!blog) {
    return c.json({ error: 'Blog not found' }, 404);
  }

  if (blog.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const url = blog.custom_domain
    ? `https://${blog.custom_domain}`
    : `https://${blog.subdomain}.postt.io`;

  return c.json({
    id: blog.id,
    title: blog.title,
    subdomain: blog.subdomain,
    customDomain: blog.custom_domain,
    url,
    createdAt: blog.created_at,
    updatedAt: blog.updated_at,
  });
});

// Update blog
blogs.patch('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const blogId = c.req.param('id');
  const updates = await c.req.json<{ title?: string; customDomain?: string }>();

  const supabase = createSupabaseClient(c.env);

  const blog = await supabase.getBlogById(blogId);
  if (!blog) {
    return c.json({ error: 'Blog not found' }, 404);
  }

  if (blog.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const updatedBlog = await supabase.updateBlog(blogId, {
    title: updates.title,
    custom_domain: updates.customDomain,
  });

  const url = updatedBlog.custom_domain
    ? `https://${updatedBlog.custom_domain}`
    : `https://${updatedBlog.subdomain}.postt.io`;

  return c.json({
    id: updatedBlog.id,
    title: updatedBlog.title,
    subdomain: updatedBlog.subdomain,
    customDomain: updatedBlog.custom_domain,
    url,
    createdAt: updatedBlog.created_at,
    updatedAt: updatedBlog.updated_at,
  });
});

// Deploy blog
blogs.post('/:id/deploy', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const blogId = c.req.param('id');
  const { posts } = await c.req.json<{
    posts: Array<{
      slug: string;
      title: string;
      content: string;
      date: string;
      status: 'draft' | 'published';
    }>;
  }>();

  const supabase = createSupabaseClient(c.env);

  const blog = await supabase.getBlogById(blogId);
  if (!blog) {
    return c.json({ error: 'Blog not found' }, 404);
  }

  if (blog.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Upsert incoming posts to database
  for (const post of posts) {
    await supabase.upsertPost({
      blog_id: blogId,
      slug: post.slug,
      title: post.title,
      status: post.status,
      published_at: post.status === 'published' ? new Date().toISOString() : null,
    });
  }

  // Delete posts from database that are no longer in the published set
  const existingPosts = await supabase.getPostsByBlogId(blogId);
  const incomingSlugSet = new Set(posts.map((p) => p.slug));
  for (const existing of existingPosts) {
    if (!incomingSlugSet.has(existing.slug)) {
      await supabase.deletePost(blogId, existing.slug);
    }
  }

  // Deploy to KV (also cleans up removed posts)
  await deployToCloudflarePages(
    { title: blog.title, subdomain: blog.subdomain },
    posts,
    c.env
  );

  await supabase.updateBlog(blogId, {});

  const url = blog.custom_domain
    ? `https://${blog.custom_domain}`
    : `https://${blog.subdomain}.postt.io`;

  return c.json({
    success: true,
    url,
    deployedAt: new Date().toISOString(),
  });
});

export { blogs };
