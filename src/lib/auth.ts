import crypto from 'crypto';
import { setAuthToken, setUser, getAuthToken, clearAuthToken } from './config.js';

const API_URL = process.env.BLOG_API_URL || 'https://postt-api.orangestudio.workers.dev';

interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
  };
  error?: string;
}

export async function sendMagicLink(email: string): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const sessionId = crypto.randomUUID();

  try {
    const response = await fetch(`${API_URL}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, sessionId }),
    });

    if (!response.ok) {
      const data = await response.json() as { error?: string };
      return { success: false, error: data.error || 'Failed to send magic link' };
    }

    return { success: true, sessionId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export async function pollForAuth(sessionId: string, onPoll?: () => void): Promise<AuthResult> {
  const maxAttempts = 120; // 10 minutes with 5 second intervals
  const pollInterval = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    if (onPoll) onPoll();

    try {
      const response = await fetch(`${API_URL}/auth/check/${sessionId}`);
      const data = await response.json() as {
        status: 'pending' | 'complete' | 'expired' | 'not_found';
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
        user?: { id: string; email: string };
      };

      if (data.status === 'complete' && data.accessToken && data.user) {
        setAuthToken({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken!,
          expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
        });

        setUser({ id: data.user.id, email: data.user.email, username: '' });

        return { success: true, user: data.user };
      }

      if (data.status === 'expired') {
        return { success: false, error: 'Login session expired. Please try again.' };
      }

      if (data.status === 'not_found') {
        return { success: false, error: 'Login session not found. Please try again.' };
      }

      // Still pending, wait and try again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (err) {
      // Network error, keep trying
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  return { success: false, error: 'Login timed out. Please try again.' };
}

export function logout(): void {
  clearAuthToken();
}

export async function refreshTokenIfNeeded(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  // Refresh if token expires in less than 5 minutes
  if (token.expiresAt > Date.now() + 5 * 60 * 1000) {
    return true;
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });

    if (!response.ok) {
      clearAuthToken();
      return false;
    }

    const data = await response.json() as {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };

    setAuthToken({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + data.expiresIn * 1000,
    });

    return true;
  } catch {
    clearAuthToken();
    return false;
  }
}
