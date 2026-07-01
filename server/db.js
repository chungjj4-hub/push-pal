import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { deriveActivityId } from './services/activityId.js';
import { isDemoMode } from './utils/demoMode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Demo mode reads/writes data/demo.db — a completely separate file from the
// real data/coach.db, so seeding or running the public demo can never touch
// real synced data.
const DB_PATH = join(__dirname, '..', 'data', isDemoMode() ? 'demo.db' : 'coach.db');

let db;

const SOURCE_PRIORITY = { strava: 3, fit: 2, whoop: 1 };

function inferLegacySource(id) {
  if (id.startsWith('strava_')) return 'strava';
  if (id.startsWith('whoop_')) return 'whoop';
  return 'fit';
}

function addSourceColumnIfMissing(db) {
  const cols = db.prepare('PRAGMA table_info(coros_activities)').all();
  if (!cols.some(c => c.name === 'source')) {
    db.exec('ALTER TABLE coros_activities ADD COLUMN source TEXT');
  }
}

// One-time (idempotent) migration: older rows used a source-prefixed id
// (strava_<id>, whoop_<id>) which meant the same real-world activity synced
// from two sources (e.g. a run auto-uploaded to both WHOOP and Strava)
// created two rows. This re-keys every row to a hash of date|type|duration
// (see services/activityId.js) so cross-source duplicates collapse into one.
function migrateActivityIds(db) {
  const rows = db.prepare('SELECT * FROM coros_activities').all();
  if (rows.length === 0) return;

  const groups = new Map();
  for (const row of rows) {
    const source = row.source ?? inferLegacySource(row.id);
    const newId = deriveActivityId(row.date, row.type, row.duration_seconds);
    if (!groups.has(newId)) groups.set(newId, []);
    groups.get(newId).push({ ...row, source });
  }

  const alreadyMigrated = rows.every(r => r.source != null)
    && [...groups.values()].every(g => g.length === 1)
    && rows.every(r => r.id === deriveActivityId(r.date, r.type, r.duration_seconds));
  if (alreadyMigrated) return;

  const winners = [];
  for (const [newId, group] of groups) {
    group.sort((a, b) => {
      const distRank = (b.distance_meters != null ? 1 : 0) - (a.distance_meters != null ? 1 : 0);
      if (distRank !== 0) return distRank;
      return (SOURCE_PRIORITY[b.source] ?? 0) - (SOURCE_PRIORITY[a.source] ?? 0);
    });
    winners.push({ ...group[0], id: newId });
  }

  const insert = db.prepare(`
    INSERT INTO coros_activities
      (id, type, date, duration_seconds, distance_meters, avg_pace_seconds_per_km,
       avg_hr, max_hr, calories, elevation_gain_meters, cadence, vo2max,
       training_load, raw_json, synced_at, source)
    VALUES (@id, @type, @date, @duration_seconds, @distance_meters, @avg_pace_seconds_per_km,
       @avg_hr, @max_hr, @calories, @elevation_gain_meters, @cadence, @vo2max,
       @training_load, @raw_json, @synced_at, @source)
  `);

  const migrate = db.transaction(() => {
    db.exec('DELETE FROM coros_activities');
    for (const w of winners) insert.run(w);
  });
  migrate();

  console.log(`[db] Migrated coros_activities ids — ${rows.length} rows deduped to ${winners.length}`);
}

export function initDb() {
  // data/ is gitignored (it holds real synced health data) — a fresh clone
  // won't have it yet, and better-sqlite3 refuses to create the directory
  // itself.
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS coros_activities (
      id TEXT PRIMARY KEY,
      type TEXT,
      date TEXT,
      duration_seconds INTEGER,
      distance_meters REAL,
      avg_pace_seconds_per_km REAL,
      avg_hr INTEGER,
      max_hr INTEGER,
      calories INTEGER,
      elevation_gain_meters REAL,
      cadence INTEGER,
      vo2max REAL,
      training_load REAL,
      raw_json TEXT,
      synced_at TEXT,
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS coros_health (
      date TEXT PRIMARY KEY,
      hrv REAL,
      resting_hr INTEGER,
      training_load REAL,
      vo2max REAL,
      stamina REAL,
      raw_json TEXT,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS whoop_recovery (
      id INTEGER PRIMARY KEY,
      date TEXT,
      recovery_score INTEGER,
      hrv_rmssd REAL,
      resting_hr REAL,
      sleep_performance_pct INTEGER,
      sleep_duration_seconds INTEGER,
      deep_sleep_seconds INTEGER,
      rem_sleep_seconds INTEGER,
      strain REAL,
      raw_json TEXT,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS manual_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      date TEXT,
      duration_minutes INTEGER,
      notes TEXT,
      distance_miles REAL,
      pace_per_mile TEXT,
      avg_hr INTEGER,
      exercises TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS journal (
      date TEXT PRIMARY KEY,
      energy INTEGER,
      soreness_areas TEXT,
      mood INTEGER,
      sleep_quality INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      label TEXT,
      exercise_name TEXT,
      activity_type TEXT,
      target_value REAL,
      target_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      service TEXT PRIMARY KEY,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      updated_at TEXT
    );
  `);

  addSourceColumnIfMissing(db);
  migrateActivityIds(db);

  return db;
}

export function getDb() {
  if (!db) throw new Error('DB not initialized — call initDb() first');
  return db;
}

export function seedGoals() {
  const d = getDb();
  const count = d.prepare('SELECT COUNT(*) as n FROM goals').get().n;
  if (count > 0) return;

  d.prepare(`
    INSERT INTO goals (type, label, target_value, target_date)
    VALUES ('marathon', 'Sub-4:00 Marathon', 240, '2026-11-01')
  `).run();
}
