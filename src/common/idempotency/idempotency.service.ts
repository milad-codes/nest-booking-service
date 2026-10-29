import { Injectable } from '@nestjs/common';
import { EntityManager, UniqueConstraintViolationException } from '@mikro-orm/postgresql';
import { newId } from '../ids.js';
import { IdempotencyKey } from './idempotency-key.entity.js';

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyDecision =
  | { kind: 'new'; id: string }
  | { kind: 'replay'; statusCode: number; body: unknown }
  | { kind: 'mismatch' }
  | { kind: 'in-progress' };

/**
 * Reserves an Idempotency-Key with an INSERT guarded by a unique constraint, so two concurrent requests
 * with the same key cannot both run the handler. Uses its own forked EntityManager so the caller's
 * unit of work is never polluted by a failed insert.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly em: EntityManager) {}

  async begin(
    userId: string,
    key: string,
    requestHash: string,
    now = new Date(),
  ): Promise<IdempotencyDecision> {
    const em = this.em.fork();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const id = newId();
      try {
        await em.insert(IdempotencyKey, {
          id,
          user: userId,
          key,
          requestHash,
          statusCode: null,
          responseBody: null,
          createdAt: now,
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        });
        return { kind: 'new', id };
      } catch (error) {
        if (!(error instanceof UniqueConstraintViolationException)) throw error;
      }
      const existing = await em.findOne(IdempotencyKey, { user: userId, key }, { refresh: true });
      if (!existing) continue; // released between our insert and read: try once more
      if (existing.expiresAt <= now) {
        await em.nativeDelete(IdempotencyKey, { id: existing.id, expiresAt: { $lte: now } });
        continue;
      }
      if (existing.requestHash !== requestHash) return { kind: 'mismatch' };
      if (existing.statusCode === null || existing.statusCode === undefined) return { kind: 'in-progress' };
      return { kind: 'replay', statusCode: existing.statusCode, body: existing.responseBody };
    }
    return { kind: 'in-progress' };
  }

  async complete(id: string, statusCode: number, body: unknown): Promise<void> {
    await this.em.fork().nativeUpdate(IdempotencyKey, { id }, { statusCode, responseBody: body });
  }

  /** Failed attempts free the key so the client can retry (only successful responses are replayed). */
  async release(id: string): Promise<void> {
    await this.em.fork().nativeDelete(IdempotencyKey, { id });
  }
}
