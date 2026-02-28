import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import type { Post, PostFrontmatter } from '../types/index.js';
import { getPostsDirectory } from './config.js';

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function getAllPosts(dir = process.cwd()): Promise<Post[]> {
  const postsDir = getPostsDirectory(dir);

  try {
    const files = await fs.readdir(postsDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    const posts = await Promise.all(
      mdFiles.map(async (filename) => {
        const filepath = path.join(postsDir, filename);
        const [content, stats] = await Promise.all([
          fs.readFile(filepath, 'utf-8'),
          fs.stat(filepath),
        ]);
        const { data, content: body } = matter(content);

        const frontmatter = data as PostFrontmatter;
        const slug = path.basename(filename, '.md');

        return {
          slug,
          title: frontmatter.title || slug,
          date: frontmatter.date || new Date().toISOString().split('T')[0],
          status: frontmatter.status || 'draft',
          publishedAt: frontmatter.publishedAt,
          content: body,
          filepath,
          modifiedAt: stats.mtime,
        } as Post;
      })
    );

    return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export async function getPost(slug: string, dir = process.cwd()): Promise<Post | null> {
  const filepath = path.join(getPostsDirectory(dir), `${slug}.md`);

  try {
    const content = await fs.readFile(filepath, 'utf-8');
    const { data, content: body } = matter(content);
    const frontmatter = data as PostFrontmatter;

    return {
      slug,
      title: frontmatter.title || slug,
      date: frontmatter.date || new Date().toISOString().split('T')[0],
      status: frontmatter.status || 'draft',
      content: body,
      filepath,
    };
  } catch {
    return null;
  }
}

export async function savePost(post: Post, dir = process.cwd()): Promise<void> {
  const postsDir = getPostsDirectory(dir);
  await fs.mkdir(postsDir, { recursive: true });

  const filepath = path.join(postsDir, `${post.slug}.md`);
  const frontmatter: PostFrontmatter = {
    title: post.title,
    date: post.date,
    status: post.status,
  };

  if (post.publishedAt) {
    frontmatter.publishedAt = post.publishedAt;
  }

  const content = matter.stringify(post.content, frontmatter);
  await fs.writeFile(filepath, content);
}

export function needsPublishing(post: Post): boolean {
  // Drafts always need publishing
  if (post.status === 'draft') return true;

  // Published posts need re-publishing if modified after last publish
  if (post.publishedAt && post.modifiedAt) {
    const publishedTime = new Date(post.publishedAt).getTime();
    const modifiedTime = post.modifiedAt.getTime();
    return modifiedTime > publishedTime;
  }

  // Published but no publishedAt timestamp - legacy post, assume it's synced
  return false;
}

export function draftPost(
  title: string,
  content = '',
  dir = process.cwd()
): Post {
  const slug = slugify(title);
  const date = new Date().toISOString().split('T')[0];

  return {
    slug,
    title,
    date,
    status: 'draft',
    content: content || '',
    filepath: path.join(getPostsDirectory(dir), `${slug}.md`),
  };
}

export async function createPost(
  title: string,
  content = '',
  status: 'draft' | 'published' = 'draft',
  dir = process.cwd()
): Promise<Post> {
  const post = draftPost(title, content, dir);
  post.status = status;
  await savePost(post, dir);
  return post;
}

export async function updatePostStatus(
  slug: string,
  status: 'draft' | 'published',
  dir = process.cwd()
): Promise<Post | null> {
  const post = await getPost(slug, dir);
  if (!post) return null;

  post.status = status;
  await savePost(post, dir);
  return post;
}

export async function deletePost(slug: string, dir = process.cwd()): Promise<boolean> {
  const filepath = path.join(getPostsDirectory(dir), `${slug}.md`);

  try {
    await fs.unlink(filepath);
    return true;
  } catch {
    return false;
  }
}
