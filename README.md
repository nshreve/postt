# postt

A delightful CLI for creating and publishing blogs straight from your terminal.

## Installation

```bash
npm install -g postt
```

## Quick Start

```bash
# Create a new blog
postt init

# Write your first post
postt new "My First Post"

# Publish to the web
postt publish
```

## Commands

| Command | Description |
|---------|-------------|
| `postt init` | Set up a new blog in the current directory |
| `postt login` | Sign in with your email |
| `postt logout` | Sign out |
| `postt new [title]` | Create a new post |
| `postt edit [post]` | Edit an existing post |
| `postt list` | List all your posts |
| `postt publish` | Deploy your blog to the web |
| `postt status` | Show blog info and URL |

### Options

- `postt new -e` / `postt edit -e` — Use your `$EDITOR` instead of the built-in editor

## How It Works

Run `postt init` to set up a new blog. You'll pick a name and get a `yourname.postt.io` subdomain. Authentication is passwordless — just enter your email and click the link.

Your posts live as plain Markdown files in a local `posts/` directory. Write with `postt new`, edit with `postt edit`, and deploy with `postt publish`. Deleting a local post file and re-running `postt publish` removes it from your live blog too.

## Post Format

Posts are Markdown files with YAML frontmatter:

```markdown
---
title: Hello World
date: 2024-01-15
status: published
---

Your content here...
```

## Project Structure

```
my-blog/
├── .postt          # Blog ID (commit this for cross-machine sync)
└── posts/          # Your Markdown posts
    ├── hello-world.md
    └── another-post.md
```

## Development

```bash
npm install
npm run build
npm run dev        # Watch mode
```

### API (Cloudflare Worker)

```bash
cd api
npm install
npm run dev
```

### Blog serving worker

```bash
cd blogs-worker
npm install
npm run dev
```

## Environment Variables

### CLI
- `BLOG_API_URL` — Override the API endpoint (default: `https://postt-api.orangestudio.workers.dev`)

### API worker (set via `wrangler secret put`)
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`

## Tech Stack

- **CLI**: Node.js + TypeScript + [Ink](https://github.com/vadimdemedes/ink)
- **Auth**: Supabase (magic link email)
- **Database**: Supabase (PostgreSQL)
- **API**: Cloudflare Workers + Hono
- **Hosting**: Cloudflare KV

## License

MIT
