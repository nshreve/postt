import React, { useEffect } from 'react';
import { render, Box, Text, useApp } from 'ink';
import { logout } from '../lib/auth.js';
import { isAuthenticated, clearUser } from '../lib/config.js';

function LogoutCommand() {
  const { exit } = useApp();

  useEffect(() => {
    if (!isAuthenticated()) {
      return;
    }
    logout();
    clearUser();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => exit(), 100);
    return () => clearTimeout(timer);
  }, [exit]);

  if (!isAuthenticated()) {
    return (
      <Box paddingX={2}>
        <Text color="yellow">You're not logged in.</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={2}>
      <Text color="green">Logged out successfully.</Text>
    </Box>
  );
}

export function runLogout() {
  render(<LogoutCommand />);
}
