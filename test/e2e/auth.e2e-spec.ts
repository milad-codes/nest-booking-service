import { ADMIN_EMAIL, createTestContext, register, type TestContext } from './helpers.js';

describe('auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('registers, logs in and reads the current user', async () => {
    const { accessToken } = await register(ctx, 'Ada@Example.com');
    const me = await ctx.http().get('/users/me').auth(accessToken, { type: 'bearer' }).expect(200);
    expect(me.body).toMatchObject({ email: 'ada@example.com', role: 'member' });

    const login = await ctx
      .http()
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'correct horse battery staple' })
      .expect(200);
    expect(login.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
  });

  it('makes the bootstrap email an admin', async () => {
    const { accessToken } = await register(ctx, ADMIN_EMAIL);
    const me = await ctx.http().get('/users/me').auth(accessToken, { type: 'bearer' }).expect(200);
    expect(me.body.role).toBe('admin');
  });

  it('rejects duplicate emails, bad credentials and missing tokens with problem+json', async () => {
    await register(ctx, 'grace@example.com');
    const dup = await ctx
      .http()
      .post('/auth/register')
      .send({ email: 'grace@example.com', password: 'another long password' })
      .expect(409);
    expect(dup.headers['content-type']).toContain('application/problem+json');

    await ctx
      .http()
      .post('/auth/login')
      .send({ email: 'grace@example.com', password: 'wrong password!!' })
      .expect(401);
    await ctx
      .http()
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever password' })
      .expect(401);
    await ctx.http().get('/users/me').expect(401);
  });

  it('validates input and lists every problem', async () => {
    const res = await ctx
      .http()
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/email/), expect.stringMatching(/password/)]),
    );
  });

  it('rotates refresh tokens and revokes the family when an old token is replayed', async () => {
    const first = await register(ctx, 'linus@example.com');
    const second = (
      await ctx.http().post('/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200)
    ).body;
    expect(second.refreshToken).not.toBe(first.refreshToken);

    const reuse = await ctx
      .http()
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);
    expect(reuse.body.detail).toMatch(/reuse detected/);
    // the legitimate successor was revoked too, so a stolen token can't keep a session alive
    await ctx.http().post('/auth/refresh').send({ refreshToken: second.refreshToken }).expect(401);
  });

  it('lets only one of two concurrent refreshes with the same token succeed', async () => {
    const { refreshToken } = await register(ctx, 'barbara@example.com');
    const results = await Promise.all(
      [0, 1].map(() => ctx.http().post('/auth/refresh').send({ refreshToken })),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it('logs out by revoking the session', async () => {
    const { refreshToken } = await register(ctx, 'margaret@example.com');
    await ctx.http().post('/auth/logout').send({ refreshToken }).expect(204);
    await ctx.http().post('/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('reports readiness with the database', async () => {
    await ctx.http().get('/health/ready').expect(200, { status: 'ok', database: 'up' });
  });
});
