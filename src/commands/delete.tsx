import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import { getAllPosts, deletePost } from '../lib/posts.js';
import { blogExists } from '../lib/config.js';
import type { Post } from '../types/index.js';

type Step = 'checking' | 'select' | 'confirm' | 'done' | 'error';

interface DeleteCommandProps {
  slug?: string;
}

function DeleteCommand({ slug }: DeleteCommandProps) {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('checking');
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [targetPost, setTargetPost] = useState<Post | null>(null);
  const [error, setError] = useState('');
  const [deletedTitle, setDeletedTitle] = useState('');

  useEffect(() => {
    const init = async () => {
      if (!(await blogExists())) {
        setError('No blog found. Run `postt init` first.');
        setStep('error');
        return;
      }

      const allPosts = await getAllPosts();

      if (allPosts.length === 0) {
        setError('No posts found.');
        setStep('error');
        return;
      }

      if (slug) {
        const found = allPosts.find((p) => p.slug === slug);
        if (!found) {
          setError(`Post "${slug}" not found.`);
          setStep('error');
          return;
        }
        setTargetPost(found);
        setStep('confirm');
      } else {
        setPosts(allPosts);
        setStep('select');
      }
    };

    init();
  }, []);

  const handleDelete = async (post: Post) => {
    const success = await deletePost(post.slug);
    if (success) {
      setDeletedTitle(post.title);
      setStep('done');
    } else {
      setError(`Failed to delete "${post.title}".`);
      setStep('error');
    }
  };

  useInput((input, key) => {
    if (step === 'select') {
      if (key.upArrow) {
        setCursorIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setCursorIndex((prev) => Math.min(posts.length - 1, prev + 1));
      } else if (key.return) {
        const post = posts[cursorIndex];
        if (post) {
          setTargetPost(post);
          setStep('confirm');
        }
      } else if (key.escape || input === 'q') {
        exit();
      }
    } else if (step === 'confirm') {
      if (input === 'y' || input === 'Y') {
        if (targetPost) handleDelete(targetPost);
      } else if (input === 'n' || input === 'N' || key.escape) {
        exit();
      }
    }
  });

  useEffect(() => {
    if (step === 'done' || step === 'error') {
      const timer = setTimeout(() => exit(), 100);
      return () => clearTimeout(timer);
    }
  }, [step, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      {step === 'checking' && <Text color="gray">Loading posts...</Text>}

      {step === 'select' && (
        <Box flexDirection="column">
          <Text bold>Select a post to delete:</Text>
          <Text> </Text>
          {posts.map((post, idx) => {
            const isCursor = idx === cursorIndex;
            return (
              <Box key={post.slug}>
                <Text color={isCursor ? 'cyan' : undefined}>
                  {isCursor ? '❯ ' : '  '}
                  {post.title}
                  {post.status === 'draft' ? (
                    <Text color="yellow"> (draft)</Text>
                  ) : (
                    <Text color="green"> (published)</Text>
                  )}
                </Text>
              </Box>
            );
          })}
          <Text> </Text>
          <Text color="gray">Enter to select • q to cancel</Text>
        </Box>
      )}

      {step === 'confirm' && targetPost && (
        <Box flexDirection="column">
          <Text>
            Delete <Text bold>"{targetPost.title}"</Text>? This cannot be undone.
          </Text>
          <Text color="gray">y/N: </Text>
        </Box>
      )}

      {step === 'done' && (
        <Box flexDirection="column">
          <Text color="red">✓ Deleted "{deletedTitle}"</Text>
          <Text color="gray">Run `postt publish` to sync remote.</Text>
        </Box>
      )}

      {step === 'error' && <Text color="red">Error: {error}</Text>}
    </Box>
  );
}

export function runDelete(slug?: string) {
  render(<DeleteCommand slug={slug} />);
}
