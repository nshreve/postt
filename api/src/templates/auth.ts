export const authPageHtml = `<!DOCTYPE html>
<html>
<head>
  <title>postt.io - Authentication</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #ededed;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      color: #ededed;
      margin-bottom: 1rem;
    }
    .spinner {
      border: 3px solid #333;
      border-top: 3px solid #0070f3;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .success { color: #22c55e; }
    .error { color: #ef4444; }
    .info { color: #888; margin-top: 1rem; }
    code {
      background: #1a1a1a;
      padding: 0.2em 0.5em;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>postt.io</h1>
    <div id="status">
      <div class="spinner"></div>
      <p>Completing authentication...</p>
    </div>
  </div>
  <script>
    (async () => {
      const statusEl = document.getElementById('status');

      // Check for tokens in URL hash
      const hash = window.location.hash.substring(1);
      if (!hash) {
        statusEl.innerHTML = '<p>Welcome to postt.io API</p><p class="info">Use the CLI to get started: <code>npx postt login</code></p>';
        return;
      }

      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken) {
        statusEl.innerHTML = '<p class="error">Authentication failed. No token received.</p><p>Please try logging in again.</p>';
        return;
      }

      try {
        const response = await fetch('/auth/complete-magic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supabaseAccessToken: accessToken,
            supabaseRefreshToken: refreshToken,
          }),
        });

        if (response.ok) {
          statusEl.innerHTML = '<p class="success">✓ Authentication successful!</p><p>You can close this window and return to your terminal.</p>';
        } else {
          const error = await response.json();
          statusEl.innerHTML = '<p class="error">Authentication failed: ' + (error.error || 'Unknown error') + '</p>';
        }
      } catch (err) {
        statusEl.innerHTML = '<p class="error">Authentication failed: ' + err.message + '</p>';
      }
    })();
  </script>
</body>
</html>`;
