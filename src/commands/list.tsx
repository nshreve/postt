import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp } from 'ink';
import { PostList } from '../components/PostList.js';
import { Spinner } from '../components/Spinner.js';
import { getAllPosts } from '../lib/posts.js';
import { blogExists } from '../lib/config.js';
import type { Post } from '../types/index.js';

type Status = 'loading' | 'loaded' | 'error';

function ListCommand() {
  const { exit } = useApp();
  const [status, setStatus] = useState<Status>('loading');
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPosts = async () => {
      if (!(await blogExists())) {
        setError('No blog found. Run `postt init` first.');
        setStatus('error');
        return;
      }

      const allPosts = await getAllPosts();
      setPosts(allPosts);
      setStatus('loaded');
    };

    loadPosts();
  }, []);

  useEffect(() => {
    if (status === 'loaded' || status === 'error') {
      const timer = setTimeout(() => exit(), 100);
      return () => clearTimeout(timer);
    }
  }, [status, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      {status === 'loading' && <Spinner text="Loading posts..." />}

      {status === 'loaded' && <PostList posts={posts} />}

      {status === 'error' && <Text color="red">Error: {error}</Text>}
    </Box>
  );
}

export function runList() {
  render(<ListCommand />);
}
