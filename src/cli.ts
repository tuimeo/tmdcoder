import { createCLI } from './cli/commands.js';
import { Logger } from './utils/index.js';

async function main(): Promise<void> {
  try {
    const program = createCLI();
    await program.parseAsync(process.argv);
  } catch (error) {
    Logger.error('CLI execution failed', error instanceof Error ? error : { error });
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', () => {
  Logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

await main();