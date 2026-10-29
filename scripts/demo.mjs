#!/usr/bin/env node
// Walks through the API with synthetic data: accounts, a room, an idempotent booking, a conflict, a cancellation.
// Start the stack first (`docker compose up --build`), then run `npm run demo`.
// API_URL defaults to http://localhost:3000; BOOTSTRAP_ADMIN_EMAIL must match the server's (compose default below).
import { randomUUID } from 'node:crypto';

const api = process.env.API_URL ?? 'http://localhost:3000';
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.com';
const password = 'demo-password-not-secret';
const run = randomUUID().slice(0, 8);

async function call(method, path, { token, body, headers = {} } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
}

function step(title, { status, body }, expected) {
  const ok = expected.includes(status);
  console.log(`${ok ? '✓' : '✗'} ${title}: ${status}${body?.detail ? ` (${body.detail})` : ''}`);
  if (!ok) {
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }
}

async function account(email) {
  const registered = await call('POST', '/auth/register', { body: { email, password } });
  if (registered.status === 201) return registered.body.accessToken;
  const login = await call('POST', '/auth/login', { body: { email, password } });
  if (login.status !== 200) {
    console.error(
      `Cannot sign in as ${email}; if it was registered earlier with another password, reset the database.`,
    );
    process.exit(1);
  }
  return login.body.accessToken;
}

const health = await call('GET', '/health/ready').catch(() => null);
if (health?.status !== 200) {
  console.error(`No ready API at ${api}. Start it with: docker compose up --build`);
  process.exit(1);
}

const admin = await account(adminEmail);
const ada = await account(`ada-${run}@example.com`);
const grace = await account(`grace-${run}@example.com`);
console.log(`signed in as ${adminEmail} (admin) and two synthetic members`);

const room = await call('POST', '/resources', {
  token: admin,
  body: { name: `Demo room ${run}`, description: 'synthetic demo data' },
});
step('admin creates a room', room, [201]);

const day = new Date();
day.setUTCDate(day.getUTCDate() + 1);
const at = (hour, minute = 0) =>
  new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute)).toISOString();
const slot = { resourceId: room.body.id, startsAt: at(9), endsAt: at(10) };

const key = randomUUID();
const first = await call('POST', '/bookings', {
  token: ada,
  body: slot,
  headers: { 'idempotency-key': key },
});
step('Ada books 09:00-10:00 UTC tomorrow', first, [201]);
const retry = await call('POST', '/bookings', {
  token: ada,
  body: slot,
  headers: { 'idempotency-key': key },
});
step(
  `Ada's client retries with the same Idempotency-Key (replayed: ${retry.headers.get('idempotent-replayed')})`,
  retry,
  [201],
);
console.log(`  same booking returned: ${retry.body.id === first.body.id}`);

const overlap = { resourceId: room.body.id, startsAt: at(9, 30), endsAt: at(10, 30) };
step(
  'Grace tries 09:30-10:30 (overlaps)',
  await call('POST', '/bookings', { token: grace, body: overlap }),
  [409],
);

const busy = await call('GET', `/resources/${room.body.id}/availability?from=${at(0)}&to=${at(23)}`, {
  token: grace,
});
step(
  `availability shows ${Array.isArray(busy.body) ? busy.body.length : 0} busy interval(s), without names`,
  busy,
  [200],
);

const etag = (await call('GET', `/bookings/${first.body.id}`, { token: ada })).headers.get('etag');
const cancel = await call('POST', `/bookings/${first.body.id}/cancel`, {
  token: ada,
  headers: { 'if-match': etag },
});
step(`Ada cancels with If-Match ${etag}`, cancel, [200]);
const stale = await call('POST', `/bookings/${first.body.id}/cancel`, {
  token: ada,
  headers: { 'if-match': etag },
});
step('a second cancel with the old ETag', stale, [412]);

step(
  'Grace books 09:30-10:30 now that the slot is free',
  await call('POST', '/bookings', { token: grace, body: overlap }),
  [201],
);
console.log(`\nOpenAPI docs: ${api}/docs`);
