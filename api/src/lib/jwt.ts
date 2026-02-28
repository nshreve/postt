import type { Env } from '../types.js';

interface JWTPayload {
  sub: string;
  username: string;
  email: string;
  exp: number;
  iat: number;
}

const ALGORITHM = 'HS256';
const ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hour
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 30; // 30 days

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(data: string): string {
  const padded = data + '==='.slice(0, (4 - (data.length % 4)) % 4);
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

async function createHmac(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifyHmac(data: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await createHmac(data, secret);
  return signature === expectedSignature;
}

export async function createAccessToken(
  userId: string,
  username: string,
  email: string,
  env: Env
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: ALGORITHM, typ: 'JWT' };
  const payload: JWTPayload = {
    sub: userId,
    username,
    email,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = await createHmac(`${headerB64}.${payloadB64}`, env.JWT_SECRET);

  return `${headerB64}.${payloadB64}.${signature}`;
}

export async function createRefreshToken(userId: string, env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: ALGORITHM, typ: 'JWT' };
  const payload = {
    sub: userId,
    type: 'refresh',
    iat: now,
    exp: now + REFRESH_TOKEN_EXPIRY,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = await createHmac(`${headerB64}.${payloadB64}`, env.JWT_SECRET);

  return `${headerB64}.${payloadB64}.${signature}`;
}

export async function verifyToken(token: string, env: Env): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;

    const isValid = await verifyHmac(`${headerB64}.${payloadB64}`, signature, env.JWT_SECRET);
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64)) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

export { ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY };
