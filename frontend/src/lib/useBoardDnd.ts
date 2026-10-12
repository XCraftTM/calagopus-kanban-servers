import {
  Active,
  CollisionDetection,
  closestCenter,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  Over,
  pointerWithin,
  rectIntersection,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Server } from './api.ts';
import { UNGROUPED_ID } from './constants.ts';
import { BoardActions, DropBlockReason, dropBlockReason, ServerGroup } from './useBoardActions.ts';

export type Columns = Record<string, string[]>;

export interface CardDragData {
  type: 'card';
  columnId: string;
  serverUuid: string;
  server: Server;
}

export interface ListDragData {
  type: 'list';
  columnId: string;
}

type DragData = CardDragData | ListDragData;

export const cardDndId = (columnId: string, serverUuid: string) => `card:${columnId}:${serverUuid}`;
export const listDndId = (columnId: string) => `list:${columnId}`;

const dataOf = (item: Active | Over | { data: { current?: unknown } }) => item.data.current as DragData | undefined;

export interface ActiveCard {
  dndId: string;
  serverUuid: string;
  server: Server;
  sourceId: string;
}

export function useBoardDnd({
  columns: baseColumns,
  groups,
  actions,
  listDrop = null,
}: {
  columns: Columns;
  groups: ServerGroup[];
  actions: BoardActions;
  // set while lists can be stacked: list drops are then placed by the stacking layout, not the sortable row
  listDrop?: { onDrop: (listUuid: string) => void; onCancel: () => void } | null;
}) {
  const [draft, setDraft] = useState<Columns | null>(null);
  const [activeCard, setActiveCard] = useState<ActiveCard | null>(null);
  const [activeContainer, setActiveContainer] = useState<string | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ columnId: string; reason: DropBlockReason } | null>(null);

  const kindRef = useRef<'card' | 'list' | null>(null);
  const activeCardRef = useRef<ActiveCard | null>(null);
  const containerRef = useRef<string | null>(null);
  const blockedRef = useRef<typeof blocked>(null);
  const draftRef = useRef<Columns | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMoved = useRef(false);

  draftRef.current = draft;
  blockedRef.current = blocked;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      recentlyMoved.current = false;
    });

    return () => cancelAnimationFrame(frame);
  }, [draft]);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (kindRef.current === 'list') {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) => {
          const data = dataOf(container);
          return data?.type === 'list' && data.columnId !== UNGROUPED_ID;
        }),
      });
    }

    const pointerCollisions = pointerWithin(args);
    const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);

    const containers = new Map(args.droppableContainers.map((container) => [container.id, container]));
    const typeOf = (id: UniqueIdentifier) => dataOf(containers.get(id) ?? { data: {} })?.type;

    let overId = collisions.find((c) => typeOf(c.id) === 'card')?.id ?? collisions[0]?.id ?? null;

    // hovering a list's padding or footer: snap to the closest card of that list so the drop lands in order
    if (overId != null && typeOf(overId) === 'list') {
      const listColumn = (dataOf(containers.get(overId)!) as ListDragData).columnId;
      const cards = args.droppableContainers.filter((container) => {
        const data = dataOf(container);
        return data?.type === 'card' && data.columnId === listColumn;
      });

      if (cards.length > 0) {
        overId = closestCenter({ ...args, droppableContainers: cards })[0]?.id ?? overId;
      }
    }

    if (overId != null) {
      lastOverId.current = overId;
      return [{ id: overId }];
    }

    if (recentlyMoved.current) {
      lastOverId.current = args.active.id;
    }

    return lastOverId.current != null ? [{ id: lastOverId.current }] : [];
  }, []);

  const reset = useCallback(() => {
    kindRef.current = null;
    activeCardRef.current = null;
    containerRef.current = null;
    lastOverId.current = null;
    recentlyMoved.current = false;

    setDraft(null);
    setActiveCard(null);
    setActiveContainer(null);
    setActiveListId(null);
    setBlocked(null);
  }, []);

  const onDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const data = dataOf(active);
      lastOverId.current = null;

      if (data?.type === 'list') {
        kindRef.current = 'list';
        setActiveListId(data.columnId);
        return;
      }

      if (data?.type === 'card') {
        const card: ActiveCard = {
          dndId: String(active.id),
          serverUuid: data.serverUuid,
          server: data.server,
          sourceId: data.columnId,
        };

        kindRef.current = 'card';
        activeCardRef.current = card;
        containerRef.current = data.columnId;

        setActiveCard(card);
        setActiveContainer(data.columnId);
        setDraft(Object.fromEntries(Object.entries(baseColumns).map(([id, uuids]) => [id, [...uuids]])));
      }
    },
    [baseColumns],
  );

  const onDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      const card = activeCardRef.current;
      if (kindRef.current !== 'card' || !card || !over) return;

      const overData = dataOf(over);
      const fromId = containerRef.current;
      const toId = overData?.columnId;
      if (!fromId || !toId || !draftRef.current?.[toId]) return;

      if (toId === fromId) {
        if (blockedRef.current) setBlocked(null);
        return;
      }

      const target = groups.find((g) => g.uuid === toId);
      const reason = toId === card.sourceId || !target ? null : dropBlockReason(target, card.serverUuid);
      if (reason) {
        if (blockedRef.current?.columnId !== toId || blockedRef.current.reason !== reason) {
          setBlocked({ columnId: toId, reason });
        }
        return;
      }

      const translated = active.rect.current.translated;
      const isBelowOver =
        overData?.type === 'card' && !!translated && translated.top > over.rect.top + over.rect.height / 2;
      const overServerUuid = overData?.type === 'card' ? overData.serverUuid : null;

      containerRef.current = toId;
      recentlyMoved.current = true;

      setBlocked(null);
      setActiveContainer(toId);
      setDraft((previous) => {
        if (!previous) return previous;

        const fromList = (previous[fromId] ?? []).filter((uuid) => uuid !== card.serverUuid);
        const toList = (previous[toId] ?? []).filter((uuid) => uuid !== card.serverUuid);
        const overIndex = overServerUuid ? toList.indexOf(overServerUuid) : -1;
        const insertAt = overIndex >= 0 ? overIndex + (isBelowOver ? 1 : 0) : toList.length;

        toList.splice(insertAt, 0, card.serverUuid);

        return { ...previous, [fromId]: fromList, [toId]: toList };
      });
    },
    [groups],
  );

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      const kind = kindRef.current;
      const card = activeCardRef.current;
      const containerId = containerRef.current;
      const finalDraft = draftRef.current;
      const wasBlocked = !!blockedRef.current;

      if (kind === 'list') {
        reset();

        if (listDrop) {
          listDrop.onDrop((dataOf(active) as ListDragData).columnId);
          return;
        }

        const overData = over ? dataOf(over) : undefined;
        if (!over || active.id === over.id || overData?.type !== 'list') return;

        const ids = groups.map((g) => g.uuid);
        const from = ids.indexOf((dataOf(active) as ListDragData).columnId);
        const to = ids.indexOf(overData.columnId);
        if (from === -1 || to === -1) return;

        void actions.reorderGroups(arrayMove(ids, from, to));
        return;
      }

      if (kind !== 'card' || !card || !containerId || !finalDraft || wasBlocked) {
        reset();
        return;
      }

      let list = finalDraft[containerId] ?? [];
      const overData = over ? dataOf(over) : undefined;
      if (overData?.type === 'card' && overData.columnId === containerId) {
        const from = list.indexOf(card.serverUuid);
        const to = list.indexOf(overData.serverUuid);
        if (from !== -1 && to !== -1 && from !== to) list = arrayMove(list, from, to);
      }

      // the actions update the store synchronously before their first await, so dropping the draft
      // right after starting them swaps the preview for the real state without a flicker
      let pending: Promise<unknown> | null = null;
      if (containerId === card.sourceId) {
        if (containerId !== UNGROUPED_ID) pending = actions.reorderGroup(containerId, list);
      } else {
        const at = list.indexOf(card.serverUuid);
        const before = at === -1 ? null : (list[at + 1] ?? null);
        pending = actions.moveServer(card.server, card.sourceId, containerId, before);
      }

      reset();
      void pending;
    },
    [actions, groups, listDrop, reset],
  );

  const describeItem = useCallback(
    (item: Active | Over) => {
      const data = dataOf(item);
      if (data?.type === 'card') return data.server.name;
      if (data?.type === 'list') return groups.find((g) => g.uuid === data.columnId)?.name ?? data.columnId;

      return String(item.id);
    },
    [groups],
  );

  // the dragged card keeps its original dnd id while it travels between lists
  const cardIdFor = useCallback(
    (columnId: string, serverUuid: string) =>
      activeCard && activeCard.serverUuid === serverUuid && activeContainer === columnId
        ? activeCard.dndId
        : cardDndId(columnId, serverUuid),
    [activeCard, activeContainer],
  );

  return {
    columns: draft ?? baseColumns,
    dragging: activeCard !== null || activeListId !== null,
    activeCard,
    activeContainer,
    activeListId,
    blocked,
    cardIdFor,
    collisionDetection,
    describeItem,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel: () => {
      reset();
      listDrop?.onCancel();
    },
  };
}
