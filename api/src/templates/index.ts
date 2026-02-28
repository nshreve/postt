import { styles } from './styles.js';
import { escapeHtml, formatDate } from './utils.js';
import type { PostData } from './post.js';

export interface BlogData {
  title: string;
  subdomain: string;
}

export function generateIndexHtml(posts: PostData[], blog: BlogData): string {
  const publishedPosts = posts
    .filter((p) => p.status === 'published')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const postListHtml = publishedPosts
    .map(
      (post) => `
      <article>
        <a href="/${post.slug}">
          <h2>${escapeHtml(post.title)}</h2>
        </a>
        <p class="date">${formatDate(post.date)}</p>
      </article>
    `
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(blog.title)}</title>
  <style>${styles}</style>
</head>
<body class="index-page">
  <div class="container">
    <header>
      <h1>${escapeHtml(blog.title)}</h1>
    </header>
    <main>
      ${postListHtml || '<p class="empty">No posts yet.</p>'}
    </main>
  </div>
</body>
</html>`;
}
