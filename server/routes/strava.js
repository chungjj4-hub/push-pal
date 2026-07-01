import { Router } from 'express';
import { getAuthUrl, exchangeCode, hasToken, syncStrava } from '../services/stravaService.js';

const router = Router();

router.get('/auth', (_req, res) => {
  res.redirect(getAuthUrl());
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  const clientBase = `http://localhost:${process.env.CLIENT_PORT ?? 5173}`;
  if (error || !code) return res.redirect(`${clientBase}/log?strava=denied`);
  try {
    await exchangeCode(code);
    syncStrava(90).catch(err => console.error('[strava] backfill error:', err.message));
    res.redirect(`${clientBase}/log?strava=connected`);
  } catch (err) {
    console.error('[strava] callback error:', err.message);
    res.redirect(`${clientBase}/log?strava=error`);
  }
});

router.get('/status', (_req, res) => {
  res.json({ connected: hasToken() });
});

router.post('/sync', async (_req, res) => {
  try {
    const result = await syncStrava(90);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
