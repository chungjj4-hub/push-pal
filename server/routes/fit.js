import { Router } from 'express';
import multer from 'multer';
import { parseFitFile } from '../services/fitService.js';
import { getDb } from '../db.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const upsertActivity = (db) => db.prepare(`
  INSERT INTO coros_activities
    (id, type, date, duration_seconds, distance_meters, avg_pace_seconds_per_km,
     avg_hr, max_hr, calories, elevation_gain_meters, cadence, vo2max, training_load,
     raw_json, synced_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    type = excluded.type,
    date = excluded.date,
    duration_seconds = excluded.duration_seconds,
    distance_meters = excluded.distance_meters,
    avg_pace_seconds_per_km = excluded.avg_pace_seconds_per_km,
    avg_hr = excluded.avg_hr,
    max_hr = excluded.max_hr,
    calories = excluded.calories,
    elevation_gain_meters = excluded.elevation_gain_meters,
    cadence = excluded.cadence,
    vo2max = excluded.vo2max,
    training_load = excluded.training_load,
    raw_json = excluded.raw_json,
    synced_at = excluded.synced_at
`);

router.post('/upload', upload.array('files'), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

  const db = getDb();
  const stmt = upsertActivity(db);
  const imported = [];
  let skipped = 0;

  for (const file of req.files) {
    const activity = await parseFitFile(file.buffer);
    if (!activity) {
      skipped++;
      continue;
    }
    stmt.run(
      activity.id, activity.type, activity.date, activity.duration_seconds,
      activity.distance_meters, activity.avg_pace_seconds_per_km,
      activity.avg_hr, activity.max_hr, activity.calories,
      activity.elevation_gain_meters, activity.cadence, activity.vo2max,
      activity.training_load, activity.raw_json, activity.synced_at
    );
    imported.push({ id: activity.id, type: activity.type, date: activity.date });
  }

  res.json({ imported: imported.length, skipped, activities: imported });
});

router.get('/activities', (req, res) => {
  const days = parseInt(req.query.days ?? '30', 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const rows = getDb().prepare(
    'SELECT * FROM coros_activities WHERE date >= ? ORDER BY date DESC'
  ).all(since);
  res.json(rows);
});

export default router;
