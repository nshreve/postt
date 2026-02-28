import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp } from 'ink';
import { Spinner } from '../components/Spinner.js';
import { getAllPosts } from '../lib/posts.js';
import { blogExists, getBlogConfig, isAuthenticated, getUser } from '../lib/config.js';
import type { BlogConfig, Post } from '../types/index.js';

type Status = 'loading' | 'loaded' | 'error';

function StatusCommand() {
  const { exit } = useApp();
  const [status, setStatus] = useState<Status>('loading');
  const [config, setConfig] = useState<BlogConfig | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadStatus = async () => {
      if (!(await blogExists())) {
        setError('No blog found in this directory. Run `postt init` to create one.');
        setStatus('error');
        return;
      }

      const blogConfig = await getBlogConfig();
      if (!blogConfig) {
        setError('Could not read blog config');
        setStatus('error');
        return;
      }

      setConfig(blogConfig);

      const allPosts = await getAllPosts();
      setPosts(allPosts);

      setStatus('loaded');
    };

    loadStatus();
  }, []);

  useEffect(() => {
    if (status === 'loaded' || status === 'error') {
      const timer = setTimeout(() => exit(), 100);
      return () => clearTimeout(timer);
    }
  }, [status, exit]);

  const publishedCount = posts.filter((p) => p.status === 'published').length;
  const draftCount = posts.filter((p) => p.status === 'draft').length;
  const user = getUser();
  const authenticated = isAuthenticated();

  return (
    <Box flexDirection="column" padding={1}>
      {status === 'loading' && <Spinner text="Loading blog info..." />}

      {status === 'loaded' && config && (
        <Box flexDirection="column">
          <Box
            borderStyle="round"
            borderColor="cyan"
            paddingX={2}
            paddingY={1}
            flexDirection="column"
          >
            <Text bold color="cyan">
              {config.title}
            </Text>
            <Text color="gray">───────────────────────</Text>

            <Box marginTop={1}>
              <Text color="gray">URL:       </Text>
              <Text color="cyan">{config.url}</Text>
            </Box>

            <Box>
              <Text color="gray">Subdomain: </Text>
              <Text>{config.subdomain}</Text>
            </Box>

            <Box>
              <Text color="gray">Posts:     </Text>
              <Text color="green">{publishedCount} published</Text>
              {draftCount > 0 && (
                <Text color="yellow">, {draftCount} drafts</Text>
              )}
            </Box>

            {authenticated && user && (
              <Box>
                <Text color="gray">User:      </Text>
                <Text>@{user.username}</Text>
              </Box>
            )}

            <Box marginTop={1}>
              <Text color="gray">Created:   </Text>
              <Text>{new Date(config.createdAt).toLocaleDateString()}</Text>
            </Box>
          </Box>

          {posts.length > 0 && (
            <Box marginTop={1} flexDirection="column" paddingX={1}>
              <Text bold dimColor>Recent posts:</Text>
              {posts.slice(0, 5).map((post) => (
                <Box key={post.slug}>
                  <Text color={post.status === 'published' ? 'green' : 'yellow'}>
                    {post.status === 'published' ? '●' : '○'}{' '}
                  </Text>
                  <Text>{post.title}</Text>
                  <Text color="gray" dimColor> ({post.date})</Text>
                </Box>
              ))}
              {posts.length > 5 && (
                <Text color="gray" dimColor>
                  ... and {posts.length - 5} more
                </Text>
              )}
            </Box>
          )}

          <Box marginTop={1} paddingX={1}>
            <Text color="gray" dimColor>
              Run `postt publish` to deploy changes
            </Text>
          </Box>
        </Box>
      )}

      {status === 'error' && <Text color="red">{error}</Text>}
    </Box>
  );
}

export function runStatus() {
  render(<StatusCommand />);
}
