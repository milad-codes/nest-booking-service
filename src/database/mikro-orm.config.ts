import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, type Options } from '@mikro-orm/postgresql';
import { RefreshToken } from '../auth/refresh-token.entity.js';
import { User } from '../users/user.entity.js';
import { Migration20261028120000Init } from './migrations/Migration20261028120000Init.js';

export const entities = [User, RefreshToken];

/** Migrations are listed explicitly: identical behaviour from TypeScript sources (tests) and compiled output. */
export const migrations = [Migration20261028120000Init];

export function createOrmConfig(databaseUrl: string, overrides: Options = {}): Options {
  return defineConfig({
    clientUrl: databaseUrl,
    entities,
    extensions: [Migrator],
    migrations: { migrationsList: migrations, transactional: true, allOrNothing: true, snapshot: false },
    forceUtcTimezone: true,
    ...overrides,
  });
}
