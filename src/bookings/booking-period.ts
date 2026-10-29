export const MIN_BOOKING_MINUTES = 15;
export const MAX_BOOKING_HOURS = 12;
/** Tolerated clock skew between client and server when checking "starts in the future". */
export const CLOCK_SKEW_MS = 60_000;

export interface Period {
  startsAt: Date;
  endsAt: Date;
}

/** Business rules for a bookable period. Returns the list of violations (empty when valid). */
export function periodViolations({ startsAt, endsAt }: Period, now: Date): string[] {
  const violations: string[] = [];
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()))
    return ['startsAt and endsAt must be valid dates'];
  const minutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (minutes <= 0) violations.push('endsAt must be after startsAt');
  else if (minutes < MIN_BOOKING_MINUTES)
    violations.push(`bookings last at least ${MIN_BOOKING_MINUTES} minutes`);
  else if (minutes > MAX_BOOKING_HOURS * 60)
    violations.push(`bookings last at most ${MAX_BOOKING_HOURS} hours`);
  if (startsAt.getTime() < now.getTime() - CLOCK_SKEW_MS) violations.push('startsAt must be in the future');
  return violations;
}
