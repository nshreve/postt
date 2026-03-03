import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import { Spinner } from '../components/Spinner.js';
import { getAllPosts, savePost, needsPublishing } from '../lib/posts.js';
import { blogExists, syncBlogConfig, saveBlogConfig } from '../lib/config.js';
import { deployBlog } from '../lib/api.js';
import type { Post, BlogConfig } from '../types/index.js';

type Status = 'checking' | 'select' | 'deploying' | 'done' | 'error' | 'nothing';

function PublishCommand() {
  const { exit } = useApp();
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [deployTime, setDeployTime] = useState(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [deletedSlugs, setDeletedSlugs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursorIndex, setCursorIndex] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0);
  const [config, setConfig] = useState<BlogConfig | null>(null);
  const [configChanged, setConfigChanged] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!(await blogExists())) {
        setError('No blog found. Run `postt init` first.');
        setStatus('error');
        return;
      }

      const cfg = await syncBlogConfig();
      if (!cfg) {
        setError('Could not read blog config');
        setStatus('error');
        return;
      }

      setUrl(cfg.url);
      setConfig(cfg);

      const allPosts = await getAllPosts();
      const postsToPublish = allPosts.filter(needsPublishing);

      // Compute deleted slugs: slugs that were deployed but are no longer local.
      // Fall back to current published slugs when deployedSlugs is uninitialized
      // so that existing blogs can detect deletions correctly.
      const localPublishedSlugs = new Set(
        allPosts.filter((p) => p.status === 'published').map((p) => p.slug)
      );
      const deployedSlugSet = new Set(
        cfg.deployedSlugs ?? [...localPublishedSlugs]
      );
      const removed = [...deployedSlugSet].filter((s) => !localPublishedSlugs.has(s));

      // Detect blog config drift (title/subdomain changed since last deploy)
      const configChanged =
        (cfg.deployedTitle !== undefined && cfg.deployedTitle !== cfg.title) ||
        (cfg.deployedSubdomain !== undefined && cfg.deployedSubdomain !== cfg.subdomain);

      if (postsToPublish.length === 0 && removed.length === 0 && !configChanged) {
        setStatus('nothing');
        return;
      }

      setDeletedSlugs(removed);
      setPosts(postsToPublish);
      setConfigChanged(configChanged);
      setStatus('select');
    };

    init();
  }, []);

  const handlePublish = async () => {
    if (selected.size === 0 && deletedSlugs.length === 0 && !configChanged) {
      setStatus('nothing');
      return;
    }

    const startTime = Date.now();
    setStatus('deploying');

    try {
      const cfg = config || (await syncBlogConfig());
      if (!cfg) throw new Error('Could not read blog config');

      // Get all posts and update selected ones
      const allPosts = await getAllPosts();
      const now = new Date().toISOString();

      for (const post of allPosts) {
        if (selected.has(post.slug)) {
          post.status = 'published';
          post.publishedAt = now;
          await savePost(post);
        }
      }

      // Re-read posts after saves
      const freshPosts = await getAllPosts();

      // Deploy all published posts (deleted slugs are excluded by filtering published)
      const publishedPosts = freshPosts
        .filter((p) => p.status === 'published')
        .map((p) => ({
          slug: p.slug,
          title: p.title,
          content: p.content,
          date: p.date,
          status: 'published' as const,
        }));

      await deployBlog(cfg.id, publishedPosts);

      // Persist deployed state
      const newDeployedSlugs = publishedPosts.map((p) => p.slug);
      await saveBlogConfig({
        ...cfg,
        deployedSlugs: newDeployedSlugs,
        deployedTitle: cfg.title,
        deployedSubdomain: cfg.subdomain,
      });

      setPublishedCount(selected.size);
      setDeployTime((Date.now() - startTime) / 1000);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
      setStatus('error');
    }
  };

  useInput((input, key) => {
    if (status !== 'select') return;

    if (key.upArrow) {
      setCursorIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setCursorIndex((prev) => Math.min(posts.length - 1, prev + 1));
    } else if (input === ' ') {
      const post = posts[cursorIndex];
      if (post) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(post.slug)) {
            next.delete(post.slug);
          } else {
            next.add(post.slug);
          }
          return next;
        });
      }
    } else if (key.return) {
      handlePublish();
    } else if (key.escape || input === 'q') {
      exit();
    }
  });

  useEffect(() => {
    if (status === 'done' || status === 'error' || status === 'nothing') {
      const timer = setTimeout(() => exit(), 100);
      return () => clearTimeout(timer);
    }
  }, [status, exit]);

  const totalCount = selected.size + deletedSlugs.length + (configChanged ? 1 : 0);

  return (
    <Box flexDirection="column" padding={1}>
      {status === 'checking' && <Spinner text="Checking for posts to publish..." />}

      {status === 'nothing' && (
        <Text color="gray">Nothing to publish. All posts are up to date.</Text>
      )}

      {status === 'select' && (
        <Box flexDirection="column">
          <Text bold>Select posts to publish:</Text>
          <Text> </Text>
          {posts.map((post, idx) => {
            const isSelected = selected.has(post.slug);
            const isCursor = idx === cursorIndex;
            const isDraft = post.status === 'draft';

            return (
              <Box key={post.slug}>
                <Text color={isCursor ? 'cyan' : undefined}>
                  {isCursor ? '❯ ' : '  '}
                  {isSelected ? '◉' : '○'}{' '}
                  {post.title}
                  {isDraft ? (
                    <Text color="yellow"> (draft)</Text>
                  ) : (
                    <Text color="blue"> (edited)</Text>
                  )}
                </Text>
              </Box>
            );
          })}
          {deletedSlugs.length > 0 && (
            <>
              <Text> </Text>
              {deletedSlugs.map((slug) => (
                <Box key={slug}>
                  <Text color="gray">
                    {'  '}✕ {slug}
                    <Text color="red"> (will be removed)</Text>
                  </Text>
                </Box>
              ))}
            </>
          )}
          {configChanged && (
            <>
              <Text> </Text>
              <Box>
                <Text color="gray">
                  {'  '}~ blog settings
                  <Text color="cyan"> (title/subdomain updated)</Text>
                </Text>
              </Box>
            </>
          )}
          <Text> </Text>
          <Text color="gray">
            Space to toggle • Enter to publish {totalCount > 0 ? `(${totalCount})` : ''} • q to cancel
          </Text>
        </Box>
      )}

      {status === 'deploying' && (
        <Box flexDirection="column">
          <Spinner text={`Publishing...`} />
        </Box>
      )}

      {status === 'done' && (
        <Box flexDirection="column">
          <Text color="green">
            ✓ Published {publishedCount} post{publishedCount === 1 ? '' : 's'}
            {deletedSlugs.length > 0 ? `, removed ${deletedSlugs.length}` : ''} in {deployTime.toFixed(1)}s
          </Text>
          <Text> </Text>
          <Text>
            🔗 <Text color="cyan" bold>{url}</Text>
          </Text>
        </Box>
      )}

      {status === 'error' && <Text color="red">Error: {error}</Text>}
    </Box>
  );
}

export function runPublish() {
  render(<PublishCommand />);
}
