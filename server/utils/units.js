export const metersToMiles = m => (m != null ? +(m / 1609.34).toFixed(2) : null);
export const metersToFeet = m => (m != null ? Math.round(m * 3.28084) : null);
export const secPerKmToSecPerMile = s => (s != null ? s * 1.60934 : null);
export const kgToLbs = kg => (kg != null ? +(kg * 2.20462).toFixed(1) : null);
export const celsiusToFahrenheit = c => (c != null ? +(c * 9 / 5 + 32).toFixed(1) : null);

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
