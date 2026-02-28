import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { Editor } from '../components/Editor.js';
import { draftPost, savePost } from '../lib/posts.js';
import { blogExists, syncBlogConfig } from '../lib/config.js';
import { deployBlog } from '../lib/api.js';
import { getAllPosts } from '../lib/posts.js';
import type { Post } from '../types/index.js';

type Step = 'check' | 'title' | 'editor' | 'done' | 'error';

interface NewCommandProps {
  initialTitle?: string;
  useExternalEditor?: boolean;
}

function NewCommand({ initialTitle, useExternalEditor }: NewCommandProps) {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('check');
  const [title, setTitle] = useState(initialTitle || '');
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);
  const [blogUrl, setBlogUrl] = useState('');

  useEffect(() => {
    const checkBlog = async () => {
      if (!(await blogExists())) {
        setError('No blog found. Run `postt init` first.');
        setStep('error');
        return;
      }

      if (initialTitle) {
        await handleCreatePost(initialTitle);
      } else {
        setStep('title');
      }
    };

    checkBlog();
  }, []);

  const handleCreatePost = async (postTitle: string) => {
    try {
      const newPost = draftPost(postTitle);
      setPost(newPost);

      if (useExternalEditor) {
        // For external editor, we need to save the file first
        await savePost(newPost);
        const { execSync } = await import('child_process');
        const editor = process.env.EDITOR || 'nano';
        execSync(`${editor} "${newPost.filepath}"`, { stdio: 'inherit' });
        setStep('done');
      } else {
        // For built-in editor, don't save until user explicitly saves
        setStep('editor');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
      setStep('error');
    }
  };

  const handleTitleSubmit = async (value: string) => {
    if (value.trim()) {
      setTitle(value.trim());
      await handleCreatePost(value.trim());
    }
  };

  const handleSave = async (content: string) => {
    if (post) {
      post.content = content;
      await savePost(post);
    }
  };

  const handlePublish = async (content: string) => {
    if (post) {
      post.content = content;
      post.status = 'published';
      post.publishedAt = new Date().toISOString();
      await savePost(post);

      // Trigger deployment
      const config = await syncBlogConfig();
      if (config) {
        const allPosts = await getAllPosts();
        const publishedPosts = allPosts
          .filter((p) => p.status === 'published')
          .map((p) => ({
            slug: p.slug,
            title: p.title,
            content: p.content,
            date: p.date,
            status: p.status,
          }));

        await deployBlog(config.id, publishedPosts);
        setBlogUrl(config.url);
        setPublished(true);
      }
    }
  };

  const handleExit = () => {
    setStep('done');
  };

  useEffect(() => {
    if (step === 'done' || step === 'error') {
      const timer = setTimeout(() => exit(), 100);
      return () => clearTimeout(timer);
    }
  }, [step, exit]);

  return (
    <Box flexDirection="column">
      {step === 'title' && (
        <Box padding={1}>
          <Text color="cyan">? </Text>
          <Text>Post title: </Text>
          <TextInput
            value={title}
            onChange={setTitle}
            onSubmit={handleTitleSubmit}
            placeholder="My First Post"
          />
        </Box>
      )}

      {step === 'editor' && post && (
        <Editor
          initialContent={post.content}
          title={post.title}
          onSave={handleSave}
          onPublish={handlePublish}
          onExit={handleExit}
        />
      )}

      {step === 'done' && (
        <Box flexDirection="column" padding={1}>
          <Text color="green">✓ Post saved: {post?.slug}.md</Text>
          {published && blogUrl && (
            <>
              <Text color="green">✓ Published!</Text>
              <Text> </Text>
              <Text>View your post: <Text color="cyan" bold>{blogUrl}/{post?.slug}</Text></Text>
            </>
          )}
        </Box>
      )}

      {step === 'error' && (
        <Box padding={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}

export function runNew(title?: string, useExternalEditor?: boolean) {
  render(<NewCommand initialTitle={title} useExternalEditor={useExternalEditor} />);
}
