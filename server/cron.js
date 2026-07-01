import cron from 'node-cron';
import { getDb } from './db.js';
import { syncWhoop, hasToken as whoopHasToken } from './services/whoopService.js';
import { syncStrava, hasToken as stravaHasToken } from './services/stravaService.js';

async function runWhoopSync(days = 7) {
  if (!whoopHasToken()) return;
  try {
    const result = await syncWhoop(days);
    console.log(`[cron] WHOOP sync complete — ${result.synced} cycles, ${result.workoutsSynced} workouts`);
  } catch (err) {
    console.error('[cron] WHOOP sync error:', err.message);
  }
}

async function runStravaSync(days = 7) {
  if (!stravaHasToken()) return;
  try {
    const result = await syncStrava(days);
    console.log(`[cron] Strava sync complete — ${result.synced} activities`);
  } catch (err) {
    console.error('[cron] Strava sync error:', err.message);
  }
}

export async function startCron() {
  const db = getDb();

  // WHOOP: full backfill on first launch, always sync recent data on startup
  const whoopCount = db.prepare('SELECT COUNT(*) as n FROM whoop_recovery').get().n;
  if (whoopHasToken()) {
    if (whoopCount === 0) {
      console.log('[cron] First launch — running 90-day WHOOP backfill...');
      await runWhoopSync(90);
    } else {
      console.log('[cron] Startup — syncing last 2 days of WHOOP data...');
      await runWhoopSync(2);
    }
  }

  // Strava: full backfill on first launch, always sync recent data on startup
  const stravaCount = db.prepare("SELECT COUNT(*) as n FROM coros_activities WHERE id LIKE 'strava_%'").get().n;
  if (stravaHasToken()) {
    if (stravaCount === 0) {
      console.log('[cron] First launch — running 90-day Strava backfill...');
      await runStravaSync(90);
    } else {
      console.log('[cron] Startup — syncing last 7 days of Strava data...');
      await runStravaSync(7);
    }
  }

  // WHOOP: every hour
  cron.schedule('0 * * * *', () => {
    console.log('[cron] Hourly WHOOP sync');
    runWhoopSync(7);
  });

  // Strava: every 3 hours (rate limit: 100 req/15min, 1000/day)
  cron.schedule('0 */3 * * *', () => {
    console.log('[cron] Strava sync');
    runStravaSync(7);
  });

  console.log('[cron] Scheduler started (WHOOP hourly, Strava every 3h)');
}
