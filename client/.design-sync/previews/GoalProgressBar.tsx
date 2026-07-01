import { GoalProgressBar } from 'push-pal';

// GoalProgressBar sets no background of its own — it's designed to be composed
// inside a dark surface (e.g. GoalCard), where its label relies on var(--text)
// (near-white) reading correctly. Wrap every story in that surface so the
// preview matches how the component actually renders in the product.
const Surface = ({ children }) => (
  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', width: '280px' }}>
    {children}
  </div>
);

export const WeeklyMiles = () => (
  <Surface><GoalProgressBar pct={65} label="Weekly Miles" sublabel="65 / 100 mi" /></Surface>
);

export const MeditationStreak = () => (
  <Surface><GoalProgressBar pct={92} label="Meditation Streak" sublabel="92%" /></Surface>
);

export const ReadingGoalBehind = () => (
  <Surface><GoalProgressBar pct={8} label="Reading Goal" sublabel="8%" color="var(--warn)" /></Surface>
);

export const NoLabel = () => (
  <Surface><GoalProgressBar pct={40} /></Surface>
);
