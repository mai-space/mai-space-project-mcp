#!/usr/bin/env node
import { startServer } from './server.js';

const port = parseInt(process.argv[process.argv.indexOf('--port') + 1] ?? '3456', 10);
const host = process.argv[process.argv.indexOf('--host') + 1] ?? 'localhost';
const dbPath = process.argv[process.argv.indexOf('--db') + 1] ?? process.env.MAI_DB_PATH ?? './mai.db';

const server = await startServer({ port, host, dbPath });
console.log(`MAI server running at ${server.url}`);
