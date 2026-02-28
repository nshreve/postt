#!/usr/bin/env node

import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runLogin } from './commands/login.js';
import { runLogout } from './commands/logout.js';
import { runNew } from './commands/new.js';
import { runEdit } from './commands/edit.js';
import { runList } from './commands/list.js';
import { runPublish } from './commands/publish.js';
import { runStatus } from './commands/status.js';

const program = new Command();

program
  .name('postt')
  .description('A delightful CLI for creating and publishing blogs')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new blog in the current directory')
  .action(runInit);

program
  .command('login')
  .description('Authenticate with your email')
  .action(runLogin);

program
  .command('logout')
  .description('Log out of your account')
  .action(runLogout);

program
  .command('new [title]')
  .description('Create a new blog post')
  .option('-e, --editor', 'Use external $EDITOR instead of built-in editor')
  .action((title: string | undefined, options: { editor?: boolean }) => {
    runNew(title, options.editor);
  });

program
  .command('edit [post]')
  .description('Edit an existing post')
  .option('-e, --editor', 'Use external $EDITOR instead of built-in editor')
  .action((post: string | undefined, options: { editor?: boolean }) => {
    runEdit(post, options.editor);
  });

program
  .command('list')
  .alias('ls')
  .description('List all posts')
  .action(runList);

program
  .command('publish')
  .alias('deploy')
  .description('Publish your blog to the web')
  .action(runPublish);

program
  .command('status')
  .description('Show blog info and status')
  .action(runStatus);

program.parse();
