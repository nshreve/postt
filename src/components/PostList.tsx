import React from 'react';
import { Box, Text } from 'ink';
import type { Post } from '../types/index.js';

interface PostListProps {
  posts: Post[];
  selectedIndex?: number;
}

export function PostList({ posts, selectedIndex }: PostListProps) {
  if (posts.length === 0) {
    return (
      <Box paddingX={2}>
        <Text color="gray">No posts yet. Run `postt new` to create your first post!</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}>
        <Text bold>Your Posts</Text>
        <Text color="gray"> ({posts.length})</Text>
      </Box>

      {posts.map((post, index) => {
        const isSelected = index === selectedIndex;
        const statusColor = post.status === 'published' ? 'green' : 'yellow';
        const statusIcon = post.status === 'published' ? '●' : '○';

        return (
          <Box key={post.slug}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '› ' : '  '}
            </Text>
            <Text color={statusColor}>{statusIcon} </Text>
            <Text bold={isSelected}>{post.title}</Text>
            <Text color="gray"> • {post.date}</Text>
            <Text color="gray" dimColor> ({post.slug})</Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ● published  ○ draft
        </Text>
      </Box>
    </Box>
  );
}
