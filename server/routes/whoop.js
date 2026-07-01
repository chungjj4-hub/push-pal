import { Router } from 'express';
import { getDb } from '../db.js';
import { getAuthUrl, exchangeCode, hasToken } from '../services/whoopService.js';

const router = Router();

// Recent recovery rows for client-side stat cards (today + rolling averages)
router.get('/recovery', (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  const rows = getDb().prepare(`
    SELECT date, recovery_score, hrv_rmssd, resting_hr,
           sleep_performance_pct, sleep_duration_seconds, strain
    FROM whoop_recovery
    WHERE date >= ?
    ORDER BY date DESC
  `).all(since);
  res.json(rows);
});

router.get('/auth', (_req, res) => {
  res.redirect(getAuthUrl());
});

// Legacy callback route (not used with https://whoop.com redirect)
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    await exchangeCode(code);
    res.redirect(`http://localhost:${process.env.CLIENT_PORT ?? 5173}?whoop=connected`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual code exchange — user copies code from https://whoop.com?code=XXX after OAuth
router.post('/exchange', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    await exchangeCode(code.trim());
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', (_req, res) => {
  res.json({ connected: hasToken() });
});

export default router;
