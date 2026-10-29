import { ADMIN_EMAIL, createTestContext, register, type TestContext } from './helpers.js';

const METRICS_TOKEN = vi.hoisted(() => {
  // must be set before AppModule (and its env validation) is imported
  process.env.METRICS_TOKEN = 'metrics-token-for-tests';
  return process.env.METRICS_TOKEN;
});

describe('observability (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const scrape = () => ctx.http().get('/metrics').set('Authorization', `Bearer ${METRICS_TOKEN}`).expect(200);

  it('echoes a valid x-request-id and puts it into problem documents', async () => {
    const res = await ctx.http().get('/users/me').set('x-request-id', 'trace-abc_123').expect(401);
    expect(res.headers['x-request-id']).toBe('trace-abc_123');
    expect(res.body.requestId).toBe('trace-abc_123');
  });

  it('generates a request id when none or an unsafe one is sent', async () => {
    const plain = await ctx.http().get('/health/live').expect(200);
    expect(plain.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const unsafe = await ctx.http().get('/health/live').set('x-request-id', 'a b c').expect(200);
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('requires the metrics token when one is configured', async () => {
    await ctx.http().get('/metrics').expect(401);
    await ctx.http().get('/metrics').set('Authorization', 'Bearer wrong-token-wrong-token').expect(401);
    const res = await scrape();
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('process_cpu_user_seconds_total');
  });

  it('labels latency by route template, never by raw id', async () => {
    const { accessToken } = await register(ctx, 'metrics@example.com');
    const id = '0b6c7f0e-5e7b-4c55-9a2f-3f1d2c4b5a69';
    await ctx.http().get(`/bookings/${id}`).auth(accessToken, { type: 'bearer' }).expect(404);
    await ctx.http().get('/does-not-exist').expect(404);
    const { text } = await scrape();
    expect(text).toMatch(
      /http_request_duration_seconds_count\{method="GET",route="\/bookings\/:id",status_code="404"\} 1/,
    );
    expect(text).toContain('route="unmatched"');
    expect(text).not.toContain(id);
  });

  it('counts created bookings and conflicts', async () => {
    const admin = (await register(ctx, ADMIN_EMAIL)).accessToken;
    const member = (await register(ctx, 'counter@example.com')).accessToken;
    const resourceId = (
      await ctx
        .http()
        .post('/resources')
        .auth(admin, { type: 'bearer' })
        .send({ name: 'Metrics room' })
        .expect(201)
    ).body.id;
    const start = new Date(Date.now() + 2 * 86_400_000);
    const body = {
      resourceId,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
    };
    await ctx.http().post('/bookings').auth(member, { type: 'bearer' }).send(body).expect(201);
    await ctx.http().post('/bookings').auth(member, { type: 'bearer' }).send(body).expect(409);
    const { text } = await scrape();
    expect(text).toMatch(/^bookings_created_total 1$/m);
    expect(text).toMatch(/^booking_conflicts_total 1$/m);
  });
});
