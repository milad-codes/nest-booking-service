import { defineEntity, p } from '@mikro-orm/postgresql';
import { User } from '../users/user.entity.js';

/**
 * Only the SHA-256 hash of a refresh token is stored. Tokens issued by rotation share a familyId,
 * so presenting an already-rotated token can revoke every descendant (reuse detection).
 */
const RefreshTokenSchema = defineEntity({
  name: 'RefreshToken',
  tableName: 'refresh_tokens',
  properties: {
    id: p.uuid().primary(),
    user: () => p.manyToOne(User).deleteRule('cascade'),
    familyId: p.uuid().index(),
    tokenHash: p.string().length(64).unique(),
    expiresAt: p.datetime(),
    createdAt: p.datetime().onCreate(() => new Date()),
    revokedAt: p.datetime().nullable(),
    replacedById: p.uuid().nullable(),
  },
});

export class RefreshToken extends RefreshTokenSchema.class {}
RefreshTokenSchema.setClass(RefreshToken);
