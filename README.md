# CLI Blog

A delightful CLI for creating and publishing blogs with a beautiful terminal experience.

## Features

- In-terminal Markdown editor with syntax highlighting
- GitHub authentication
- Fast deploys to Cloudflare Pages (~5-10 seconds)
- Free subdomain hosting (`yourname.cliblog.com`)
- Draft and published post states

## Installation

```bash
npm install -g @cliblog/cli
```

## Quick Start

```bash
# Initialize a new blog
blog init

# Create a new post
blog new "My First Post"

# List all posts
blog list

# Publish your blog
blog publish
```

## Commands

| Command | Description |
|---------|-------------|
| `blog init` | Initialize a new blog in the current directory |
| `blog login` | Authenticate with GitHub |
| `blog new [title]` | Create a new post |
| `blog edit [post]` | Edit an existing post |
| `blog list` | List all posts |
| `blog publish` | Deploy your blog |
| `blog status` | Show blog info and URL |

### Options

- `blog new -e` / `blog edit -e` - Use external `$EDITOR` instead of built-in editor

## Project Structure

```
my-blog/
├── blog.json          # Blog configuration
├── posts/             # Your blog posts
│   ├── hello-world.md
│   └── another-post.md
└── public/            # Static assets
    └── images/
```

## Post Format

Posts use Markdown with YAML frontmatter:

```markdown
---
title: Hello World
date: 2024-01-15
status: published
---

Your content here...
```

## Development

```bash
# Install dependencies
npm install

# Build CLI
npm run build

# Run locally
npm start

# Watch mode
npm run dev
```

### API Development

```bash
cd api
npm install
npm run dev
```

## Tech Stack

- **CLI**: Node.js + TypeScript + Ink (React for CLI)
- **Auth**: Supabase Auth (GitHub OAuth)
- **Database**: Supabase (PostgreSQL)
- **API**: Cloudflare Workers
- **Hosting**: Cloudflare Pages

## Environment Variables

### CLI
- `BLOG_API_URL` - API endpoint (default: `http://localhost:8787`)

### API (set in Cloudflare dashboard)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `GITHUB_CLIENT_ID` - GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth app client secret
- `JWT_SECRET` - Secret for JWT signing
- `CF_API_TOKEN` - Cloudflare API token for Pages deployment
- `CF_ACCOUNT_ID` - Cloudflare account ID
- `APP_URL` - API URL for OAuth redirects

## License

MIT
