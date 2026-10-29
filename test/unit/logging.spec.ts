import { Writable } from 'node:stream';
import { pino } from 'pino';
import { REDACT_PATHS, sanitizeRequestId } from '../../src/observability/logging.js';

describe('sanitizeRequestId', () => {
  it('keeps a well-formed caller id', () => {
    expect(sanitizeRequestId('req-123:abc')).toBe('req-123:abc');
  });

  it.each([['has spaces'], ['x'.repeat(129)], ['<script>'], [''], [undefined]])(
    'replaces %j with a UUID',
    (value) => {
      expect(sanitizeRequestId(value)).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  it('uses the first value of a repeated header', () => {
    expect(sanitizeRequestId(['first', 'second'])).toBe('first');
  });
});

describe('log redaction', () => {
  it('never writes credentials or tokens', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logger = pino({ redact: { paths: REDACT_PATHS, censor: '[Redacted]' } }, sink);
    logger.info(
      {
        req: {
          headers: { authorization: 'Bearer secret-access', cookie: 'sid=secret-cookie' },
          body: { password: 'secret-pw' },
        },
        refreshToken: 'secret-refresh',
      },
      'request',
    );
    const output = lines.join('');
    expect(output).not.toMatch(/secret-/);
    expect(output.match(/\[Redacted\]/g)).toHaveLength(4);
  });
});
