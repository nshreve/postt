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

  // Validate subdomain format
  if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) {
    return c.json({ available: false, reason: 'Invalid subdomain format' });
  }

  // Check reserved subdomains
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
    console.log('[blogs] POST / - user:', user);
    if (!user) {
      return c.json({ error: 'Unauthorized', message: 'No user in context' }, 401);
    }

    const body = await c.req.json<{ title: string; subdomain: string }>();
    console.log('[blogs] POST / - body:', body);
    const { title, subdomain } = body;

    if (!title || !subdomain) {
      return c.json({ error: 'Missing title or subdomain', message: `title=${title}, subdomain=${subdomain}` }, 400);
    }

    // Validate subdomain
    if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) {
      return c.json({ error: 'Invalid subdomain format', message: subdomain }, 400);
    }

    const supabase = createSupabaseClient(c.env);

    // Check availability
    console.log('[blogs] Checking subdomain availability:', subdomain);
    const existing = await supabase.getBlogBySubdomain(subdomain);
    if (existing) {
      return c.json({ error: 'Subdomain already taken', message: subdomain }, 400);
    }

    // Create blog
    console.log('[blogs] Creating blog for user:', user.id);
    const blog = await supabase.createBlog({
      user_id: user.id,
      title,
      subdomain,
      custom_domain: null,
    });
    console.log('[blogs] Blog created:', blog);

    const url = `https://${subdomain}.postt.io`;

    return c.json({
      id: blog.id,
      title: blog.title,
      subdomain: blog.subdomain,
      url,
      createdAt: blog.created_at,
    });
  } catch (err) {
    console.error('[blogs] Error creating blog:', err);
    return c.json({ error: 'Failed to create blog', message: String(err) }, 500);
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

  // Save post metadata to database
  for (const post of posts) {
    await supabase.upsertPost({
      blog_id: blogId,
      slug: post.slug,
      title: post.title,
      status: post.status,
      published_at: post.status === 'published' ? new Date().toISOString() : null,
    });
  }

  // Deploy to Cloudflare Pages
  const result = await deployToCloudflarePages(
    { title: blog.title, subdomain: blog.subdomain },
    posts,
    c.env
  );

  // Update blog timestamp
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
