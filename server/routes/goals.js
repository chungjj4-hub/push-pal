import { Router } from 'express';
import { getDb } from '../db.js';
import { metersToMiles, secPerKmToSecPerMile } from '../utils/units.js';

const router = Router();

const RACE_DATE = new Date('2026-11-01');

function epley1RM(weight, reps) {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

function computeMarathonProgress(db) {
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksToRace = Math.max(0, Math.ceil((RACE_DATE - now) / msPerWeek));

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const weeklyMeters = db.prepare(`
    SELECT COALESCE(SUM(distance_meters), 0) as total
    FROM coros_activities WHERE type = 'run' AND date >= ?
  `).get(weekStartStr).total;

  const longestRun = db.prepare(`
    SELECT MAX(distance_meters) as max_dist, avg_pace_seconds_per_km
    FROM coros_activities WHERE type = 'run' AND date >= ?
  `).get(sevenDaysAgo);

  const weeklyMiles = metersToMiles(weeklyMeters);
  const targetMiles = 35;
  const week = 17 - Math.min(17, weeksToRace);

  return {
    type: 'marathon',
    label: 'Sub-4:00 Marathon',
    raceDate: '2026-11-01',
    weeksToRace,
    currentTrainingWeek: week,
    weeklyMilesCurrent: Math.round(weeklyMiles * 10) / 10,
    weeklyMilesTarget: targetMiles,
    weeklyMilesPct: Math.min(100, Math.round((weeklyMiles / targetMiles) * 100)),
    longestRunMiles: +(metersToMiles(longestRun.max_dist ?? 0)).toFixed(2),
    longestRunPaceSecPerMile: secPerKmToSecPerMile(longestRun.avg_pace_seconds_per_km ?? null),
  };
}

function computeLiftingProgress(db, goals) {
  const liftGoals = goals.filter(g => g.type === 'lift_1rm' || g.type === 'lift_consistency');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return liftGoals.map(goal => {
    if (goal.type === 'lift_1rm') {
      const workouts = db.prepare(
        "SELECT exercises FROM manual_workouts WHERE type = 'lift' AND date >= ? AND exercises IS NOT NULL"
      ).all(thirtyDaysAgo);

      let best1RM = 0;
      for (const w of workouts) {
        const sets = JSON.parse(w.exercises) ?? [];
        for (const set of sets) {
          if (set.name?.toLowerCase() === goal.exercise_name?.toLowerCase() && set.weight_lbs && set.reps) {
            const est = epley1RM(set.weight_lbs, set.reps);
            if (est > best1RM) best1RM = est;
          }
        }
      }

      return {
        ...goal,
        current1RM: Math.round(best1RM),
        target1RM: goal.target_value,
        pct: goal.target_value > 0 ? Math.min(100, Math.round((best1RM / goal.target_value) * 100)) : null,
      };
    }

    if (goal.type === 'lift_consistency') {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const sessionsThisWeek = db.prepare(
        "SELECT COUNT(*) as n FROM manual_workouts WHERE type = 'lift' AND date >= ?"
      ).get(weekStart.toISOString().split('T')[0]).n;

      return {
        ...goal,
        sessionsThisWeek,
        targetSessions: goal.target_value ?? 3,
        pct: Math.min(100, Math.round((sessionsThisWeek / (goal.target_value ?? 3)) * 100)),
      };
    }
  });
}

function computeFrequencyProgress(db, goals) {
  const freqGoals = goals.filter(g => g.type === 'activity_frequency');
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];

  return freqGoals.map(goal => {
    const activity = goal.activity_type;
    const thisWeek = db.prepare(`
      SELECT COUNT(*) as n FROM (
        SELECT date FROM coros_activities WHERE type = ? AND date >= ?
        UNION ALL
        SELECT date FROM manual_workouts WHERE type = ? AND date >= ?
      )
    `).get(activity, weekStartStr, activity, weekStartStr).n;

    return {
      ...goal,
      sessionsThisWeek: thisWeek,
      targetSessions: goal.target_value ?? 1,
      pct: Math.min(100, Math.round((thisWeek / (goal.target_value ?? 1)) * 100)),
    };
  });
}

router.get('/', (req, res) => {
  const db = getDb();
  const goals = db.prepare('SELECT * FROM goals').all();

  res.json({
    marathon: computeMarathonProgress(db),
    lifting: computeLiftingProgress(db, goals),
    frequency: computeFrequencyProgress(db, goals),
    all: goals,
  });
});

router.post('/', (req, res) => {
  const { type, label, exercise_name, activity_type, target_value, target_date } = req.body;
  if (!type || !label) return res.status(400).json({ error: 'type and label required' });
  const result = getDb().prepare(`
    INSERT INTO goals (type, label, exercise_name, activity_type, target_value, target_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(type, label, exercise_name ?? null, activity_type ?? null, target_value ?? null, target_date ?? null);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { label, exercise_name, activity_type, target_value, target_date } = req.body;
  const result = getDb().prepare(`
    UPDATE goals SET label = ?, exercise_name = ?, activity_type = ?, target_value = ?, target_date = ?
    WHERE id = ?
  `).run(label, exercise_name ?? null, activity_type ?? null, target_value ?? null, target_date ?? null, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ updated: true });
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

export default router;
