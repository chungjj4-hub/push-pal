import axios from 'axios';
import { getDb } from '../db.js';
import { deriveActivityId } from './activityId.js';

const WHOOP_BASE = 'https://api.prod.whoop.com';
const SCOPES = 'read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement offline';

const WHOOP_SPORT_MAP = {
  running: 'run', trail_running: 'run', treadmill_running: 'run', walking: 'run', hiking: 'run',
  cycling: 'other', mountain_biking: 'other', peloton_bike: 'other', gravel_biking: 'other',
  weightlifting: 'lift', powerlifting: 'lift', functional_fitness: 'lift', crossfit: 'lift',
  soccer: 'soccer',
  rock_climbing: 'climb', bouldering: 'climb', ice_climbing: 'climb',
};

function mapWhoopSport(sportName) {
  if (!sportName) return 'other';
  return WHOOP_SPORT_MAP[sportName.toLowerCase().replace(/[\s-]/g, '_')] ?? 'other';
}

function sleepPctToScore(pct) {
  if (pct == null) return null;
  if (pct < 50) return 1;
  if (pct < 65) return 2;
  if (pct < 80) return 3;
  if (pct < 90) return 4;
  return 5;
}

function getToken() {
  const row = getDb().prepare("SELECT * FROM auth_tokens WHERE service = 'whoop'").get();
  return row ?? null;
}

function saveToken({ access_token, refresh_token, expires_in }) {
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
  getDb().prepare(`
    INSERT INTO auth_tokens (service, access_token, refresh_token, expires_at, updated_at)
    VALUES ('whoop', ?, ?, ?, ?)
    ON CONFLICT(service) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `).run(access_token, refresh_token, expiresAt, new Date().toISOString());
}

export function getAuthUrl() {
  const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID,
    redirect_uri: process.env.WHOOP_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
  });
  return `${WHOOP_BASE}/oauth/oauth2/auth?${params}`;
}

export async function exchangeCode(code) {
  const res = await axios.post(`${WHOOP_BASE}/oauth/oauth2/token`, new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.WHOOP_REDIRECT_URI,
    client_id: process.env.WHOOP_CLIENT_ID,
    client_secret: process.env.WHOOP_CLIENT_SECRET,
  }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  saveToken(res.data);
}

let _refreshPromise = null;
async function refreshToken() {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    const token = getToken();
    if (!token?.refresh_token) throw new Error('No WHOOP refresh token available');
    const res = await axios.post(`${WHOOP_BASE}/oauth/oauth2/token`, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
      client_id: process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    saveToken(res.data);
  })().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

export async function ensureToken() {
  const token = getToken();
  if (!token) throw new Error('WHOOP not connected — visit /whoop/auth');
  const expiresAt = new Date(token.expires_at).getTime();
  const thirtyMinutes = 30 * 60 * 1000;
  if (Date.now() + thirtyMinutes >= expiresAt) {
    await refreshToken();
  }
}

