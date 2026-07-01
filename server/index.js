import express from 'express';
import cors from 'cors';
import { initDb, seedGoals } from './db.js';
import { startCron } from './cron.js';

import whoopRoutes from './routes/whoop.js';
import stravaRoutes from './routes/strava.js';
import fitRoutes from './routes/fit.js';
import workoutRoutes from './routes/workouts.js';
import journalRoutes from './routes/journal.js';
import goalRoutes from './routes/goals.js';
import coachRoutes from './routes/coach.js';

const app = express();
const PORT = process.env.PORT ?? 3001;
const CLIENT_PORT = process.env.CLIENT_PORT ?? 5173;

app.use(cors({ origin: `http://localhost:${CLIENT_PORT}` }));
app.use(express.json());

app.use('/whoop', whoopRoutes);
app.use('/strava', stravaRoutes);
app.use('/fit', fitRoutes);
app.use('/workouts', workoutRoutes);
app.use('/journal', journalRoutes);
app.use('/goals', goalRoutes);
app.use('/coach', coachRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

initDb();
seedGoals();
startCron();

app.listen(PORT, () => {
  console.log(`Push Pal server running on http://localhost:${PORT}`);
});
