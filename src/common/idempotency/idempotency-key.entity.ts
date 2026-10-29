import { defineEntity, p } from '@mikro-orm/postgresql';
import { User } from '../../users/user.entity.js';

/** One row per (user, Idempotency-Key). statusCode is null while the first request is still running. */
const IdempotencyKeySchema = defineEntity({
  name: 'IdempotencyKey',
  tableName: 'idempotency_keys',
  properties: {
    id: p.uuid().primary(),
    user: () => p.manyToOne(User).deleteRule('cascade'),
    key: p.string().length(255),
    requestHash: p.string().length(64),
    statusCode: p.integer().nullable(),
    responseBody: p.json<unknown>().nullable(),
    createdAt: p.datetime().onCreate(() => new Date()),
    expiresAt: p.datetime(),
  },
  uniques: [{ properties: ['user', 'key'] }],
});

export class IdempotencyKey extends IdempotencyKeySchema.class {}
IdempotencyKeySchema.setClass(IdempotencyKey);
