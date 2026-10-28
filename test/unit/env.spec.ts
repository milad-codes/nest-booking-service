import { validateEnv } from '../../src/config/env.js';

const required = {
  DATABASE_URL: 'postgresql://booking:booking@localhost:5432/booking',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv(required)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      JWT_ACCESS_TTL_SECONDS: 900,
      MIGRATE_ON_START: false,
    });
  });

  it('coerces numbers and booleans', () => {
    const env = validateEnv({ ...required, PORT: '8080', MIGRATE_ON_START: 'true' });
    expect(env.PORT).toBe(8080);
    expect(env.MIGRATE_ON_START).toBe(true);
  });

  it('normalises the bootstrap admin email', () => {
    expect(
      validateEnv({ ...required, BOOTSTRAP_ADMIN_EMAIL: 'Admin@Example.com' }).BOOTSTRAP_ADMIN_EMAIL,
    ).toBe('admin@example.com');
  });

  it('rejects weak secrets and non-postgres URLs, listing every problem', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://x', JWT_ACCESS_SECRET: 'short' })).toThrow(
      /DATABASE_URL.*JWT_ACCESS_SECRET/,
    );
  });
});
