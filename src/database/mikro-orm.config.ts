import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, type Options } from '@mikro-orm/postgresql';
import { RefreshToken } from '../auth/refresh-token.entity.js';
import { Booking } from '../bookings/booking.entity.js';
import { IdempotencyKey } from '../common/idempotency/idempotency-key.entity.js';
import { Resource } from '../resources/resource.entity.js';
import { User } from '../users/user.entity.js';
import { Migration20261028120000Init } from './migrations/Migration20261028120000Init.js';
import { Migration20261028130000Bookings } from './migrations/Migration20261028130000Bookings.js';

export const entities = [User, RefreshToken, Resource, Booking, IdempotencyKey];

/** Migrations are listed explicitly: identical behaviour from TypeScript sources (tests) and compiled output. */
export const migrations = [Migration20261028120000Init, Migration20261028130000Bookings];

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
