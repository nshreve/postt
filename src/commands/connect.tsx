import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { Spinner } from '../components/Spinner.js';
import { blogExists, saveBlogConfig, initBlogDirectory } from '../lib/config.js';
import { getBlogBySubdomain, getBlogPosts } from '../lib/api.js';
import { savePost } from '../lib/posts.js';

type State = 'checking' | 'input' | 'connecting' | 'done' | 'error';

type ParsedInput =
  | { type: 'subdomain'; value: string }
  | { type: 'custom-domain'; value: string }
  | { type: 'invalid' };

function parseInput(raw: string): ParsedInput {
  let hostname = raw.trim();
  if (!hostname) return { type: 'invalid' };

  // Strip protocol
  if (/^https?:\/\//i.test(hostname)) {
    try {
      hostname = new URL(hostname).hostname;
    } catch {
      return { type: 'invalid' };
    }
  }

  // *.postt.io subdomain
  if (hostname.endsWith('.postt.io')) {
    const sub = hostname.slice(0, hostname.length - '.postt.io'.length);
    if (/^[a-z0-9-]{3,30}$/.test(sub)) {
      return { type: 'subdomain', value: sub };
    }
    return { type: 'invalid' };
  }

  // Contains a dot → custom domain
  if (hostname.includes('.')) {
    return { type: 'custom-domain', value: hostname };
  }

  // Plain subdomain
  if (/^[a-z0-9-]{3,30}$/.test(hostname)) {
    return { type: 'subdomain', value: hostname };
  }

  return { type: 'invalid' };
}

interface Props {
  subdomain?: string;
}

function ConnectCommand({ subdomain: initialSubdomain }: Props) {
  const { exit } = useApp();
  const [state, setState] = useState<State>('checking');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function performConnect(raw: string) {
    const parsed = parseInput(raw);

    if (parsed.type === 'custom-domain') {
      setError(
        `Custom domain lookup isn't supported yet. Try connecting with your subdomain instead (e.g. \`my-blog\`).`
      );
      setState('error');
      return;
    }

    if (parsed.type === 'invalid') {
      setError(
        `Invalid format. Try a subdomain (e.g. \`my-blog\`), \`my-blog.postt.io\`, or \`https://my-blog.postt.io\`.`
      );
      setState('error');
      return;
    }

    try {
      const blog = await getBlogBySubdomain(parsed.value);

      await saveBlogConfig({
        id: blog.id,
        title: blog.title,
        subdomain: blog.subdomain,
        url: blog.url,
        createdAt: blog.createdAt,
      });
      await initBlogDirectory();

      const posts = await getBlogPosts(blog.id);
      for (const post of posts) {
        await savePost({
          ...post,
          filepath: '', // savePost recomputes filepath from slug
        });
      }

      const n = posts.length;
      setSuccessMsg(
        `Connected to ${blog.title} — pulled ${n} post${n !== 1 ? 's' : ''} — ${blog.url}`
      );
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Blog not found or you don\'t have access.');
      setState('error');
    }
  }

  useEffect(() => {
    async function check() {
      const exists = await blogExists();
      if (exists) {
        setError(
          'This directory is already connected to a blog. Use `postt settings` to manage it.'
        );
        setState('error');
        return;
      }

      if (initialSubdomain) {
        setState('connecting');
        await performConnect(initialSubdomain);
      } else {
        setState('input');
      }
    }
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputSubmit = async (value: string) => {
    if (!value.trim()) return;
    setState('connecting');
    await performConnect(value.trim());
  };

  useEffect(() => {
    if (state === 'done' || state === 'error') {
      const timer = setTimeout(() => exit(), 100);
      return () => clearTimeout(timer);
    }
  }, [state, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      {state === 'checking' && (
        <Box paddingX={2}>
          <Spinner text="Checking directory..." />
        </Box>
      )}

      {state === 'input' && (
        <Box flexDirection="column" paddingX={2}>
          <Box>
            <Text color="cyan">? </Text>
            <Text>Enter your blog subdomain or URL: </Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleInputSubmit}
              placeholder="my-blog"
            />
          </Box>
        </Box>
      )}

      {state === 'connecting' && (
        <Box paddingX={2}>
          <Spinner text="Connecting to blog..." />
        </Box>
      )}

      {state === 'done' && (
        <Box paddingX={2}>
          <Text color="green">✓ {successMsg}</Text>
        </Box>
      )}

      {state === 'error' && (
        <Box paddingX={2}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}

export function runConnect(subdomain?: string) {
  render(<ConnectCommand subdomain={subdomain} />);
}
