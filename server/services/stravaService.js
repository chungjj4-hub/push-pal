import axios from 'axios';
import { getDb } from '../db.js';
import { deriveActivityId } from './activityId.js';

const STRAVA_BASE = 'https://www.strava.com';
const STRAVA_API = 'https://www.strava.com/api/v3';

const SPORT_MAP = {
  run: 'run', trailrun: 'run', virtualrun: 'run', walk: 'run', hike: 'run',
  ride: 'other', virtualride: 'other', mountainbikeride: 'other',
  gravelride: 'other', ebikeride: 'other',
  weighttraining: 'lift', crossfit: 'lift', workout: 'lift',
  soccer: 'soccer', football: 'soccer',
  rockclimbing: 'climb', climbing: 'climb', iceclimbing: 'climb',
};

function mapSport(sport) {
  if (!sport) return 'other';
  return SPORT_MAP[sport.toLowerCase().replace(/[\s_]/g, '')] ?? 'other';
}

function getToken() {
  return getDb().prepare("SELECT * FROM auth_tokens WHERE service = 'strava'").get() ?? null;
}

function saveToken({ access_token, refresh_token, expires_at, expires_in }) {
  const expiresAtIso = expires_at
    ? new Date(expires_at * 1000).toISOString()
    : new Date(Date.now() + (expires_in ?? 21600) * 1000).toISOString();
  getDb().prepare(`
    INSERT INTO auth_tokens (service, access_token, refresh_token, expires_at, updated_at)
    VALUES ('strava', ?, ?, ?, ?)
    ON CONFLICT(service) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `).run(access_token, refresh_token, expiresAtIso, new Date().toISOString());
}

export function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    redirect_uri: `http://localhost:${process.env.PORT ?? 3001}/strava/callback`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  });
  return `${STRAVA_BASE}/oauth/authorize?${params}`;
}

export async function exchangeCode(code) {
  const res = await axios.post(`${STRAVA_BASE}/oauth/token`, {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
  });
  saveToken(res.data);
}

let _refreshPromise = null;
async function refreshToken() {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    const token = getToken();
    if (!token?.refresh_token) throw new Error('No Strava refresh token');
    const res = await axios.post(`${STRAVA_BASE}/oauth/token`, {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    });
    saveToken(res.data);
  })().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

export async function ensureToken() {
  const token = getToken();
  if (!token) throw new Error('Strava not connected');
  const expiresAt = new Date(token.expires_at).getTime();
  if (Date.now() + 5 * 60 * 1000 >= expiresAt) await refreshToken();
}

function activityToRow(a) {
  const type = mapSport(a.sport_type ?? a.type);
  const date = a.start_date?.split('T')[0] ?? new Date().toISOString().split('T')[0];
  const distanceMeters = a.distance ?? null;
  const durationSeconds = a.elapsed_time ?? null;
  const avgPaceSecondsPerKm = (durationSeconds > 0 && distanceMeters > 0)
    ? durationSeconds / (distanceMeters / 1000)
    : null;

  return {
    id: deriveActivityId(date, type, durationSeconds),
    type,
    date,
    duration_seconds: durationSeconds,
    distance_meters: distanceMeters,
    avg_pace_seconds_per_km: avgPaceSecondsPerKm,
    avg_hr: a.average_heartrate ?? null,
    max_hr: a.max_heartrate ?? null,
    calories: a.calories ?? null,
    elevation_gain_meters: a.total_elevation_gain ?? null,
    cadence: a.average_cadence ? Math.round(a.average_cadence * 2) : null, // Strava reports per-leg
    vo2max: null,
    training_load: null,
    raw_json: JSON.stringify(a),
    synced_at: new Date().toISOString(),
    source: 'strava',
  };
}

export async function syncStrava(days = 7) {
  await ensureToken();
  const token = getToken();
  const after = Math.floor((Date.now() - days * 86400000) / 1000);

  const activities = [];
  let page = 1;
  while (true) {
    const res = await axios.get(`${STRAVA_API}/athlete/activities`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      params: { after, per_page: 100, page },
    });
    if (!res.data.length) break;
    activities.push(...res.data);
    if (res.data.length < 100) break;
    page++;
  }

  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO coros_activities
      (id, type, date, duration_seconds, distance_meters, avg_pace_seconds_per_km,
       avg_hr, max_hr, calories, elevation_gain_meters, cadence, vo2max,
       training_load, raw_json, synced_at, source)
    VALUES
      (@id, @type, @date, @duration_seconds, @distance_meters, @avg_pace_seconds_per_km,
       @avg_hr, @max_hr, @calories, @elevation_gain_meters, @cadence, @vo2max,
       @training_load, @raw_json, @synced_at, @source)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type, date = excluded.date,
      duration_seconds = excluded.duration_seconds,
      distance_meters = excluded.distance_meters,
      avg_pace_seconds_per_km = excluded.avg_pace_seconds_per_km,
      avg_hr = excluded.avg_hr, max_hr = excluded.max_hr,
      calories = excluded.calories,
      elevation_gain_meters = excluded.elevation_gain_meters,
      cadence = excluded.cadence,
      raw_json = excluded.raw_json,
      synced_at = excluded.synced_at,
      source = excluded.source
  `);

  db.transaction(() => { for (const a of activities) upsert.run(activityToRow(a)); })();
  return { synced: activities.length };
}

export function hasToken() {
  return !!getToken();
}
