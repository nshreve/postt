import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Variables } from './types.js';
import { verifyToken } from './lib/jwt.js';
import { auth } from './routes/auth.js';
import { blogs } from './routes/blogs.js';
import { authPageHtml } from './templates/auth.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS
app.use('*', cors());

// Root route - handles magic link callback
app.get('/', (c) => {
  return c.html(authPageHtml);
});

// Auth routes (no auth required)
app.route('/auth', auth);

// Auth middleware for protected routes
app.use('/blogs/*', async (c, next) => {
  // Skip auth for subdomain check
  if (c.req.path === '/blogs/check-subdomain') {
    return next();
  }

  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env);

  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('user', {
    id: payload.sub,
    username: payload.username,
    email: payload.email,
  });

  return next();
});

// Blog routes
app.route('/blogs', blogs);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
