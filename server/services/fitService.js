import FitParser from 'fit-file-parser';
import { deriveActivityId } from './activityId.js';

const SPORT_MAP = {
  running: 'run',
  hiking: 'run',
  cycling: 'other',
  generic: 'other',
  training: 'lift',
  soccer: 'soccer',
  football: 'soccer',
  rock_climbing: 'climb',
  mountaineering: 'climb',
};

function mapSport(sport) {
  if (!sport) return 'other';
  const key = sport.toLowerCase().replace(/\s+/g, '_');
  return SPORT_MAP[key] ?? 'other';
}

// session.start_time is UTC. The top-level activity message sometimes also
// carries local_timestamp alongside its own UTC timestamp — when both are
// present we can derive the device's recorded offset and apply it, the same
// fix as WHOOP/Strava's date derivation. Falls back to the UTC date
// (previous behavior) when the file doesn't carry that pair.
function localDateFromActivity(startTime, activity) {
  if (!startTime) return new Date().toISOString().split('T')[0];
  const utc = activity?.timestamp;
  const local = activity?.local_timestamp;
  if (utc instanceof Date && local instanceof Date) {
    const offsetMs = local.getTime() - utc.getTime();
    return new Date(startTime.getTime() + offsetMs).toISOString().split('T')[0];
  }
  return startTime.toISOString().split('T')[0];
}

export async function parseFitFile(buffer) {
  try {
    const parser = new FitParser({
      force: true,
      speedUnit: 'm/s',
      lengthUnit: 'm',
      mode: 'cascade',
    });

    const data = await parser.parseAsync(buffer);

    const session = data?.sessions?.[0] ?? data?.activity?.sessions?.[0];
    if (!session) return null;

    const sport = session.sport ?? session.sub_sport ?? null;
    const type = mapSport(sport);

    const durationSeconds = Math.round(session.total_elapsed_time ?? session.total_timer_time ?? 0);
    const distanceMeters = session.total_distance ?? null;

    let avgPaceSecondsPerKm = null;
    if (durationSeconds > 0 && distanceMeters > 0) {
      avgPaceSecondsPerKm = durationSeconds / (distanceMeters / 1000);
    }

    const date = localDateFromActivity(session.start_time, data.activity);

    const id = deriveActivityId(date, type, durationSeconds);

    return {
      id,
      type,
      date,
      duration_seconds: durationSeconds,
      distance_meters: distanceMeters,
      avg_pace_seconds_per_km: avgPaceSecondsPerKm,
      avg_hr: session.avg_heart_rate ?? null,
      max_hr: session.max_heart_rate ?? null,
      calories: session.total_calories ?? null,
      elevation_gain_meters: session.total_ascent ?? null,
      cadence: session.avg_cadence ?? null,
      vo2max: session.vo2_max ?? session.estimated_vo2_max ?? null,
      training_load: session.training_load_peak ?? session.training_load ?? null,
      raw_json: JSON.stringify(session),
      synced_at: new Date().toISOString(),
      source: 'fit',
    };
  } catch {
    return null;
  }
}
