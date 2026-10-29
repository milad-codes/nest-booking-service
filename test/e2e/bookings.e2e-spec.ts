import { randomUUID } from 'node:crypto';
import { ADMIN_EMAIL, createTestContext, register, type TestContext } from './helpers.js';

/** Midnight UTC two days from now, so every test period is in the future. */
const base = (() => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 2);
})();
const at = (hours: number) => new Date(base + hours * 3_600_000).toISOString();

describe('resources and bookings (e2e)', () => {
  let ctx: TestContext;
  let admin: string;
  let alice: string;
  let bob: string;
  let room: string;

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const book = (token: string, startHour: number, endHour: number, extra: Record<string, unknown> = {}) =>
    ctx
      .http()
      .post('/bookings')
      .set(as(token))
      .send({ resourceId: room, startsAt: at(startHour), endsAt: at(endHour), ...extra });

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = (await register(ctx, ADMIN_EMAIL)).accessToken;
    alice = (await register(ctx, 'alice@example.com')).accessToken;
    bob = (await register(ctx, 'bob@example.com')).accessToken;
    room = (
      await ctx
        .http()
        .post('/resources')
        .set(as(admin))
        .send({ name: 'Room Isar', description: '8 seats' })
        .expect(201)
    ).body.id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  describe('resources', () => {
    it('lets only admins create resources', async () => {
      await ctx.http().post('/resources').set(as(alice)).send({ name: 'Room Spree' }).expect(403);
      const dup = await ctx.http().post('/resources').set(as(admin)).send({ name: 'Room Isar' }).expect(409);
      expect(dup.body.status).toBe(409);
    });

    it('hides inactive resources from members and refuses bookings on them', async () => {
      const desk = (await ctx.http().post('/resources').set(as(admin)).send({ name: 'Desk 12' }).expect(201))
        .body.id;
      await ctx.http().patch(`/resources/${desk}`).set(as(admin)).send({ active: false }).expect(200);
      const list = await ctx.http().get('/resources').set(as(alice)).expect(200);
      expect(list.body.map((r: { name: string }) => r.name)).not.toContain('Desk 12');
      await ctx
        .http()
        .post('/bookings')
        .set(as(alice))
        .send({ resourceId: desk, startsAt: at(1), endsAt: at(2) })
        .expect(404);
    });
  });

  describe('booking rules', () => {
    it('rejects overlaps with 409 BOOKING_OVERLAP but allows adjacent periods', async () => {
      await book(alice, 9, 10).expect(201);
      const clash = await book(bob, 9.5, 10.5).expect(409);
      expect(clash.headers['content-type']).toContain('application/problem+json');
      expect(clash.body.code).toBe('BOOKING_OVERLAP');
      await book(bob, 10, 11).expect(201); // [09,10) and [10,11) touch but do not overlap
    });

    it('validates periods with 422 and payloads with 400', async () => {
      const tooShort = await book(alice, 12, 12.1).expect(422);
      expect(tooShort.body.errors.join()).toMatch(/at least 15 minutes/);
      await ctx
        .http()
        .post('/bookings')
        .set(as(alice))
        .send({ resourceId: room, startsAt: 'tomorrow' })
        .expect(400);
    });

    it('frees the slot on cancel and guards cancel with If-Match', async () => {
      const created = (await book(alice, 14, 15).expect(201)).body;
      const fetched = await ctx.http().get(`/bookings/${created.id}`).set(as(alice)).expect(200);
      expect(fetched.headers.etag).toBe('"1"');
      await ctx
        .http()
        .post(`/bookings/${created.id}/cancel`)
        .set(as(alice))
        .set('If-Match', '"7"')
        .expect(412);
      const cancelled = await ctx
        .http()
        .post(`/bookings/${created.id}/cancel`)
        .set(as(alice))
        .set('If-Match', '"1"')
        .expect(200);
      expect(cancelled.body).toMatchObject({ status: 'cancelled', version: 2 });
      await book(bob, 14, 15).expect(201);
    });

    it("doesn't reveal other people's bookings", async () => {
      const mine = (await book(alice, 16, 17).expect(201)).body;
      await ctx.http().get(`/bookings/${mine.id}`).set(as(bob)).expect(404);
      await ctx.http().get(`/bookings/${mine.id}`).set(as(admin)).expect(200);
    });
  });

  it('creates exactly one booking out of 10 concurrent requests for the same slot', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => book(i % 2 ? alice : bob, 20, 21)),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
  });

  describe('idempotency', () => {
    it('replays the first response for a retried request', async () => {
      const key = randomUUID();
      const first = await book(alice, 30, 31).set('Idempotency-Key', key).expect(201);
      const retry = await book(alice, 30, 31).set('Idempotency-Key', key).expect(201);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.body.id).toBe(first.body.id);
    });

    it('rejects a reused key with a different payload', async () => {
      const key = randomUUID();
      await book(alice, 32, 33).set('Idempotency-Key', key).expect(201);
      await book(alice, 34, 35).set('Idempotency-Key', key).expect(422);
    });

    it('releases the key when the request fails, so a corrected retry can succeed', async () => {
      const key = randomUUID();
      await book(alice, 36, 36.1).set('Idempotency-Key', key).expect(422);
      await book(alice, 36, 37).set('Idempotency-Key', key).expect(201);
    });

    it('scopes keys per user', async () => {
      const key = randomUUID();
      await book(alice, 38, 39).set('Idempotency-Key', key).expect(201);
      await book(bob, 40, 41).set('Idempotency-Key', key).expect(201);
    });
  });

  it('pages through bookings with an opaque cursor, without gaps or duplicates', async () => {
    const carol = (await register(ctx, 'carol@example.com')).accessToken;
    const created: string[] = [];
    for (let h = 50; h < 55; h += 1) created.push((await book(carol, h, h + 1).expect(201)).body.id);
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await ctx
        .http()
        .get('/bookings')
        .query({ limit: 2, ...(cursor ? { cursor } : {}) })
        .set(as(carol))
        .expect(200);
      seen.push(...page.body.items.map((b: { id: string }) => b.id));
      cursor = page.body.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toEqual(created);
  });

  describe('concurrency and input regressions', () => {
    it('rejects a malformed cursor with 400 instead of a server error', async () => {
      const res = await ctx.http().get('/bookings').query({ cursor: 'not-a-cursor' }).set(as(alice));
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const forged = Buffer.from(JSON.stringify(['yesterday', 'x'])).toString('base64url');
      await ctx.http().get('/bookings').query({ cursor: forged }).set(as(alice)).expect(400);
    });

    it('answers concurrent cancellations of one booking with 200, not a server error', async () => {
      const created = (await book(alice, 60, 61).expect(201)).body;
      const results = await Promise.all(
        Array.from({ length: 5 }, () => ctx.http().post(`/bookings/${created.id}/cancel`).set(as(alice))),
      );
      expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      for (const r of results) expect(r.body).toMatchObject({ status: 'cancelled', version: 2 });
    });

    it('lets exactly one of several concurrent If-Match cancellations win; the rest get 412', async () => {
      const created = (await book(alice, 62, 63).expect(201)).body;
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          ctx.http().post(`/bookings/${created.id}/cancel`).set(as(alice)).set('If-Match', '"1"'),
        ),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 412, 412, 412, 412]);
    });

    it('accepts If-Match: * as "any current version"', async () => {
      const created = (await book(alice, 64, 65).expect(201)).body;
      await ctx.http().post(`/bookings/${created.id}/cancel`).set(as(alice)).set('If-Match', '*').expect(200);
    });
  });

  it('reports busy intervals without exposing who booked', async () => {
    const res = await ctx
      .http()
      .get(`/resources/${room}/availability`)
      .query({ from: at(0), to: at(24) })
      .set(as(bob))
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(Object.keys(res.body[0]).sort()).toEqual(['endsAt', 'startsAt']);
  });
});
