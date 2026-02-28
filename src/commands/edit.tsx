import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import { Editor } from '../components/Editor.js';
import { PostList } from '../components/PostList.js';
import { getPost, getAllPosts, savePost } from '../lib/posts.js';
import { blogExists } from '../lib/config.js';
import { publishPostAndDeploy } from '../lib/api.js';
import type { Post } from '../types/index.js';

type Step = 'check' | 'select' | 'editor' | 'done' | 'error';

interface EditCommandProps {
  postSlug?: string;
  useExternalEditor?: boolean;
}

function EditCommand({ postSlug, useExternalEditor }: EditCommandProps) {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('check');
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);
  const [blogUrl, setBlogUrl] = useState('');

  useEffect(() => {
    const init = async () => {
      if (!(await blogExists())) {
        setError('No blog found. Run `postt init` first.');
        setStep('error');
        return;
      }

      const allPosts = await getAllPosts();
      setPosts(allPosts);

      if (postSlug) {
        const foundPost = await getPost(postSlug);
        if (foundPost) {
          await openPost(foundPost);
        } else {
          setError(`Post "${postSlug}" not found`);
          setStep('error');
        }
      } else if (allPosts.length === 0) {
        setError('No posts found. Run `postt new` to create one.');
        setStep('error');
      } else {
        setStep('select');
      }
    };

    init();
  }, []);

  const openPost = async (p: Post) => {
    setPost(p);

    if (useExternalEditor) {
      const { execSync } = await import('child_process');
      const editor = process.env.EDITOR || 'nano';
      execSync(`${editor} "${p.filepath}"`, { stdio: 'inherit' });
      setStep('done');
    } else {
      setStep('editor');
    }
  };

  useInput((input, key) => {
    if (step !== 'select') return;

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(posts.length - 1, prev + 1));
    } else if (key.return) {
      const selectedPost = posts[selectedIndex];
      if (selectedPost) {
        openPost(selectedPost);
      }
    } else if (key.escape || input === 'q') {
      exit();
    }
  });

  const handleSave = async (content: string) => {
    if (post) {
      post.content = content;
      await savePost(post);
    }
  };

  const handlePublish = async (content: string) => {
    if (!post) return;
    const url = await publishPostAndDeploy(post, content);
    if (url) {
      setBlogUrl(url);
      setPublished(true);
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
      {step === 'select' && (
        <Box flexDirection="column" padding={1}>
          <PostList posts={posts} selectedIndex={selectedIndex} />
          <Box paddingX={2} marginTop={1}>
            <Text color="gray">↑/↓ to select • Enter to edit • q to quit</Text>
          </Box>
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
          <Text color="green">✓ Post saved{post ? `: ${post.slug}.md` : ''}</Text>
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

export function runEdit(postSlug?: string, useExternalEditor?: boolean) {
  render(<EditCommand postSlug={postSlug} useExternalEditor={useExternalEditor} />);
}
