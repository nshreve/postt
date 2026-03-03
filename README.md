# postt

A delightful CLI for creating and publishing blogs straight from your terminal.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/nshreve/postt/main/install.sh | sh
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

## How It Works

Run `postt init` to create a new blog. You'll pick a title, choose a subdomain, and get a live `yourname.postt.io` URL. Authentication is passwordless — just enter your email and click the magic link.

Your posts live as plain Markdown files in a local `posts/` directory. Write with `postt new`, edit with `postt edit`, and deploy with `postt publish`. Removing a post file and re-running `postt publish` removes it from your live blog too.

If you delete your local blog folder, run `postt connect <subdomain>` in any directory to re-link it to your existing blog and restore your posts.

## Commands

| Command                     | Description                                 |
| --------------------------- | ------------------------------------------- |
| `postt init`                | Set up a new blog in the current directory  |
| `postt connect [subdomain]` | Connect this directory to an existing blog  |
| `postt login`               | Sign in with your email                     |
| `postt logout`              | Sign out                                    |
| `postt new [title]`         | Create a new post                           |
| `postt edit [post]`         | Edit an existing post                       |
| `postt list`                | List all posts                              |
| `postt publish`             | Deploy your blog to the web                 |
| `postt status`              | Show blog info and URL                      |
| `postt delete [post]`       | Delete a post                               |
| `postt settings`            | Change title, subdomain, or delete the blog |

### Options

- `postt new -e` / `postt edit -e` — Use your `$EDITOR` instead of the built-in editor
- `postt list` is also aliased as `postt ls`
- `postt publish` is also aliased as `postt deploy`

## Post Format

Posts are plain Markdown with YAML frontmatter:

```markdown
---
title: Hello World
date: 2024-01-15
status: published
---

Your content here...
```

`status` is either `draft` or `published`. Only published posts appear on your live blog.

## Project Structure

```
my-blog/
├── .postt          # Blog ID — commit this for cross-machine sync
└── posts/          # Your Markdown posts
    ├── hello-world.md
    └── another-post.md
```

The `.postt` file contains your blog's ID. Commit it to version control so you can clone the repo on another machine and run `postt publish` without re-running `postt init`.

## Settings

Run `postt settings` to:

- Change your blog title
- Change your subdomain (updates your live URL)
- Delete your blog entirely

## License

MIT
