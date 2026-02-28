import { marked } from 'marked';

export function markdownToHtml(markdown: string): string {
  return marked(markdown) as string;
}

export function highlightMarkdown(text: string): string {
  // Simple syntax highlighting for terminal display
  let result = text;

  // Headers
  result = result.replace(/^(#{1,6})\s+(.*)$/gm, (_, hashes, content) => {
    return `\x1b[1;36m${hashes} ${content}\x1b[0m`;
  });

  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, '\x1b[1m$1\x1b[0m');

  // Italic
  result = result.replace(/\*([^*]+)\*/g, '\x1b[3m$1\x1b[0m');

  // Code blocks
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `\x1b[48;5;236m\x1b[38;5;252m${code}\x1b[0m`;
  });

  // Inline code
  result = result.replace(/`([^`]+)`/g, '\x1b[48;5;236m\x1b[38;5;252m$1\x1b[0m');

  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '\x1b[4;34m$1\x1b[0m');

  // Lists
  result = result.replace(/^(\s*[-*+])\s+/gm, '\x1b[33m$1\x1b[0m ');
  result = result.replace(/^(\s*\d+\.)\s+/gm, '\x1b[33m$1\x1b[0m ');

  // Blockquotes
  result = result.replace(/^>\s+(.*)$/gm, '\x1b[90m> $1\x1b[0m');

  return result;
}

export function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  if (match) {
    return content.slice(match[0].length);
  }
  return content;
}
