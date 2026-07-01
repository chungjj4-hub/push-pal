import { useState, useEffect } from 'react';

const SORENESS_OPTIONS = ['legs', 'upper_body', 'core', 'back', 'shoulders', 'hips', 'feet'];

export default function JournalCheckIn({ onSaved }) {
  const today = new Date().toISOString().split('T')[0];
  const [existing, setExisting] = useState(null);
  const [form, setForm] = useState({ energy: 3, mood: 3, soreness_areas: [], sleep_quality: null, notes: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/journal?days=1`)
      .then(r => r.json())
      .then(entries => {
        const todayEntry = entries.find(e => e.date === today);
        if (todayEntry) {
          setExisting(todayEntry);
          setForm({
            energy: todayEntry.energy ?? 3,
            mood: todayEntry.mood ?? 3,
            soreness_areas: todayEntry.soreness_areas ?? [],
            sleep_quality: todayEntry.sleep_quality ?? null,
            notes: todayEntry.notes ?? '',
          });
          setSaved(true);
        }
      })
      .catch(() => {});
  }, [today]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, ...form }),
      });
      setSaved(true);
      onSaved?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function toggleSoreness(area) {
    setForm(f => ({
      ...f,
      soreness_areas: f.soreness_areas.includes(area)
        ? f.soreness_areas.filter(a => a !== area)
        : [...f.soreness_areas, area],
    }));
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Daily Check-In</h3>
        {saved && <span style={{ fontSize: '12px', color: 'var(--accent)' }}>✓ Logged</span>}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SliderField label="Energy" value={form.energy} onChange={v => setForm(f => ({ ...f, energy: v }))} />
        <SliderField label="Mood" value={form.mood} onChange={v => setForm(f => ({ ...f, mood: v }))} />

        {form.sleep_quality != null && (
          <div>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Sleep Quality <span style={{ color: 'var(--accent)' }}>(from WHOOP)</span>
            </label>
            <span style={{ fontSize: '24px' }}>{'★'.repeat(form.sleep_quality)}{'☆'.repeat(5 - form.sleep_quality)}</span>
          </div>
        )}

        <div>
          <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Soreness</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SORENESS_OPTIONS.map(area => (
              <button
                key={area}
                type="button"
                onClick={() => toggleSoreness(area)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  border: '1px solid',
                  borderColor: form.soreness_areas.includes(area) ? 'var(--warn)' : 'var(--border)',
                  background: form.soreness_areas.includes(area) ? 'var(--warn)20' : 'transparent',
                  color: form.soreness_areas.includes(area) ? 'var(--warn)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {area.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="How are you feeling today?"
            rows={3}
            style={{
              width: '100%',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 12px',
              color: 'var(--text)',
              fontSize: '14px',
              resize: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : saved ? 'Update Check-In' : 'Save Check-In'}
        </button>
      </form>
    </div>
  );
}

function SliderField({ label, value, onChange }) {
  const EMOJIS = ['', '😴', '😕', '😐', '🙂', '💪'];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</label>
        <span style={{ fontSize: '16px' }}>{EMOJIS[value]}</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)' }}
      />
    </div>
  );
}
