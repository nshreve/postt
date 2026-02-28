import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Spinner } from '../components/Spinner.js';
import { sendMagicLink, pollForAuth } from '../lib/auth.js';
import { isAuthenticated, getUser } from '../lib/config.js';

type Status = 'checking' | 'input' | 'sending' | 'waiting' | 'done' | 'error';

function LoginCommand() {
  const { exit } = useApp();
  const [status, setStatus] = useState<Status>('checking');
  const [email, setEmail] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState('');
  const [dots, setDots] = useState('');

  useEffect(() => {
    // Check if already logged in
    if (isAuthenticated()) {
      const user = getUser();
      if (user) {
        setUserEmail(user.email);
        setStatus('done');
        return;
      }
    }
    setStatus('input');
  }, []);

  useEffect(() => {
    if (status === 'waiting') {
      const interval = setInterval(() => {
        setDots((d) => (d.length >= 3 ? '' : d + '.'));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'done' || status === 'error') {
      const timer = setTimeout(() => exit(), 100);
      return () => clearTimeout(timer);
    }
  }, [status, exit]);

  const handleSubmit = async () => {
    if (!email.trim()) return;

    setStatus('sending');

    const result = await sendMagicLink(email.trim());

    if (!result.success) {
      setError(result.error || 'Failed to send magic link');
      setStatus('error');
      return;
    }

    setStatus('waiting');

    // Poll for auth completion
    const authResult = await pollForAuth(result.sessionId!);

    if (authResult.success && authResult.user) {
      setUserEmail(authResult.user.email);
      setStatus('done');
    } else {
      setError(authResult.error || 'Authentication failed');
      setStatus('error');
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {status === 'checking' && (
        <Spinner text="Checking authentication status..." />
      )}

      {status === 'input' && (
        <Box flexDirection="column" gap={1}>
          <Text>Enter your email to receive a magic link:</Text>
          <Box>
            <Text color="cyan">→ </Text>
            <TextInput
              value={email}
              onChange={setEmail}
              onSubmit={handleSubmit}
              placeholder="you@example.com"
            />
          </Box>
          <Text color="gray">Press Enter to send magic link</Text>
        </Box>
      )}

      {status === 'sending' && (
        <Spinner text="Sending magic link..." />
      )}

      {status === 'waiting' && (
        <Box flexDirection="column" gap={1}>
          <Text color="green">✓ Magic link sent to <Text bold>{email}</Text></Text>
          <Text>Check your email and click the link to sign in.</Text>
          <Spinner text={`Waiting for you to click the link${dots}`} />
        </Box>
      )}

      {status === 'done' && (
        <Text color="green">✓ Signed in as <Text bold>{userEmail}</Text></Text>
      )}

      {status === 'error' && (
        <Text color="red">✗ {error}</Text>
      )}
    </Box>
  );
}

export function runLogin() {
  render(<LoginCommand />);
}
