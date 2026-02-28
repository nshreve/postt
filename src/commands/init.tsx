import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import fs from 'fs/promises';
import path from 'path';
import { Welcome } from '../components/Welcome.js';
import { Spinner } from '../components/Spinner.js';
import { sendMagicLink, pollForAuth } from '../lib/auth.js';
import { isAuthenticated, getUser, saveBlogConfig, initBlogDirectory, blogExists } from '../lib/config.js';
import { createBlog, checkSubdomainAvailability } from '../lib/api.js';
import { slugify } from '../lib/posts.js';

type Step = 'welcome' | 'title' | 'directory' | 'email' | 'waiting' | 'subdomain' | 'creating' | 'done' | 'error';

function InitCommand() {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [blogTitle, setBlogTitle] = useState('');
  const [dirName, setDirName] = useState('');
  const [dirPath, setDirPath] = useState('');
  const [email, setEmail] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [error, setError] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [dots, setDots] = useState('');

  // Animate dots while waiting
  useEffect(() => {
    if (step === 'waiting') {
      const interval = setInterval(() => {
        setDots((d) => (d.length >= 3 ? '' : d + '.'));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [step]);

  useInput((input, key) => {
    if (step === 'welcome' && key.return) {
      setStep('title');
    }
  });

  const handleTitleSubmit = (value: string) => {
    if (value.trim()) {
      const title = value.trim();
      setBlogTitle(title);
      setDirName(slugify(title).slice(0, 50));
      setStep('directory');
    }
  };

  const handleDirectorySubmit = async (value: string) => {
    if (!value.trim()) return;

    const dir = value.trim();
    const fullPath = path.resolve(process.cwd(), dir);

    // Check if directory already exists
    try {
      await fs.access(fullPath);
      // Directory exists, check if it has a blog
      if (await blogExists(fullPath)) {
        setError(`A blog already exists in ${dir}. Use \`postt status\` inside that directory.`);
        setStep('error');
        return;
      }
      // Directory exists but no blog - we can use it
    } catch {
      // Directory doesn't exist - we'll create it
    }

    setDirName(dir);
    setDirPath(fullPath);

    if (isAuthenticated()) {
      const user = getUser();
      if (user) {
        setUserEmail(user.email);
      }
      setStep('subdomain');
    } else {
      setStep('email');
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) return;

    const result = await sendMagicLink(email.trim());

    if (!result.success) {
      setError(result.error || 'Failed to send magic link');
      setStep('error');
      return;
    }

    setStep('waiting');

    const authResult = await pollForAuth(result.sessionId!);

    if (authResult.success && authResult.user) {
      setUserEmail(authResult.user.email);
      setStep('subdomain');
    } else {
      setError(authResult.error || 'Authentication failed');
      setStep('error');
    }
  };

  const handleSubdomainChange = async (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(cleaned);
    setSubdomainAvailable(null);

    if (cleaned.length >= 3) {
      setCheckingSubdomain(true);
      try {
        const available = await checkSubdomainAvailability(cleaned);
        setSubdomainAvailable(available);
      } catch {
        setSubdomainAvailable(true);
      }
      setCheckingSubdomain(false);
    }
  };

  const handleSubdomainSubmit = async () => {
    if (subdomain.length < 3) {
      return;
    }

    setStep('creating');

    try {
      const blog = await createBlog(blogTitle, subdomain);

      // Create and initialize directory
      await fs.mkdir(dirPath, { recursive: true });
      await initBlogDirectory(dirPath);
      await saveBlogConfig({
        id: blog.id,
        title: blog.title,
        subdomain: blog.subdomain,
        url: blog.url,
        createdAt: blog.createdAt,
      }, dirPath);

      setBlogUrl(blog.url);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create blog');
      setStep('error');
    }
  };

  useEffect(() => {
    if (step === 'done' || step === 'error') {
      const timer = setTimeout(() => exit(), 100);
      return () => clearTimeout(timer);
    }
  }, [step, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      {step === 'welcome' && (
        <>
          <Welcome />
          <Box paddingX={2}>
            <Text color="gray">Press Enter to continue...</Text>
          </Box>
        </>
      )}

      {step === 'title' && (
        <Box flexDirection="column" paddingX={2}>
          <Box>
            <Text color="cyan">? </Text>
            <Text>What's your blog called? </Text>
            <TextInput
              value={blogTitle}
              onChange={setBlogTitle}
              onSubmit={handleTitleSubmit}
              placeholder="My Awesome Blog"
            />
          </Box>
        </Box>
      )}

      {step === 'directory' && (
        <Box flexDirection="column" paddingX={2} gap={1}>
          <Text color="green">✓ Blog title: {blogTitle}</Text>
          <Box>
            <Text color="cyan">? </Text>
            <Text>Directory name: </Text>
            <TextInput
              value={dirName}
              onChange={setDirName}
              onSubmit={handleDirectorySubmit}
            />
          </Box>
          <Text color="gray">  This folder will be created in your current directory</Text>
        </Box>
      )}

      {step === 'email' && (
        <Box flexDirection="column" paddingX={2} gap={1}>
          <Text color="green">✓ Blog title: {blogTitle}</Text>
          <Text color="green">✓ Directory: {dirName}/</Text>
          <Text> </Text>
          <Text>Enter your email to sign in:</Text>
          <Box>
            <Text color="cyan">→ </Text>
            <TextInput
              value={email}
              onChange={setEmail}
              onSubmit={handleEmailSubmit}
              placeholder="you@example.com"
            />
          </Box>
          <Text color="gray">We'll send you a magic link to sign in</Text>
        </Box>
      )}

      {step === 'waiting' && (
        <Box flexDirection="column" paddingX={2} gap={1}>
          <Text color="green">✓ Magic link sent to <Text bold>{email}</Text></Text>
          <Text>Check your email and click the link to sign in.</Text>
          <Spinner text={`Waiting for you to click the link${dots}`} />
        </Box>
      )}

      {step === 'subdomain' && (
        <Box flexDirection="column" paddingX={2} gap={1}>
          <Text color="green">✓ Signed in as {userEmail}</Text>

          <Box>
            <Text color="cyan">? </Text>
            <Text>Choose your subdomain: </Text>
            <TextInput
              value={subdomain}
              onChange={handleSubdomainChange}
              onSubmit={handleSubdomainSubmit}
            />
            <Text color="gray">.postt.io</Text>
          </Box>

          {checkingSubdomain && (
            <Box marginLeft={2}>
              <Spinner text="Checking availability..." />
            </Box>
          )}

          {!checkingSubdomain && subdomainAvailable === true && subdomain.length >= 3 && (
            <Text color="green">  ✓ {subdomain}.postt.io is available!</Text>
          )}

          {!checkingSubdomain && subdomainAvailable === false && (
            <Text color="red">  ✗ {subdomain}.postt.io is taken</Text>
          )}

          {subdomain.length > 0 && subdomain.length < 3 && (
            <Text color="yellow">  Subdomain must be at least 3 characters</Text>
          )}
        </Box>
      )}

      {step === 'creating' && (
        <Box paddingX={2}>
          <Spinner text="Creating your blog..." />
        </Box>
      )}

      {step === 'done' && (
        <Box flexDirection="column" paddingX={2}>
          <Text color="green" bold>✓ Blog created!</Text>
          <Text> </Text>
          <Text>Your blog is live at <Text color="cyan" bold>{blogUrl}</Text></Text>
          <Text> </Text>
          <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={2} paddingY={1}>
            <Text bold color="white">Get started:</Text>
            <Text> </Text>
            <Text><Text color="yellow">1.</Text> <Text color="cyan">cd {dirName}</Text></Text>
            <Text><Text color="yellow">2.</Text> <Text color="cyan">postt new</Text>      <Text color="gray">— write your first post</Text></Text>
            <Text><Text color="yellow">3.</Text> <Text color="cyan">postt publish</Text>  <Text color="gray">— deploy to the web</Text></Text>
          </Box>
        </Box>
      )}

      {step === 'error' && (
        <Box paddingX={2}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}

export function runInit() {
  render(<InitCommand />);
}
