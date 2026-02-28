#!/usr/bin/env node

import { Command } from 'commander';
import pkg from '../package.json' assert { type: 'json' };
import { runInit } from './commands/init.js';
import { runLogin } from './commands/login.js';
import { runLogout } from './commands/logout.js';
import { runNew } from './commands/new.js';
import { runEdit } from './commands/edit.js';
import { runList } from './commands/list.js';
import { runPublish } from './commands/publish.js';
import { runStatus } from './commands/status.js';
import { runDelete } from './commands/delete.js';
import { runSettings } from './commands/settings.js';

const program = new Command();

program
  .name('postt')
  .description('A delightful CLI for creating and publishing blogs')
  .version(pkg.version);

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

program
  .command('delete [post]')
  .description('Delete a post')
  .action((post: string | undefined) => {
    runDelete(post);
  });

program
  .command('settings')
  .description('Manage blog settings')
  .action(runSettings);

program.parse();
