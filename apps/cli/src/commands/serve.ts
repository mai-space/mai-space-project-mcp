import type { Command } from 'commander';

export function registerServeCommand(program: Command) {
  program
    .command('serve')
    .description('Start the MAI server')
    .option('--port <port>', 'Port number', '3456')
    .option('--host <host>', 'Host address', 'localhost')
    .option('--db <path>', 'Database file path')
    .action(async (opts) => {
      const { startServer } = await import('@mai-space/server');
      const server = await startServer({
        port: Number(opts.port),
        host: opts.host,
        dbPath: opts.db,
      });
      console.log(`MAI server running at ${server.url}`);
    });
}
