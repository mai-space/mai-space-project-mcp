#!/usr/bin/env node
import { startServer } from './server.js';

function getArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : fallback;
}

const port = parseInt(getArg('--port', '3456'), 10);
const host = getArg('--host', 'localhost');
const dbPath = getArg('--db', process.env.MAI_DB_PATH ?? './mai.db');

const server = await startServer({ port, host, dbPath });
console.log(`MAI server running at ${server.url}`);
