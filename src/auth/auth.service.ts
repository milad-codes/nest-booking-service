import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EntityManager, LockMode } from '@mikro-orm/postgresql';
import { hash, verify } from '@node-rs/argon2';
import { newId, newOpaqueToken, sha256Hex } from '../common/ids.js';
import type { Env } from '../config/env.js';
import { User } from '../users/user.entity.js';
import type { TokenPairDto } from './auth.dto.js';
import { RefreshToken } from './refresh-token.entity.js';

type RefreshOutcome =
  { kind: 'rotated'; user: User; token: string } | { kind: 'reuse' } | { kind: 'expired' };

@Injectable()
export class AuthService {
  /** Verified against for unknown emails, so they cost as much as a wrong password (no enumeration by timing). */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly em: EntityManager,
    private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async register(email: string, password: string): Promise<TokenPairDto> {
    if (await this.em.count(User, { email })) throw new ConflictException('Email is already registered');
    const bootstrapAdmin = this.config.get('BOOTSTRAP_ADMIN_EMAIL', { infer: true });
    const user = this.em.create(User, {
      id: newId(),
      email,
      passwordHash: await hash(password),
      role: bootstrapAdmin === email ? 'admin' : 'member',
    });
    const refreshToken = this.newRefreshToken(user, newId());
    await this.em.flush();
    return this.tokenPair(user, refreshToken);
  }

  async login(email: string, password: string): Promise<TokenPairDto> {
    const user = await this.em.findOne(User, { email });
    this.dummyHash ??= hash(newOpaqueToken());
    const valid = await verify(user?.passwordHash ?? (await this.dummyHash), password).catch(() => false);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');
    const refreshToken = this.newRefreshToken(user, newId());
    await this.em.flush();
    return this.tokenPair(user, refreshToken);
  }

  /**
   * Rotates a refresh token. The row is locked so two concurrent refreshes with the same token
   * cannot both succeed. Presenting a token that was already rotated or revoked is treated as theft:
   * the whole family is revoked and committed before the 401 is returned.
   */
  async refresh(rawToken: string): Promise<TokenPairDto> {
    const outcome = await this.em.transactional<RefreshOutcome>(async (em) => {
      const token = await em.findOne(
        RefreshToken,
        { tokenHash: sha256Hex(rawToken) },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!token) throw new UnauthorizedException('Invalid refresh token');
      const now = new Date();
      if (token.revokedAt) {
        await em.nativeUpdate(
          RefreshToken,
          { familyId: token.familyId, revokedAt: null },
          { revokedAt: now },
        );
        return { kind: 'reuse' };
      }
      if (token.expiresAt <= now) return { kind: 'expired' };

      const user = await em.findOneOrFail(User, token.user.id);
      const next = newOpaqueToken();
      const nextId = newId();
      em.create(RefreshToken, {
        id: nextId,
        user,
        familyId: token.familyId,
        tokenHash: sha256Hex(next),
        expiresAt: this.refreshExpiry(),
      });
      token.revokedAt = now;
      token.replacedById = nextId;
      return { kind: 'rotated', user, token: next };
    });

    if (outcome.kind === 'reuse')
      throw new UnauthorizedException('Refresh token reuse detected; session revoked');
    if (outcome.kind === 'expired') throw new UnauthorizedException('Refresh token expired');
    return this.tokenPair(outcome.user, outcome.token);
  }

  /** Revokes the whole session (token family). Unknown tokens are ignored so logout is idempotent. */
  async logout(rawToken: string): Promise<void> {
    const token = await this.em.findOne(RefreshToken, { tokenHash: sha256Hex(rawToken) });
    if (!token) return;
    await this.em.nativeUpdate(
      RefreshToken,
      { familyId: token.familyId, revokedAt: null },
      { revokedAt: new Date() },
    );
  }

  private newRefreshToken(user: User, familyId: string): string {
    const raw = newOpaqueToken();
    this.em.create(RefreshToken, {
      id: newId(),
      user,
      familyId,
      tokenHash: sha256Hex(raw),
      expiresAt: this.refreshExpiry(),
    });
    return raw;
  }

  private refreshExpiry(): Date {
    const days = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    return new Date(Date.now() + days * 86_400_000);
  }

  private async tokenPair(user: User, refreshToken: string): Promise<TokenPairDto> {
    const expiresIn = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, typ: 'access' },
      { expiresIn },
    );
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn };
  }
}
