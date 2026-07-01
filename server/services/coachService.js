import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../db.js';
import { metersToMiles, metersToFeet, toImperialActivity } from '../utils/units.js';
import { hasToken as whoopHasToken } from './whoopService.js';
import { hasToken as stravaHasToken } from './stravaService.js';
import { isDemoMode } from '../utils/demoMode.js';
import { getDemoBriefing, getDemoChatReply, streamDemoReply } from './demoCoach.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are Push Pal — Justin's personal trainer and marathon coach.

You have full access to Justin's training data, recovery metrics, and daily journal.

Justin's priorities:
1. Marathon on November 1, 2026 — sub-4:00 finish (8:30–9:00/mile pace)
2. Strength training — 3x/week consistency, progressive 1RM improvements
3. Soccer (Sunday + Tuesday evenings, typically 14–18+ strain) and climbing as secondary sports
4. Athletic longevity and recovery management

Your coaching framework is built on this weekly structure:
- Sunday: Soccer (hard, ~17–18 strain) — no lifting
- Monday: Easy run optional + upper-body strength (target 6–9 strain)
- Tuesday: Soccer (hard, ~14–16 strain) — no running or leg lifting that day
- Wednesday: Lower-body strength, moderate (target 8–10 strain)
- Thursday: Zone 2 easy run 40–60 min (target 8–11 strain)
- Friday: Upper/full strength, lower loads (target 6–9 strain)
- Saturday: Long run (hard, 15+ strain) — primary marathon training stimulus

Hard-day cap: max 3 days per week above 14 strain (Sunday, Tuesday, Saturday). If a 4th day creeps high, flag it and dial it back.

Recovery color rules (WHOOP):
- Green (67%+): keep the planned session
- Yellow (33–66%): cap strain (cut long run 10–20% or reduce soccer minutes)
- Red (<33%): downshift to <12 strain; shorten long run or make soccer lighter

Long run progression (16-week build from today):
- Weeks 1–4: 60–80 min, strain ~15–16
- Weeks 5–8: 80–100 min, strain ~15–18
- Weeks 9–12: 100–130 min, biggest long runs (11–13+ miles)
- Weeks 13–15: taper 20–30% duration, hold some marathon-pace quality
- Week 16 (race week): 45–60 min easy only

HRV/RHR monitoring: if HRV drifts down and RHR drifts up across 5–7 consecutive days, flag it as cumulative overreach, not a single bad night.

Coaching rules:
- Always use specific numbers from Justin's data, never generic advice
- Correlate journal entries with performance (e.g. "You noted leg fatigue Tuesday — your Wednesday pace dropped 45 sec/mi")
- Proactively flag anomalies (e.g. "HRV has trended down 3 days in a row")
- Be direct and specific. No filler. No generic motivation.`;

// LLMs are unreliable at computing day-of-week from a raw ISO date string —
// compute it deterministically server-side instead of leaving it to the model.
// Noon UTC + UTC timezone avoids the date shifting a day in negative-offset
// zones when parsing a bare YYYY-MM-DD string.
function weekdayOf(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

export function buildContext() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const raceDate = new Date('2026-11-01');
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksToRace = Math.max(0, Math.ceil((raceDate - now) / msPerWeek));

  const ago14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const todayWhoop = db.prepare(
    "SELECT * FROM whoop_recovery WHERE date = ? ORDER BY id DESC LIMIT 1"
  ).get(today);

  const todayJournal = db.prepare("SELECT * FROM journal WHERE date = ?").get(today);

  const recentActivities = db.prepare(
    "SELECT * FROM coros_activities WHERE date >= ? ORDER BY date DESC"
  ).all(ago14);

  const recentRecovery = db.prepare(
    "SELECT * FROM whoop_recovery WHERE date >= ? ORDER BY date DESC"
  ).all(ago14);

  const recentJournal = db.prepare(
    "SELECT * FROM journal WHERE date >= ? ORDER BY date DESC"
  ).all(ago14);

  const goals = db.prepare("SELECT * FROM goals").all();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const weeklyMileage = db.prepare(`
    SELECT COALESCE(SUM(distance_meters), 0) as total
    FROM coros_activities
    WHERE type = 'run' AND date >= ?
  `).get(weekStartStr);

  const longestRun = db.prepare(`
    SELECT MAX(distance_meters) as max_dist
    FROM coros_activities
    WHERE type = 'run' AND date >= ?
  `).get(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  return {
    today: {
      date: today,
      weekday: weekdayOf(today),
      whoopRecovery: todayWhoop ?? null,
      journalEntry: todayJournal ?? null,
    },
    // Explicit connection status per source — don't make the model infer
    // this from data presence/absence, same reasoning as weekdayOf() above.
    connectedSources: {
      whoop: whoopHasToken(),
      strava: stravaHasToken(),
    },
    // recentActivities.source tells you which integration each row came
    // from ("whoop" | "strava" | "fit" for manually-imported .fit files);
    // cite it when asked where specific data came from.
    recentActivities: recentActivities.map(a => ({ ...toImperialActivity(a), weekday: weekdayOf(a.date) })),
    recentRecovery,
    recentJournal,
    goals,
    weeksToRace,
    weeklyMiles: +metersToMiles(weeklyMileage.total).toFixed(1),
    longestRunMiles: +metersToMiles(longestRun.max_dist ?? 0).toFixed(2),
  };
}

export async function getBriefing() {
  const context = buildContext();

  // Public demo builds don't make live Anthropic calls — see demoCoach.js.
  if (isDemoMode()) return getDemoBriefing(context);

  const userMessage = `Today is ${context.today.weekday}, ${context.today.date}. Every date below carries its own weekday — use those, never compute a weekday yourself.\n\nHere is Justin's current training data:\n\n${JSON.stringify(context, null, 2)}\n\nGenerate today's morning briefing as a JSON object with exactly these fields:\n{\n  "readiness": "high | moderate | low",\n  "todayRecommendation": "2-4 specific, actionable sentences",\n  "watchOuts": ["specific flags with real numbers"],\n  "weeklySnapshot": "1-2 sentences on the week",\n  "coachNote": "PUNCHY closing line — the single sharpest takeaway. 1-2 short sentences, ~30 words MAX, must fit in 3 lines. No preamble, no hedging. Make it land."\n}\n\nReturn only valid JSON, no markdown.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = message.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return { readiness: 'moderate', todayRecommendation: raw, watchOuts: [], weeklySnapshot: '', coachNote: '' };
  }
}

export async function* streamChat(messages) {
  const context = buildContext();

  // Public demo builds don't make live Anthropic calls — see demoCoach.js.
  if (isDemoMode()) {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
    const reply = getDemoChatReply(lastUserMessage, context);
    for await (const chunk of streamDemoReply(reply)) yield chunk;
    return;
  }

  const contextMsg = `[Today is ${context.today.weekday}, ${context.today.date}. Every date below carries its own weekday — use those, never compute a weekday yourself. connectedSources shows which integrations are actually connected right now; recentActivities[].source shows which one each activity came from ("whoop" | "strava" | "fit" for manually-imported .fit files) — cite these directly instead of saying you don't know. Current training context: ${JSON.stringify(context)}]\n\n`;
  const augmentedMessages = [
    { role: 'user', content: contextMsg + messages[0].content },
    ...messages.slice(1),
  ];

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: augmentedMessages,
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
      yield chunk.delta.text;
    }
  }
}