async function whoopGet(path, params = {}) {
  await ensureToken();
  const token = getToken();
  const res = await axios.get(`${WHOOP_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    params,
  });
  return res.data;
}

async function paginate(path, params = {}) {
  const records = [];
  let nextToken = null;
  do {
    const query = { limit: 25, ...params };
    if (nextToken) query.nextToken = nextToken;
    const data = await whoopGet(path, query);
    records.push(...(data.records ?? []));
    nextToken = data.next_token ?? null;
  } while (nextToken);
  return records;
}

export async function fetchCycles(startIso, endIso) {
  return paginate('/developer/v1/cycle', { start: startIso, end: endIso });
}

export async function fetchRecoveries(startIso, endIso) {
  return paginate('/developer/v2/recovery', { start: startIso, end: endIso });
}

export async function fetchSleeps(startIso, endIso) {
  return paginate('/developer/v2/activity/sleep', { start: startIso, end: endIso });
}

export async function fetchWorkouts(startIso, endIso) {
  return paginate('/developer/v2/activity/workout', { start: startIso, end: endIso });
}

function workoutToRow(w) {
  const durationSeconds = (w.start && w.end)
    ? Math.round((new Date(w.end) - new Date(w.start)) / 1000)
    : null;
  const score = w.score ?? {};
  const type = mapWhoopSport(w.sport_name);
  const date = w.start ? w.start.split('T')[0] : null;
  return {
    id: deriveActivityId(date, type, durationSeconds),
    type,
    date,
    duration_seconds: durationSeconds,
    distance_meters: score.distance_meter ?? null,
    avg_pace_seconds_per_km: null,
    avg_hr: score.average_heart_rate ?? null,
    max_hr: score.max_heart_rate ?? null,
    calories: score.kilojoule != null ? Math.round(score.kilojoule / 4.184) : null,
    elevation_gain_meters: score.altitude_gain_meter ?? null,
    cadence: null,
    vo2max: null,
    training_load: score.strain ?? null,
    raw_json: JSON.stringify(w),
    synced_at: new Date().toISOString(),
    source: 'whoop',
  };
}

export async function syncWhoop(days = 7) {
  await ensureToken(); // refresh once before parallel fetches to avoid rotation race
  const db = getDb();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date().toISOString();

  const [cycles, recoveries, sleeps, workouts] = await Promise.all([
    fetchCycles(start, end),
    fetchRecoveries(start, end),
    fetchSleeps(start, end),
    fetchWorkouts(start, end),
  ]);

  const recoveryByCycleId = Object.fromEntries(recoveries.map(r => [r.cycle_id, r]));
  const sleepByCycleId = Object.fromEntries(sleeps.map(s => [s.cycle_id, s]));

  const upsertCycle = db.prepare(`
    INSERT INTO whoop_recovery (id, date, strain, raw_json, synced_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      date = excluded.date,
      strain = excluded.strain,
      raw_json = excluded.raw_json,
      synced_at = excluded.synced_at
  `);

  const updateRecovery = db.prepare(`
    UPDATE whoop_recovery SET
      recovery_score = ?,
      hrv_rmssd = ?,
      resting_hr = ?,
      synced_at = ?
    WHERE id = ?
  `);

  const updateSleep = db.prepare(`
    UPDATE whoop_recovery SET
      sleep_performance_pct = ?,
      sleep_duration_seconds = ?,
      deep_sleep_seconds = ?,
      rem_sleep_seconds = ?,
      synced_at = ?
    WHERE id = ?
  `);

  const upsertWorkout = db.prepare(`
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
      avg_hr = excluded.avg_hr, max_hr = excluded.max_hr,
      calories = excluded.calories,
      elevation_gain_meters = excluded.elevation_gain_meters,
      training_load = excluded.training_load,
      raw_json = excluded.raw_json,
      synced_at = excluded.synced_at,
      source = excluded.source
  `);

  const now = new Date().toISOString();

  const insertAll = db.transaction(() => {
    for (const cycle of cycles) {
      const date = cycle.start ? cycle.start.split('T')[0] : null;
      upsertCycle.run(
        cycle.id,
        date,
        cycle.score?.strain ?? null,
        JSON.stringify(cycle),
        now
      );

      const recovery = recoveryByCycleId[cycle.id];
      if (recovery?.score) {
        updateRecovery.run(
          recovery.score.recovery_score ?? null,
          recovery.score.hrv_rmssd_milli ?? null,
          recovery.score.resting_heart_rate ?? null,
          now,
          cycle.id
        );
      }

      const sleep = sleepByCycleId[cycle.id];
      if (sleep?.score) {
        const stages = sleep.score.stage_summary ?? {};
        const totalSleep = (stages.total_light_sleep_time_milli ?? 0)
          + (stages.total_slow_wave_sleep_time_milli ?? 0)
          + (stages.total_rem_sleep_time_milli ?? 0);
        const efficiencyPct = sleep.score.sleep_efficiency_percentage ?? null;
        updateSleep.run(
          sleepPctToScore(efficiencyPct),
          Math.round(totalSleep / 1000),
          Math.round((stages.total_slow_wave_sleep_time_milli ?? 0) / 1000),
          Math.round((stages.total_rem_sleep_time_milli ?? 0) / 1000),
          now,
          cycle.id
        );
      }
    }

    for (const workout of workouts) {
      upsertWorkout.run(workoutToRow(workout));
    }
  });

  insertAll();
  return { synced: cycles.length, workoutsSynced: workouts.length };
}

export function hasToken() {
  return !!getToken();
}
