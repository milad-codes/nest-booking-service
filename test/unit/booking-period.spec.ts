import { periodViolations } from '../../src/bookings/booking-period.js';

const now = new Date('2030-01-01T08:00:00Z');
const at = (iso: string) => new Date(iso);

describe('periodViolations', () => {
  it('accepts a one-hour future booking', () => {
    expect(
      periodViolations({ startsAt: at('2030-01-01T09:00:00Z'), endsAt: at('2030-01-01T10:00:00Z') }, now),
    ).toEqual([]);
  });

  it.each([
    ['end before start', '2030-01-01T10:00:00Z', '2030-01-01T09:00:00Z', /after startsAt/],
    ['too short', '2030-01-01T09:00:00Z', '2030-01-01T09:10:00Z', /at least 15 minutes/],
    ['too long', '2030-01-01T09:00:00Z', '2030-01-01T22:00:00Z', /at most 12 hours/],
    ['in the past', '2029-12-31T09:00:00Z', '2029-12-31T10:00:00Z', /in the future/],
  ])('rejects %s', (_case, start, end, message) => {
    expect(periodViolations({ startsAt: at(start), endsAt: at(end) }, now).join()).toMatch(message);
  });

  it('tolerates one minute of clock skew', () => {
    const start = new Date(now.getTime() - 30_000);
    expect(periodViolations({ startsAt: start, endsAt: new Date(start.getTime() + 3_600_000) }, now)).toEqual(
      [],
    );
  });
});
