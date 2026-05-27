#!/usr/bin/env node
import { Command } from 'commander';
import { Database } from '@mai-space/db';
import { TaskOrchestrator } from '@mai-space/core';
import { registerProjectCommands } from './commands/projects.js';
import { registerTaskCommands } from './commands/tasks.js';
import { registerServeCommand } from './commands/serve.js';

const program = new Command();

program
  .name('mai')
  .description('AI Agent Task Orchestration System')
  .version('0.1.0')
  .option('--db <path>', 'Database file path')
  .option('--json', 'Output as JSON');

function getDbPath(): string {
  return program.opts().db ?? process.env.MAI_DB_PATH ?? './mai.db';
}

function createOrchestrator(): TaskOrchestrator {
  const db = new Database(getDbPath());
  return new TaskOrchestrator(db);
}

registerProjectCommands(program, createOrchestrator);
registerTaskCommands(program, createOrchestrator);
registerServeCommand(program);

program.parse(process.argv);
