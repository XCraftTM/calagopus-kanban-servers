import { ReactNode } from 'react';
import KanbanBoard from './board/KanbanBoard.tsx';
import ViewToggle, { useBoardView } from './ViewToggle.tsx';

// Swaps the stock grouped-servers content for the board, unless the user picked the classic list.
export default function KanbanSwitch({
  fallback,
  showTitle,
  inlineToggle,
}: {
  fallback: ReactNode;
  showTitle: boolean;
  inlineToggle: boolean;
}) {
  const [view] = useBoardView();

  if (view === 'board') return <KanbanBoard showTitle={showTitle} inlineToggle={inlineToggle} />;

  return inlineToggle ? (
    <>
      <div className='mb-3 flex justify-end'>
        <ViewToggle />
      </div>
      {fallback}
    </>
  ) : (
    fallback
  );
}
