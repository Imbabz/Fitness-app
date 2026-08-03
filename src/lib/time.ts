/** Local-time YYYY-MM-DD. Never use toISOString() for this — it is UTC and
 *  silently shifts the date for anyone training in the evening west of GMT. */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + delta);
  return todayKey(date);
}

export function daysBetween(a: string, b: string): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const da = new Date(pa[0] ?? 1970, (pa[1] ?? 1) - 1, pa[2] ?? 1).getTime();
  const db = new Date(pb[0] ?? 1970, (pb[1] ?? 1) - 1, pb[2] ?? 1).getTime();
  return Math.round((db - da) / 86_400_000);
}

/** "1:04" / "12:30" — used by every timer. */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${`${s % 60}`.padStart(2, '0')}`;
}

/** "48 min" / "1 h 04" — used on the summit and in history. */
export function humanDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${`${mins % 60}`.padStart(2, '0')}`;
}

export function friendlyDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const diff = daysBetween(key, todayKey());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
