import { marked } from 'marked';
import { styles } from './styles.js';
import { escapeHtml, formatDate } from './utils.js';

export interface PostData {
  slug: string;
  title: string;
  content: string;
  date: string;
  status: 'draft' | 'published';
}

export function generatePostHtml(post: PostData, blogTitle: string): string {
  const htmlContent = marked(post.content) as string;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(post.title)} | ${escapeHtml(blogTitle)}</title>
  <style>${styles}</style>
</head>
<body class="post-page">
  <div class="container">
    <header>
      <a href="/">&larr; ${escapeHtml(blogTitle)}</a>
    </header>
    <h1>${escapeHtml(post.title)}</h1>
    <p class="date">${formatDate(post.date)}</p>
    <article>
      ${htmlContent}
    </article>
  </div>
</body>
</html>`;
}
