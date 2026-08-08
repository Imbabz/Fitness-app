import { Moon } from 'lucide-react';
import { useApp } from '../state/AppStateContext';
import { weekStrip } from '../state/selectors';
import { todayKey } from '../lib/time';

/** Two letters, because single initials cannot tell Tue from Thu or Sat from Sun. */
const DAY_INITIAL = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Last 7 days: a filled dot per completed gym session, a crescent for days the
 *  daily routine was done. */
export function WeekStrip() {
  const { state } = useApp();
  const days = weekStrip(state);
  const today = todayKey();

  return (
    <div className="flex justify-between gap-1">
      {days.map((d) => {
        const [y, m, dd] = d.date.split('-').map(Number);
        const weekday = new Date(y ?? 1970, (m ?? 1) - 1, dd ?? 1).getDay();
        const isToday = d.date === today;
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`text-[10px] font-medium ${isToday ? 'text-ink' : 'text-faint'}`}
            >
              {DAY_INITIAL[weekday]}
            </span>
            <div
              className={[
                'grid h-9 w-full max-w-[2.25rem] place-items-center rounded-lg text-[11px] font-bold transition-colors',
                d.gym
                  ? 'bg-accent/20 text-accent'
                  : isToday
                    ? 'border border-line bg-surface text-faint'
                    : 'bg-surface text-faint',
              ].join(' ')}
            >
              {d.gym ?? ''}
            </div>
            <span className="h-3">
              {d.daily && <Moon size={11} className="text-mobility" fill="currentColor" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}
