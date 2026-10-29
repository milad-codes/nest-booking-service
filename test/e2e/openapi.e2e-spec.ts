import { createTestContext, type TestContext } from './helpers.js';

describe('OpenAPI (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('serves a complete document without authentication', async () => {
    const { body } = await ctx.http().get('/docs/openapi.json').expect(200);
    expect(body.openapi).toMatch(/^3\./);
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining([
        '/auth/login',
        '/auth/refresh',
        '/bookings',
        '/bookings/{id}/cancel',
        '/resources/{id}/availability',
      ]),
    );
    expect(body.paths['/metrics']).toBeUndefined();
    expect(body.components.securitySchemes.bearer).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(body.components.schemas.CreateBookingDto.required).toEqual(
      expect.arrayContaining(['resourceId', 'startsAt', 'endsAt']),
    );
  });

  it('serves Swagger UI', async () => {
    const res = await ctx.http().get('/docs').redirects(1).expect(200);
    expect(res.text).toContain('swagger-ui');
  });
});
