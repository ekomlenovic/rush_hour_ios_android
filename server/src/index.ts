import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ConfigError, loadConfig } from './config';
import { openDatabase } from './db';
import { workerGenerator } from './generation';
import { buildApp } from './app';

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(`Configuration error: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }

  mkdirSync(config.dataDir, { recursive: true });
  const db = openDatabase(path.join(config.dataDir, 'rush-hours.db'));
  const generator = workerGenerator();
  const { app, challenges } = buildApp({ config, db, generator, logger: true });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await generator.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.port, host: config.host });
  app.log.info({
    name: config.serverName, timeZone: config.timeZone, releaseTime: config.releaseTime,
    difficulty: config.difficultyByWeekday,
  }, 'Rush Hours server ready');
  challenges.start();
}

void main();
