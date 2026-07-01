import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.post('/', (req, res) => {
  const { type, date, duration_minutes, notes, distance_miles, pace_per_mile, avg_hr, exercises } = req.body;
  if (!type || !date) return res.status(400).json({ error: 'type and date required' });

  const result = getDb().prepare(`
    INSERT INTO manual_workouts (type, date, duration_minutes, notes, distance_miles, pace_per_mile, avg_hr, exercises)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    type, date, duration_minutes ?? null, notes ?? null,
    distance_miles ?? null, pace_per_mile ?? null, avg_hr ?? null,
    exercises ? JSON.stringify(exercises) : null
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

router.get('/', (req, res) => {
  const days = parseInt(req.query.days ?? '30', 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const type = req.query.type;

  let query = 'SELECT * FROM manual_workouts WHERE date >= ?';
  const params = [since];
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  query += ' ORDER BY date DESC';

  const rows = getDb().prepare(query).all(...params);
  res.json(rows.map(r => ({ ...r, exercises: r.exercises ? JSON.parse(r.exercises) : null })));
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM manual_workouts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

export default router;
