// Demo-mode stand-in for the AI coach. A public, credential-free portfolio
// demo can't make live Anthropic calls on every visitor's behalf (cost/abuse
// risk on an unauthenticated endpoint) — this generates realistic-reading
// responses from the same buildContext() data a live call would use,
// without ever hitting the API. Keyed off real seeded numbers so it doesn't
// feel like static copy, but it is template text, not model output.

function readinessTier(recoveryScore) {
  if (recoveryScore == null) return 'moderate';
  if (recoveryScore >= 67) return 'high';
  if (recoveryScore >= 34) return 'moderate';
  return 'low';
}

export function getDemoBriefing(context) {
  const { whoopRecovery } = context.today;
  const recovery = whoopRecovery?.recovery_score ?? 62;
  const hrv = whoopRecovery?.hrv_rmssd != null ? Math.round(whoopRecovery.hrv_rmssd) : 58;
  const sleepPct = whoopRecovery?.sleep_performance_pct ?? 78;
  const tier = readinessTier(recovery);
  const weeklyMiles = context.weeklyMiles ?? 0;
  const weeksToRace = context.weeksToRace ?? 16;

  const byTier = {
    high: {
      readiness: 'high',
      todayRecommendation: `Recovery is ${recovery}% and HRV is holding at ${hrv}ms — this is a green light. Lean into today's scheduled session at full intensity; your body is absorbing the training load well.`,
      coachNote: `Recovery's green at ${recovery}%. **Push today** — this is exactly the window the training block needs.`,
    },
    moderate: {
      readiness: 'moderate',
      todayRecommendation: `Recovery is ${recovery}% (yellow) with sleep performance at ${sleepPct}%. Keep today's session in the moderate zone — don't chase a PR, but don't skip it either. Full intensity resumes once recovery clears 67%.`,
      coachNote: `${recovery}% recovery is the manageable zone, not the green zone. **Train smart, not hard** today.`,
    },
    low: {
      readiness: 'low',
      todayRecommendation: `Recovery is ${recovery}% (red) and HRV dropped to ${hrv}ms — this is a genuine downshift day. Cap intensity, shorten the session, and prioritize sleep tonight over any single workout.`,
      coachNote: `Red recovery at ${recovery}% — **protect tonight's sleep**, not today's workout.`,
    },
  };

  const base = byTier[tier];
  return {
    ...base,
    watchOuts: [
      `Sleep performance is ${sleepPct}% — ${sleepPct < 70 ? 'below where it needs to be for full adaptation' : 'solid, keep the routine consistent'}.`,
      `Weekly mileage sits at ${weeklyMiles} mi with ${weeksToRace} weeks to the marathon — ${weeklyMiles < 20 ? 'still early in the build, no need to force volume yet' : 'on pace for the current training block'}.`,
    ],
    weeklySnapshot: `${weeklyMiles} miles logged this week, ${weeksToRace} weeks out from race day. This is demo data — a live briefing would also correlate journal entries and recent workout intensity here.`,
  };
}

const KEYWORD_RESPONSES = [
  {
    keywords: ['strava', 'whoop', 'connect', 'source', 'data come from', 'where'],
    reply: (ctx) => `In this demo, your training data is seeded rather than live-synced — ${ctx.weeklyMiles ?? 0} miles this week, recovery at ${ctx.today.whoopRecovery?.recovery_score ?? '—'}%. The real app pulls this from WHOOP's and Strava's official OAuth2 APIs on an hourly/3-hourly cron, and this same coach reasons over live data instead of a fixed seed set.`,
  },
  {
    keywords: ['recovery', 'hrv', 'sleep', 'rested', 'tired'],
    reply: (ctx) => {
      const r = ctx.today.whoopRecovery;
      if (!r) return `No recovery data logged for today in this demo seed — the live app would flag that and lean on yesterday's trend instead.`;
      return `Recovery is ${r.recovery_score}% today, HRV ${Math.round(r.hrv_rmssd ?? 0)}ms, sleep performance ${r.sleep_performance_pct ?? '—'}%. ${r.recovery_score >= 67 ? "That's green — good day to push." : r.recovery_score >= 34 ? "That's the yellow zone — moderate effort, not a max day." : "That's red — this is a recovery day, not a training day."}`;
    },
  },
  {
    keywords: ['marathon', 'race', 'goal', 'sub-4', 'sub4'],
    reply: (ctx) => `Target is a sub-4:00 marathon on Nov 1 — ${ctx.weeksToRace ?? '—'} weeks out, ${ctx.weeklyMiles ?? 0} miles logged this week, longest recent run ${ctx.longestRunMiles ?? '—'} mi. The real coach tracks this against a full 16-week mileage ramp and flags when the build is behind schedule.`,
  },
  {
    keywords: ['mileage', 'miles', 'pace', 'run'],
    reply: (ctx) => `Weekly mileage: ${ctx.weeklyMiles ?? 0} mi. Longest recent run: ${ctx.longestRunMiles ?? '—'} mi. This is seeded demo data — the live coach cross-references pace against WHOOP heart-rate zones to flag runs that were harder than the plan intended.`,
  },
  {
    keywords: ['soreness', 'sore', 'injury', 'hurt', 'pain'],
    reply: () => `In the live app, this pulls from your journal check-ins (energy, mood, soreness by body part) and correlates it against training load — e.g. "you noted leg fatigue Tuesday, your Wednesday pace dropped." This demo doesn't have live journal correlation wired up.`,
  },
];

const FALLBACK_REPLY = (ctx) =>
  `This is a demo build — the AI coach here uses seeded training data (${ctx.weeklyMiles ?? 0} mi this week, recovery ${ctx.today.whoopRecovery?.recovery_score ?? '—'}%) instead of a live Claude API call, to keep a public demo free to run. Ask about recovery, mileage, the marathon goal, or your data sources to see it respond to the seed data — the real app answers anything, live, grounded in your actual WHOOP/Strava/journal history.`;

export function getDemoChatReply(userMessage, context) {
  const text = (userMessage ?? '').toLowerCase();
  const match = KEYWORD_RESPONSES.find(({ keywords }) => keywords.some(k => text.includes(k)));
  return (match ? match.reply(context) : FALLBACK_REPLY(context));
}

// Splits into word-ish chunks and yields with a small delay, so the chat UI's
// streaming/typing animation still plays instead of the reply appearing all
// at once.
export async function* streamDemoReply(replyText) {
  const chunks = replyText.match(/\S+\s*/g) ?? [replyText];
  for (const chunk of chunks) {
    await new Promise(r => setTimeout(r, 25));
    yield chunk;
  }
}
