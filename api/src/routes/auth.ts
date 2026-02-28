import { Hono } from 'hono';
import type { Env } from '../types.js';
import { createAccessToken, createRefreshToken, verifyToken, ACCESS_TOKEN_EXPIRY } from '../lib/jwt.js';
import { createSupabaseClient } from '../lib/supabase.js';

const auth = new Hono<{ Bindings: Env }>();

// KV key prefixes
const PENDING_PREFIX = 'pending:';
const COMPLETED_PREFIX = 'completed:';
const EMAIL_PREFIX = 'email:';
const RATE_LIMIT_PREFIX = 'ratelimit:magic-link:';

interface PendingSession {
  email: string;
  createdAt: number;
}

interface CompletedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string };
}

// Send magic link
auth.post('/magic-link', async (c) => {
  // Rate limit: 5 requests per IP per hour
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `${RATE_LIMIT_PREFIX}${ip}`;
  const countStr = await c.env.SESSIONS.get(rateLimitKey);
  const count = countStr ? parseInt(countStr) : 0;

  if (count >= 5) {
    return c.json({ error: 'Too many requests. Please try again later.' }, 429);
  }

  const { email, sessionId } = await c.req.json<{ email: string; sessionId: string }>();

  if (!email || !sessionId) {
    return c.json({ error: 'Missing email or sessionId' }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Invalid email format' }, 400);
  }

  const normalizedEmail = email.toLowerCase();

  // Increment rate limit counter (1 hour window)
  await c.env.SESSIONS.put(rateLimitKey, String(count + 1), { expirationTtl: 3600 });

  // Store pending session with 10 minute TTL
  const pendingSession: PendingSession = { email: normalizedEmail, createdAt: Date.now() };
  await c.env.SESSIONS.put(
    `${PENDING_PREFIX}${sessionId}`,
    JSON.stringify(pendingSession),
    { expirationTtl: 600 }
  );

  // Store email -> sessionId mapping for lookup
  await c.env.SESSIONS.put(
    `${EMAIL_PREFIX}${normalizedEmail}`,
    sessionId,
    { expirationTtl: 600 }
  );

  const response = await fetch(`${c.env.SUPABASE_URL}/auth/v1/magiclink`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': c.env.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email,
      options: { emailRedirectTo: c.env.APP_URL },
    }),
  });

  if (!response.ok) {
    console.error('Failed to send magic link:', await response.text());
    return c.json({ error: 'Failed to send magic link' }, 500);
  }

  return c.json({ success: true, message: 'Magic link sent to your email' });
});

// Complete authentication via magic link (called by the auth page after Supabase redirect)
auth.post('/complete-magic', async (c) => {
  const { supabaseAccessToken, supabaseRefreshToken } = await c.req.json<{
    supabaseAccessToken: string;
    supabaseRefreshToken: string;
  }>();

  try {
    const userResponse = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'apikey': c.env.SUPABASE_ANON_KEY,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }

    const supabaseUser = await userResponse.json() as { id: string; email: string };
    const normalizedEmail = supabaseUser.email.toLowerCase();

    const sessionId = await c.env.SESSIONS.get(`${EMAIL_PREFIX}${normalizedEmail}`);
    if (!sessionId) {
      return c.json({ error: 'No pending login session found for this email' }, 400);
    }

    const pendingData = await c.env.SESSIONS.get(`${PENDING_PREFIX}${sessionId}`);
    if (!pendingData) {
      return c.json({ error: 'Session expired' }, 400);
    }

    const supabase = createSupabaseClient(c.env);
    const user = await supabase.upsertUserByEmail({
      email: supabaseUser.email,
      plan: 'free',
    });

    const accessToken = await createAccessToken(user.id, '', user.email, c.env);
    const refreshToken = await createRefreshToken(user.id, c.env);

    const completedSession: CompletedSession = {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      user: { id: user.id, email: user.email },
    };

    await c.env.SESSIONS.put(
      `${COMPLETED_PREFIX}${sessionId}`,
      JSON.stringify(completedSession),
      { expirationTtl: 300 }
    );

    await c.env.SESSIONS.delete(`${PENDING_PREFIX}${sessionId}`);
    await c.env.SESSIONS.delete(`${EMAIL_PREFIX}${normalizedEmail}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Complete magic auth error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// Poll for auth completion (CLI calls this)
auth.get('/check/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  const completedData = await c.env.SESSIONS.get(`${COMPLETED_PREFIX}${sessionId}`);
  if (completedData) {
    const completed: CompletedSession = JSON.parse(completedData);
    await c.env.SESSIONS.delete(`${COMPLETED_PREFIX}${sessionId}`);
    return c.json({ status: 'complete', ...completed });
  }

  const pendingData = await c.env.SESSIONS.get(`${PENDING_PREFIX}${sessionId}`);
  if (pendingData) {
    return c.json({ status: 'pending' });
  }

  return c.json({ status: 'not_found' });
});

// Refresh access token
auth.post('/refresh', async (c) => {
  const { refreshToken } = await c.req.json<{ refreshToken: string }>();

  if (!refreshToken) {
    return c.json({ error: 'Missing refresh token' }, 400);
  }

  const payload = await verifyToken(refreshToken, c.env);
  if (!payload) {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }

  const accessToken = await createAccessToken(
    payload.sub,
    payload.username || '',
    payload.email || '',
    c.env
  );
  const newRefreshToken = await createRefreshToken(payload.sub, c.env);

  return c.json({
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
});

export { auth };
