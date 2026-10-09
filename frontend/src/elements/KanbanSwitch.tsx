import { ReactNode } from 'react';
import KanbanBoard from './board/KanbanBoard.tsx';
import { useBoardView } from './ViewToggle.tsx';

// Swaps the stock grouped-servers content for the board, unless the user picked the classic list.
export default function KanbanSwitch({ fallback }: { fallback: ReactNode }) {
  const [view] = useBoardView();

  return view === 'board' ? <KanbanBoard /> : fallback;
}
