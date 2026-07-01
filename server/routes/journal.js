import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

function getSleepQualityFromWhoop(db, date) {
  const row = db.prepare(
    "SELECT sleep_performance_pct FROM whoop_recovery WHERE date = ? AND sleep_performance_pct IS NOT NULL ORDER BY id DESC LIMIT 1"
  ).get(date);
  return row?.sleep_performance_pct ?? null;
}

router.post('/', (req, res) => {
  const { date, energy, soreness_areas, mood, sleep_quality, notes } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });

  const db = getDb();
  const autoSleepQuality = sleep_quality ?? getSleepQualityFromWhoop(db, date);

  db.prepare(`
    INSERT INTO journal (date, energy, soreness_areas, mood, sleep_quality, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      energy = excluded.energy,
      soreness_areas = excluded.soreness_areas,
      mood = excluded.mood,
      sleep_quality = excluded.sleep_quality,
      notes = excluded.notes
  `).run(
    date,
    energy ?? null,
    soreness_areas ? JSON.stringify(soreness_areas) : null,
    mood ?? null,
    autoSleepQuality,
    notes ?? null
  );

  res.json({ date, sleep_quality: autoSleepQuality });
});

router.get('/', (req, res) => {
  const days = parseInt(req.query.days ?? '14', 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const rows = getDb().prepare(
    'SELECT * FROM journal WHERE date >= ? ORDER BY date DESC'
  ).all(since);
  res.json(rows.map(r => ({
    ...r,
    soreness_areas: r.soreness_areas ? JSON.parse(r.soreness_areas) : [],
  })));
});

export default router;
