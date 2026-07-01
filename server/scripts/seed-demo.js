// Generates ~5 weeks of realistic-looking training data into data/demo.db
// for the public portfolio demo (DEMO_MODE=true). Deliberately trended, not
// random noise: recovery/pace/mileage improve over the block, with one bad
// recovery day, one missed workout, and progressive-overload lifts — the
// same shape a real marathon-block athlete's data actually has.
//
// Run via `npm run seed:demo`. Safe to re-run — wipes and rebuilds
// data/demo.db each time (never touches data/coach.db).

process.env.DEMO_MODE = 'true';

// Dynamic import so DEMO_MODE is set before db.js's top-level DB_PATH
// resolution runs (static imports are hoisted ahead of this file's own code).
const { initDb, getDb } = await import('../db.js');

// Deterministic PRNG (mulberry32) — re-running the seed script always
// produces the same story, so the demo is reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const randRange = (min, max) => min + rand() * (max - min);
const randInt = (min, max) => Math.round(randRange(min, max));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const DAYS = 35; // 5 weeks
const today = new Date();
today.setHours(12, 0, 0, 0); // noon avoids DST/timezone date-shift edge cases
const dateAt = (daysAgo) => {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

// Sleep-performance % -> 1-5 score, matching whoopService.js's own mapping,
// so seeded journal entries are internally consistent with seeded recovery.
function sleepPctToScore(pct) {
  if (pct == null) return null;
  if (pct < 50) return 1;
  if (pct < 65) return 2;
  if (pct < 80) return 3;
  if (pct < 90) return 4;
  return 5;
}

const BAD_RECOVERY_DAYS = new Set([12, 27]); // days-ago indices — one early, one mid-block
const MISSED_WORKOUT_DAY = 9; // a scheduled Thursday run that never got logged

function buildRecoveryDay(daysAgo, blockProgress) {
  // blockProgress: 0 (5 weeks ago) -> 1 (today). Fitness trends up over it.
  const isBad = BAD_RECOVERY_DAYS.has(daysAgo);
  const baseRecovery = 58 + blockProgress * 12; // 58% -> 70% baseline drift
  const recovery = isBad
    ? clamp(randInt(28, 40), 1, 100)
    : clamp(Math.round(baseRecovery + randRange(-13, 13)), 30, 95);

  const hrv = clamp(Math.round(32 + recovery * 0.42 + randRange(-4, 4)), 22, 78);
  const restingHr = clamp(Math.round(51 - blockProgress * 4 + (isBad ? randRange(6, 12) : randRange(-2, 2))), 42, 66);
  const sleepHours = isBad ? randRange(4.8, 6.2) : randRange(6.4, 8.6);
  const sleepPerformancePct = clamp(Math.round((sleepHours / 8.5) * 100 + randRange(-8, 8)), 30, 98);
  const deepSleepSec = Math.round(sleepHours * 3600 * randRange(0.12, 0.18));
  const remSleepSec = Math.round(sleepHours * 3600 * randRange(0.18, 0.24));

  return {
    date: dateAt(daysAgo),
    recovery_score: recovery,
    hrv_rmssd: hrv,
    resting_hr: restingHr,
    sleep_performance_pct: sleepPerformancePct,
    sleep_duration_seconds: Math.round(sleepHours * 3600),
    deep_sleep_seconds: deepSleepSec,
    rem_sleep_seconds: remSleepSec,
  };
}

// Weekly training pattern (day-of-week, 0=Sun..6=Sat), loosely mirroring the
// coach's own system-prompt schedule — not rigid, real athletes drift.
const WEEKLY_PLAN = {
  0: { type: 'soccer', durMin: [75, 95], strain: [13, 18] },       // Sun
  1: { type: 'run', durMin: [30, 40], strain: [6, 9], easy: true }, // Mon
  2: { type: 'soccer', durMin: [70, 90], strain: [13, 17] },        // Tue
  3: { type: 'lift', durMin: [40, 55], strain: [8, 11] },           // Wed
  4: { type: 'run', durMin: [35, 50], strain: [8, 12] },            // Thu
  5: { type: 'lift', durMin: [35, 45], strain: [6, 9] },            // Fri
  6: { type: 'run', durMin: [50, 95], strain: [14, 19], long: true }, // Sat
};

function activityForDay(daysAgo, blockProgress) {
  if (daysAgo === MISSED_WORKOUT_DAY) return null; // deliberately skipped

  const date = dateAt(daysAgo);
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const plan = WEEKLY_PLAN[dow];
  if (!plan || rand() < 0.08) return null; // occasional real-world skip

  const type = plan.type;
  const durationSeconds = randInt(plan.durMin[0], plan.durMin[1]) * 60;

  if (type === 'run') {
    // Pace improves over the block: ~9:40/mi -> ~8:50/mi easy pace drift.
    const basePaceSecPerMile = plan.long ? 570 - blockProgress * 20 : 580 - blockProgress * 30;
    const paceSecPerMile = clamp(basePaceSecPerMile + randRange(-15, 15), 480, 620);
    const paceSecPerKm = paceSecPerMile / 1.60934;
    const distanceMiles = plan.long
      ? 5 + blockProgress * 4.5 + randRange(-0.5, 0.5) // 5mi -> 9.5mi long-run ramp
      : (durationSeconds / paceSecPerMile);
    const distanceMeters = distanceMiles * 1609.34;
    return {
      type: 'run', source: 'whoop', date, duration_seconds: Math.round(distanceMiles * paceSecPerMile),
      distance_meters: distanceMeters, avg_pace_seconds_per_km: paceSecPerKm,
      avg_hr: plan.easy ? randInt(138, 152) : randInt(150, 168),
      max_hr: randInt(160, 178), calories: Math.round(distanceMiles * randRange(95, 115)),
      elevation_gain_meters: randInt(5, 60), cadence: randInt(160, 174),
      training_load: randRange(plan.strain[0], plan.strain[1]),
    };
  }

  if (type === 'soccer') {
    return {
      type: 'soccer', source: 'whoop', date, duration_seconds: durationSeconds,
      distance_meters: null, avg_pace_seconds_per_km: null,
      avg_hr: randInt(128, 148), max_hr: randInt(175, 198),
      calories: Math.round(durationSeconds / 60 * randRange(9, 13)),
      elevation_gain_meters: null, cadence: null,
      training_load: randRange(plan.strain[0], plan.strain[1]),
    };
  }

  return null; // lift days are seeded via manual_workouts below, not here
}

// Progressive-overload lift sessions -> manual_workouts (feeds the Lifting
// goal card, which reads exercises JSON specifically from this table).
const LIFT_EXERCISES = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Romanian Deadlift'];
function liftWorkoutForDay(daysAgo, blockProgress) {
  const date = dateAt(daysAgo);
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (WEEKLY_PLAN[dow]?.type !== 'lift') return null;
  if (daysAgo === MISSED_WORKOUT_DAY || rand() < 0.1) return null;

  const primary = dow === 3 ? 'Squat' : pick(LIFT_EXERCISES);
  const baseWeight = { Squat: 185, 'Bench Press': 155, Deadlift: 225, 'Overhead Press': 95, 'Romanian Deadlift': 165 }[primary];
  const progressedWeight = Math.round((baseWeight + blockProgress * 25) / 5) * 5;

  const exercises = [
    { name: primary, sets: 4, reps: 5, weight_lbs: progressedWeight },
    { name: pick(LIFT_EXERCISES.filter(e => e !== primary)), sets: 3, reps: 8, weight_lbs: Math.round(progressedWeight * 0.6 / 5) * 5 },
  ];

  return {
    type: 'lift', date, duration_minutes: randInt(35, 55),
    notes: pick([
      'Felt strong today, good bar speed.',
      'A bit gassed from soccer, kept it controlled.',
      'New rep PR on the last set.',
      null,
    ]),
    distance_miles: null, pace_per_mile: null, avg_hr: randInt(105, 130),
    exercises,
  };
}

const JOURNAL_NOTES = {
  good: [
    "Legs feel fresh, ready for whatever's next.",
    'Slept great, energy is high today.',
    'Recovery run felt easy — good sign.',
  ],
  ok: [
    'Fine, nothing special. Just a bit tired.',
    'Calves a little cranky from hills, but energy is decent.',
    'Solid day overall, minor tightness in the hips.',
  ],
  bad: [
    'Rough night of sleep, dragging today.',
    'Skipped the planned run — just too fatigued to push it.',
    'Legs heavy after back-to-back hard days. Need a real rest day.',
  ],
};

function seed() {
  const db = getDb();

  db.exec('DELETE FROM whoop_recovery; DELETE FROM coros_activities; DELETE FROM manual_workouts; DELETE FROM journal; DELETE FROM goals; DELETE FROM auth_tokens;');

  const upsertRecovery = db.prepare(`
    INSERT INTO whoop_recovery (date, recovery_score, hrv_rmssd, resting_hr, sleep_performance_pct, sleep_duration_seconds, deep_sleep_seconds, rem_sleep_seconds, strain, raw_json, synced_at)
    VALUES (@date, @recovery_score, @hrv_rmssd, @resting_hr, @sleep_performance_pct, @sleep_duration_seconds, @deep_sleep_seconds, @rem_sleep_seconds, @strain, '{"seed":"demo"}', @synced_at)
  `);

  const upsertActivity = db.prepare(`
    INSERT INTO coros_activities (id, type, date, duration_seconds, distance_meters, avg_pace_seconds_per_km, avg_hr, max_hr, calories, elevation_gain_meters, cadence, vo2max, training_load, raw_json, synced_at, source)
    VALUES (@id, @type, @date, @duration_seconds, @distance_meters, @avg_pace_seconds_per_km, @avg_hr, @max_hr, @calories, @elevation_gain_meters, @cadence, NULL, @training_load, '{"seed":"demo"}', @synced_at, @source)
  `);

  const upsertLift = db.prepare(`
    INSERT INTO manual_workouts (type, date, duration_minutes, notes, distance_miles, pace_per_mile, avg_hr, exercises)
    VALUES (@type, @date, @duration_minutes, @notes, @distance_miles, @pace_per_mile, @avg_hr, @exercises)
  `);

  const upsertJournal = db.prepare(`
    INSERT INTO journal (date, energy, soreness_areas, mood, sleep_quality, notes)
    VALUES (@date, @energy, @soreness_areas, @mood, @sleep_quality, @notes)
  `);

  const now = new Date().toISOString();
  const dailyTrainingLoad = {}; // date -> summed strain, for whoop_recovery.strain

  const insertAll = db.transaction(() => {
    let activityIdCounter = 0;

    for (let daysAgo = DAYS; daysAgo >= 0; daysAgo--) {
      const blockProgress = (DAYS - daysAgo) / DAYS; // 0 -> 1 across the block
      const date = dateAt(daysAgo);
      dailyTrainingLoad[date] = 0;

      const activity = activityForDay(daysAgo, blockProgress);
      if (activity) {
        activityIdCounter++;
        upsertActivity.run({ id: `demo_${activityIdCounter}_${date}`, synced_at: now, ...activity });
        dailyTrainingLoad[date] += activity.training_load;
      }

      const lift = liftWorkoutForDay(daysAgo, blockProgress);
      if (lift) {
        upsertLift.run({ ...lift, exercises: JSON.stringify(lift.exercises) });
        dailyTrainingLoad[date] += randRange(7, 10);
      }
    }

    for (let daysAgo = DAYS; daysAgo >= 0; daysAgo--) {
      const blockProgress = (DAYS - daysAgo) / DAYS;
      const day = buildRecoveryDay(daysAgo, blockProgress);
      const strain = dailyTrainingLoad[day.date] > 0
        ? clamp(dailyTrainingLoad[day.date] + randRange(-1, 1), 2, 21)
        : randRange(3, 7); // rest-day baseline strain
      upsertRecovery.run({ ...day, strain, synced_at: now });
    }

    // Journal: ~40% of days, weighted toward the bad-recovery/missed-workout
    // days so the narrative reads coherently rather than as random noise.
    for (let daysAgo = DAYS; daysAgo >= 0; daysAgo--) {
      const forceEntry = BAD_RECOVERY_DAYS.has(daysAgo) || daysAgo === MISSED_WORKOUT_DAY;
      if (!forceEntry && rand() > 0.4) continue;

      const date = dateAt(daysAgo);
      const recoveryRow = db.prepare('SELECT * FROM whoop_recovery WHERE date = ?').get(date);
      const isBad = BAD_RECOVERY_DAYS.has(daysAgo) || daysAgo === MISSED_WORKOUT_DAY;
      const mood = isBad ? randInt(2, 3) : randInt(3, 5);
      const energy = isBad ? randInt(1, 3) : randInt(3, 5);
      const notePool = isBad ? JOURNAL_NOTES.bad : (mood >= 4 ? JOURNAL_NOTES.good : JOURNAL_NOTES.ok);
      const soreness = isBad
        ? JSON.stringify(pick([['legs'], ['legs', 'hips'], ['back']]))
        : JSON.stringify(rand() < 0.3 ? [pick(['legs', 'core', 'shoulders'])] : []);

      upsertJournal.run({
        date, energy, mood,
        soreness_areas: soreness,
        sleep_quality: sleepPctToScore(recoveryRow?.sleep_performance_pct),
        notes: pick(notePool),
      });
    }

    // Marathon goal (matches seedGoals()'s own row so Progress's marathon
    // card works even though we bypassed seedGoals() with the DELETE above).
    db.prepare(`INSERT INTO goals (type, label, target_value, target_date) VALUES ('marathon', 'Sub-4:00 Marathon', 240, '2026-11-01')`).run();
    db.prepare(`INSERT INTO goals (type, label, exercise_name, target_value) VALUES ('lift_1rm', 'Squat 1RM', 'Squat', 225)`).run();
    db.prepare(`INSERT INTO goals (type, label, target_value) VALUES ('lift_consistency', 'Lift 3x/week', 3)`).run();
    db.prepare(`INSERT INTO goals (type, label, activity_type, target_value) VALUES ('activity_frequency', 'Soccer 2x/week', 'soccer', 2)`).run();
  });

  insertAll();

  const counts = {
    recovery: db.prepare('SELECT COUNT(*) n FROM whoop_recovery').get().n,
    activities: db.prepare('SELECT COUNT(*) n FROM coros_activities').get().n,
    lifts: db.prepare('SELECT COUNT(*) n FROM manual_workouts').get().n,
    journal: db.prepare('SELECT COUNT(*) n FROM journal').get().n,
    goals: db.prepare('SELECT COUNT(*) n FROM goals').get().n,
  };
  console.log(`[seed:demo] data/demo.db seeded — ${DAYS + 1} days: ${counts.recovery} recovery rows, ${counts.activities} activities, ${counts.lifts} lift sessions, ${counts.journal} journal entries, ${counts.goals} goals.`);
}

initDb();
seed();
