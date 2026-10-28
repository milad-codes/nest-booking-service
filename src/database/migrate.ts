import { MikroORM } from '@mikro-orm/postgresql';
import { createOrmConfig } from './mikro-orm.config.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const orm = await MikroORM.init(createOrmConfig(url));
try {
  const executed = await orm.migrator.up();
  process.stdout.write(`applied ${executed.length} migration(s)\n`);
} finally {
  await orm.close(true);
}
