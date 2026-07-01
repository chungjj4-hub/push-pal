import { createHash } from 'node:crypto';

// Minute-level bucketing tolerates the few-second discrepancies between how
// different sources (Strava elapsed_time, WHOOP cycle start/end, .fit
// total_elapsed_time) report the duration of the same real-world activity,
// so the same session hashes to the same id regardless of source.
export function deriveActivityId(date, type, durationSeconds) {
  const bucket = Math.round((durationSeconds ?? 0) / 60);
  const raw = `${date}|${type}|${bucket}`;
  return createHash('sha1').update(raw).digest('hex').slice(0, 16);
}
