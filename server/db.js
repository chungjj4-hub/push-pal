import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'coach.db');

let db;

export function initDb() {
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
      synced_at TEXT
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
