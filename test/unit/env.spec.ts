import { validateEnv } from '../../src/config/env.js';

describe('validateEnv', () => {
  it('applies defaults', () => {
    expect(validateEnv({})).toMatchObject({ NODE_ENV: 'development', PORT: 3000, LOG_LEVEL: 'info' });
  });

  it('coerces numeric strings', () => {
    expect(validateEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('lists every invalid variable', () => {
    expect(() => validateEnv({ PORT: 'abc', NODE_ENV: 'staging' })).toThrow(/PORT.*NODE_ENV|NODE_ENV.*PORT/);
  });
});
