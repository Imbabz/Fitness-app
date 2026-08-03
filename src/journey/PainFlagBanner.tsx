import { AlertTriangle } from 'lucide-react';
import { friendlyDate } from '../lib/time';

/**
 * Domain rule 3. A pain flag raised on a previous session that shared this
 * session's spine work surfaces here, persistently, until a session with the
 * same spine exercises completes without one.
 *
 * It suggests. It never adjusts a weight — every load decision belongs to the
 * user and their physio.
 */
export function PainFlagBanner({ flaggedOn }: { flaggedOn: string }) {
  return (
    <div className="mt-5 flex gap-3 rounded-card border border-danger/40 bg-danger/[0.08] p-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold text-ink">
          You flagged radiating symptoms — {friendlyDate(flaggedOn)}.
        </p>
        <p className="mt-1 text-muted">
          Hold the spine-block load where it is, or take it down a step. If it has happened more
          than once, that is worth a physio appointment rather than another session.
        </p>
      </div>
    </div>
  );
}
