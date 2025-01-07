#!/usr/bin/env node
import { Command } from 'commander';
import { login, logout } from '../commands/auth.js';
import { init } from '../commands/init.js';
import { startShell } from '../commands/shell.js';

const program = new Command();

program
  .name('puter')
  .description('CLI tool for Puter cloud platform')
  .version('1.0.0');

program
  .command('login')
  .description('Login to Puter account')
  .action(login);

program
  .command('logout')
  .description('Logout from Puter account')
  .action(logout);

program
  .command('init')
  .description('Initialize a new Puter app')
  .action(init);

program
  .command('shell')
  .description('Start interactive shell')
  .action(startShell);

if (process.argv.length === 2) {
  startShell();
} else {
  program.parse();
}