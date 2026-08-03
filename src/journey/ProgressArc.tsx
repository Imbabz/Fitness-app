import type { Block, Session } from '../types';

const BLOCK_COLOR: Record<Block, string> = {
  warmup: 'bg-warmup',
  main: 'bg-main',
  spine: 'bg-spine',
  mobility: 'bg-mobility',
};

/**
 * Pinned to the top of the journey. Segmented by block and colour-coded, so the
 * spine block is visible ahead as a distinct stretch of terrain — the user
 * should always know how far in they are and what is coming.
 */
export function ProgressArc({ session, stageIndex }: { session: Session; stageIndex: number }) {
  return (
    <div className="flex w-full gap-[3px]" aria-hidden="true">
      {session.exercises.map((ex, i) => {
        const done = i < stageIndex;
        const current = i === stageIndex;
        return (
          <div key={ex.id} className="h-1 flex-1 overflow-hidden rounded-full bg-line/50">
            <div
              className={[
                'h-full rounded-full transition-all duration-300',
                BLOCK_COLOR[ex.block],
                done ? 'w-full opacity-100' : current ? 'w-full opacity-60' : 'w-0 opacity-0',
              ].join(' ')}
            />
          </div>
        );
      })}
    </div>
  );
}
