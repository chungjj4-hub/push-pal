export const metersToMiles = m => (m != null ? +(m / 1609.34).toFixed(2) : null);
export const metersToFeet = m => (m != null ? Math.round(m * 3.28084) : null);
export const secPerKmToSecPerMile = s => (s != null ? s * 1.60934 : null);
export const kgToLbs = kg => (kg != null ? +(kg * 2.20462).toFixed(1) : null);
export const celsiusToFahrenheit = c => (c != null ? +(c * 9 / 5 + 32).toFixed(1) : null);

// A bare `utcIso.split('T')[0]` reads the UTC calendar date, which silently
// rolls a late-evening local event onto the next day whenever the source's
// UTC offset is negative (e.g. a 9pm Eastern activity is already after
// midnight UTC). Apply the source's own reported offset first so the date
// matches the calendar day the activity actually happened in, locally.
export function localDateFromOffset(utcIso, offsetStr) {
  if (!utcIso) return null;
  const utcMs = new Date(utcIso).getTime();
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offsetStr ?? '');
  if (!match) return utcIso.split('T')[0]; // no offset available — fall back to the UTC date
  const sign = match[1] === '-' ? -1 : 1;
  const offsetMs = sign * (Number(match[2]) * 60 + Number(match[3])) * 60000;
  return new Date(utcMs + offsetMs).toISOString().split('T')[0];
}

export function formatPaceMinPerMile(secPerKm) {
  if (!secPerKm) return null;
  const secPerMile = secPerKm * 1.60934;
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60).toString().padStart(2, '0');
  return `${m}:${s}/mi`;
}

export function toImperialActivity(a) {
  return {
    id: a.id,
    date: a.date,
    type: a.type,
    source: a.source,
    duration_seconds: a.duration_seconds,
    distance_miles: metersToMiles(a.distance_meters),
    avg_pace_min_per_mile: formatPaceMinPerMile(a.avg_pace_seconds_per_km),
    avg_hr: a.avg_hr,
    max_hr: a.max_hr,
    calories: a.calories,
    elevation_gain_feet: metersToFeet(a.elevation_gain_meters),
    cadence: a.cadence,
    vo2max: a.vo2max,
    training_load: a.training_load,
  };
}
