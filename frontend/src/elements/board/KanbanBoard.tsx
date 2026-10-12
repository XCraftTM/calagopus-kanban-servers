import { DragMoveEvent, useDndMonitor, useDraggable, useDroppable } from '@dnd-kit/core';
import { horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { faCircleInfo, faEyeSlash, faFilter, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  ComponentProps,
  CSSProperties,
  Fragment,
  ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import { DndBoard, DndSortableList, SortableItem } from '@/elements/dnd/DragAndDrop.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { eventKeyMatches } from '@/lib/quickActions/shortcuts.ts';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { useUserSetting } from '@/lib/userSettings.ts';
import BulkActionBar from '@/pages/dashboard/home/BulkActionBar.tsx';
import DashboardHomeTitle from '@/pages/dashboard/home/DashboardHomeTitle.tsx';
import { useBulkPowerActions } from '@/plugins/server/useBulkPowerActions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';
import type { Server } from '../../lib/api.ts';
import { useKanbanConfig } from '../../lib/config.ts';
import {
  type ListColorValue,
  listColorValueSchema,
  type StatusFilter,
  settingKeys,
  statusFilterSchema,
  UNGROUPED_ID,
} from '../../lib/constants.ts';
import {
  applyListMove,
  buildColumns,
  hitTestListTarget,
  type ListDropTarget,
  sameTarget,
  stackFlags,
} from '../../lib/listStacking.ts';
import { BoardActionsContext, type ServerGroup, useBoardActions } from '../../lib/useBoardActions.ts';
import { useBoardData } from '../../lib/useBoardData.ts';
import { type ListDragData, listDndId, useBoardDnd } from '../../lib/useBoardDnd.ts';
import { useFillViewportHeight } from '../../lib/useFillViewportHeight.ts';
import { useExtTranslations } from '../../translations.ts';
import ViewToggle from '../ViewToggle.tsx';
import AddListColumn from './AddListColumn.tsx';
import BoardList, { BoardListProps, CardSelection, ListShell, LoadMoreButton } from './BoardList.tsx';
import CollapsedList from './CollapsedList.tsx';
import ListWidthProbe from './ListWidthProbe.tsx';
import ServerCard from './ServerCard.tsx';

const showUngroupedSchema = z.boolean();
const collapsedSchema = z.record(z.string(), z.boolean());
const colorsSchema = z.record(z.string(), z.string());
const emptyBooleanMap: Record<string, boolean> = {};
const emptyStringMap: Record<string, string> = {};

const LISTS_CONTAINER_ID = 'kanban-lists';

function matchesText(server: Server, query: string) {
  if (!query) return true;

  const haystack = [
    server.name,
    server.description,
    server.egg.name,
    server.nodeName,
    server.locationName,
    server.allocation ? `${server.allocation.ipAlias ?? server.allocation.ip}:${server.allocation.port}` : null,
    server.uuidShort,
  ];

  return haystack.some((value) => value?.toLowerCase().includes(query));
}

function UngroupedColumn(props: Omit<BoardListProps, 'group' | 'columnId'>) {
  const { setNodeRef } = useDroppable({
    id: listDndId(UNGROUPED_ID),
    data: { type: 'list', columnId: UNGROUPED_ID } satisfies ListDragData,
  });

  return (
    <div ref={setNodeRef} className='min-w-0'>
      <BoardList {...props} columnId={UNGROUPED_ID} group={null} />
    </div>
  );
}

// A list inside a stack: draggable by its header and a drop zone for cards, without the sortable row.
function StackedListItem({
  group,
  collapsed,
  children,
}: {
  group: ServerGroup;
  collapsed: boolean;
  children: (dragHandleProps: ComponentProps<'div'>) => ReactNode;
}) {
  const data = useMemo(() => ({ type: 'list', columnId: group.uuid }) satisfies ListDragData, [group.uuid]);
  const draggable = useDraggable({ id: listDndId(group.uuid), data });
  const droppable = useDroppable({ id: listDndId(group.uuid), data });

  const { setNodeRef: setDraggableRef } = draggable;
  const { setNodeRef: setDroppableRef } = droppable;
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableRef(node);
      setDroppableRef(node);
    },
    [setDraggableRef, setDroppableRef],
  );

  const dragHandleProps = useMemo(
    () =>
      ({
        ...draggable.attributes,
        ...draggable.listeners,
        style: { cursor: draggable.isDragging ? 'grabbing' : 'grab', touchAction: 'manipulation' },
      }) as unknown as ComponentProps<'div'>,
    [draggable.attributes, draggable.listeners, draggable.isDragging],
  );

  return (
    <div
      ref={setRef}
      data-kanban-stack-item
      // lists in a stack share the column height (each one scrolls inside); collapsed rows keep their size
      className={collapsed ? 'flex shrink-0 flex-col transition-opacity' : 'flex min-h-0 flex-col transition-opacity'}
      style={{ opacity: draggable.isDragging ? 0.4 : 1 }}
    >
      {children(dragHandleProps)}
    </div>
  );
}

// Tracks where a dragged list would land while stacking is allowed.
function ListDragMonitor({
  boardRef,
  onTarget,
}: {
  boardRef: React.RefObject<HTMLDivElement | null>;
  onTarget: (target: ListDropTarget | null) => void;
}) {
  useDndMonitor({
    onDragMove(event: DragMoveEvent) {
      const board = boardRef.current;
      if (!board || event.active.data.current?.type !== 'list') return;

      let x: number;
      let y: number;
      const start = event.activatorEvent;
      if (start instanceof MouseEvent) {
        x = start.clientX + event.delta.x;
        y = start.clientY + event.delta.y;
      } else if (typeof TouchEvent !== 'undefined' && start instanceof TouchEvent && start.touches[0]) {
        x = start.touches[0].clientX + event.delta.x;
        y = start.touches[0].clientY + event.delta.y;
      } else {
        // keyboard dragging has no pointer: use the middle of the dragged list
        const rect = event.active.rect.current.translated;
        if (!rect) return;
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }

      onTarget(hitTestListTarget(board, x, y));
    },
  });

  return null;
}

const ColumnDropIndicator = () => (
  <div aria-hidden className='w-1 -mx-2 rounded-full bg-(--mantine-color-blue-filled)' />
);
const StackDropIndicator = () => (
  <div aria-hidden className='h-1 shrink-0 -my-2 rounded-full bg-(--mantine-color-blue-filled)' />
);

export default function KanbanBoard({ showTitle, inlineToggle }: { showTitle: boolean; inlineToggle: boolean }) {
  const { t: tExt } = useExtTranslations();
  const { t } = useTranslations();
  const actions = useBoardActions();

  const [showUngrouped, setShowUngrouped] = useUserSetting(settingKeys.showUngrouped, showUngroupedSchema, true);
  const [collapsed, setCollapsed] = useUserSetting(settingKeys.collapsed, collapsedSchema, emptyBooleanMap);
  const [colors, setColors] = useUserSetting(settingKeys.colors, colorsSchema, emptyStringMap);

  const [stacked, setStacked] = useUserSetting(settingKeys.stacked, collapsedSchema, emptyBooleanMap);
  const config = useKanbanConfig();
  const stacking = config.allowListStacking;

  const data = useBoardData(showUngrouped);

  // ---- stacked lists (admin setting): columns of lists, built from the group order + per-user flags ----
  const stackColumns = useMemo(() => buildColumns(data.groups, stacked, stacking), [data.groups, stacked, stacking]);
  const [listTarget, setListTargetState] = useState<ListDropTarget | null>(null);
  const listTargetRef = useRef<ListDropTarget | null>(null);
  const setListTarget = useCallback((target: ListDropTarget | null) => {
    if (sameTarget(listTargetRef.current, target)) return;
    listTargetRef.current = target;
    setListTargetState(target);
  }, []);

  const listDrop = useMemo(() => {
    if (!stacking) return null;

    return {
      onDrop: (listUuid: string) => {
        const target = listTargetRef.current;
        setListTarget(null);
        if (!target) return;

        const before = stackColumns.map((column) => column.map((group) => group.uuid));
        const after = applyListMove(before, listUuid, target);
        const order = after.flat();

        if (order.join() !== data.groups.map((group) => group.uuid).join()) void actions.reorderGroups(order);
        setStacked(stackFlags(after));
      },
      onCancel: () => setListTarget(null),
    };
  }, [actions, data.groups, setListTarget, setStacked, stackColumns, stacking]);

  const dnd = useBoardDnd({ columns: data.columns, groups: data.groups, actions, listDrop });

  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const query = useDeferredValue(filter.trim().toLowerCase());
  const filterActive = query.length > 0 || statusFilter !== 'all';

  // only subscribe to live power states while the status filter needs them; the key keeps re-renders rare
  const runningKey = useUserStore((state) =>
    statusFilter === 'all'
      ? ''
      : Object.entries(state.serverResourceUsage)
          .filter(([, usage]) => usage.state === 'running' || usage.state === 'starting')
          .map(([uuid]) => uuid)
          .sort()
          .join(','),
  );
  const running = useMemo(() => new Set(runningKey.split(',')), [runningKey]);

  const matches = useCallback(
    (server: Server) => {
      if (!matchesText(server, query)) return false;
      if (statusFilter === 'running') return running.has(server.uuid);
      if (statusFilter === 'offline') return !running.has(server.uuid);

      return true;
    },
    [query, running, statusFilter],
  );

  const visibleColumns = useMemo(() => {
    const result: Record<string, string[]> = {};
    const dragged = dnd.activeCard?.serverUuid;

    for (const [columnId, uuids] of Object.entries(dnd.columns)) {
      result[columnId] = filterActive
        ? uuids.filter((uuid) => {
            const server = data.serverMap.get(uuid);
            return uuid === dragged || (!!server && matches(server));
          })
        : uuids;
    }

    return result;
  }, [data.serverMap, dnd.activeCard, dnd.columns, filterActive, matches]);

  const matchingCount = useMemo(() => {
    if (!filterActive) return 0;

    const seen = new Set<string>();
    for (const uuids of Object.values(visibleColumns)) for (const uuid of uuids) seen.add(uuid);

    return seen.size;
  }, [filterActive, visibleColumns]);

  // ---- selection (same behaviour as the stock list: checkbox, or hold S and click) ----
  const [selected, setSelected] = useState(new ObjectSet<Server, 'uuid'>('uuid'));
  const sKeyPressedRef = useRef(false);
  const { handleBulkPowerAction, bulkActionLoading } = useBulkPowerActions();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!eventKeyMatches(e, 's')) return;

      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
        sKeyPressedRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (eventKeyMatches(e, 's')) sKeyPressedRef.current = false;
    };
    const onBlur = () => {
      sKeyPressedRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const onSelectionChange = useCallback((server: Server, value: boolean) => {
    setSelected((previous) => {
      const next = previous.clone();
      if (value) {
        next.add(server);
      } else {
        next.delete(server);
      }
      return next;
    });
  }, []);

  const onManySelectionChange = useCallback((servers: Server[], value: boolean) => {
    setSelected((previous) => {
      const next = previous.clone();
      for (const server of servers) {
        if (value) {
          next.add(server);
        } else {
          next.delete(server);
        }
      }
      return next;
    });
  }, []);

  const onCardClick = useCallback((server: Server, event: React.MouseEvent) => {
    if (!sKeyPressedRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    setSelected((previous) => {
      const next = previous.clone();
      if (!next.delete(server)) next.add(server);
      return next;
    });
  }, []);

  const selection: CardSelection = useMemo(
    () => ({
      isSelected: (server) => selected.has(server),
      active: selected.size > 0,
      onChange: onSelectionChange,
      onManyChange: onManySelectionChange,
      onClick: onCardClick,
      sKeyPressedRef,
    }),
    [onCardClick, onManySelectionChange, onSelectionChange, selected],
  );

  const onBulkAction = async (action: z.infer<typeof serverPowerAction>) => {
    await handleBulkPowerAction(selected.keys(), action);
    setSelected(new ObjectSet('uuid'));
  };

  // ---- list preferences ----
  const colorOf = useCallback(
    (uuid: string): ListColorValue | null => {
      const parsed = listColorValueSchema.safeParse(colors[uuid]);
      return parsed.success ? parsed.data : null;
    },
    [colors],
  );

  const setColor = useCallback(
    (uuid: string, color: ListColorValue | null) =>
      setColors((previous) => {
        const next = { ...previous };
        if (color) {
          next[uuid] = color;
        } else {
          delete next[uuid];
        }
        return next;
      }),
    [setColors],
  );

  const setListCollapsed = useCallback(
    (uuid: string, value: boolean) =>
      setCollapsed((previous) => {
        const next = { ...previous };
        if (value) {
          next[uuid] = true;
        } else {
          delete next[uuid];
        }
        return next;
      }),
    [setCollapsed],
  );

  // ---- drag the empty board background to scroll sideways, like Trello ----
  const scrollRef = useRef<HTMLDivElement>(null);
  const onBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    // the board itself or the empty space below a list (its column wrapper), never a list or card
    const target = e.target as HTMLElement;
    const onBackground = target === e.currentTarget || target.parentElement === e.currentTarget;
    if (!element || e.button !== 0 || e.pointerType !== 'mouse' || !onBackground) return;

    const startX = e.clientX;
    const startScroll = element.scrollLeft;
    element.style.cursor = 'grabbing';

    const onMove = (event: PointerEvent) => {
      element.scrollLeft = startScroll - (event.clientX - startX);
    };
    const onUp = () => {
      element.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useFillViewportHeight(scrollRef, !data.loading);

  // lists are as wide as one row of the widest chips needs, but never narrower than 20rem
  const [listWidth, setListWidth] = useState(320);
  const onProbeWidth = useCallback((chipRowWidth: number) => setListWidth(Math.max(320, chipRowWidth + 44)), []);

  const listIds = useMemo(() => data.groups.map((group) => listDndId(group.uuid)), [data.groups]);
  const activeListGroup = dnd.activeListId ? data.groups.find((g) => g.uuid === dnd.activeListId) : null;

  const renderOverlay = () => {
    if (dnd.activeCard) {
      return (
        <div className='w-full cursor-grabbing'>
          <ServerCard server={dnd.activeCard.server} columnId={dnd.activeCard.sourceId} overlay />
        </div>
      );
    }

    if (activeListGroup) {
      if (collapsed[activeListGroup.uuid]) {
        return (
          <CollapsedList
            group={activeListGroup}
            count={activeListGroup.serverOrder.length}
            color={colorOf(activeListGroup.uuid)}
            isDropTarget={false}
            onExpand={() => null}
            orientation={stacking ? 'horizontal' : 'vertical'}
          />
        );
      }

      const preview = (data.columns[activeListGroup.uuid] ?? [])
        .slice(0, 4)
        .map((uuid) => data.serverMap.get(uuid))
        .filter((server): server is Server => !!server);

      return (
        <ListShell color={colorOf(activeListGroup.uuid)} overlay>
          <div className='flex items-center gap-1 px-4 pt-3 pb-2 cursor-grabbing'>
            <span className='text-sm font-semibold truncate'>{activeListGroup.name}</span>
            <span className='ml-auto rounded-full bg-(--mantine-color-default-hover) px-2 py-0.5 text-[11px] font-semibold text-(--mantine-color-dimmed)'>
              {activeListGroup.serverOrder.length}
            </span>
          </div>
          <div className='flex flex-col px-2 pb-2 overflow-hidden' style={{ gap: config.cardGap }}>
            {preview.map((server) => (
              <ServerCard key={server.uuid} server={server} columnId={activeListGroup.uuid} overlay />
            ))}
          </div>
        </ListShell>
      );
    }

    return null;
  };

  const commonListProps = {
    serverMap: data.serverMap,
    filterActive,
    cardIdFor: dnd.cardIdFor,
    selection,
    cardGap: config.cardGap,
  };

  const renderList = (group: ServerGroup, dragHandleProps: ComponentProps<'div'>) => {
    const isDropTarget =
      dnd.blocked?.columnId === group.uuid ||
      (dnd.activeContainer === group.uuid && dnd.activeCard?.sourceId !== group.uuid);

    return collapsed[group.uuid] ? (
      <CollapsedList
        group={group}
        count={group.serverOrder.length}
        color={colorOf(group.uuid)}
        isDropTarget={isDropTarget}
        onExpand={() => setListCollapsed(group.uuid, false)}
        dragHandleProps={dragHandleProps}
        orientation={stacking ? 'horizontal' : 'vertical'}
      />
    ) : (
      <BoardList
        {...commonListProps}
        columnId={group.uuid}
        group={group}
        uuids={dnd.columns[group.uuid] ?? []}
        visibleUuids={visibleColumns[group.uuid] ?? []}
        loading={data.loadingGroups.has(group.uuid)}
        color={colorOf(group.uuid)}
        onColorChange={(color) => setColor(group.uuid, color)}
        onCollapse={() => setListCollapsed(group.uuid, true)}
        isDropTarget={isDropTarget}
        blockedReason={dnd.blocked?.columnId === group.uuid ? dnd.blocked.reason : null}
        dragHandleProps={dragHandleProps}
      />
    );
  };

  return (
    <BoardActionsContext.Provider value={actions}>
      <div className='kanban-root relative' style={{ '--kanban-list-width': `${listWidth}px` } as CSSProperties}>
        <ListWidthProbe onWidth={onProbeWidth} />
        {showTitle && <DashboardHomeTitle />}

        <BulkActionBar
          selectedCount={selected.size}
          onClear={() => setSelected(new ObjectSet('uuid'))}
          onAction={onBulkAction}
          loading={bulkActionLoading}
        />

        <div className='flex flex-wrap items-center gap-2 mb-3'>
          <TextInput
            size='xs'
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
            placeholder={tExt('board.filter.placeholder', {})}
            leftSection={<FontAwesomeIcon icon={faFilter} className='text-xs' />}
            rightSection={
              filter ? (
                <ActionIcon
                  size='xs'
                  variant='subtle'
                  color='gray'
                  aria-label={tExt('board.filter.clear', {})}
                  onClick={() => setFilter('')}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </ActionIcon>
              ) : null
            }
            className='w-full sm:w-64'
          />
          <SegmentedControl
            size='xs'
            value={statusFilter}
            onChange={(value) => setStatusFilter(statusFilterSchema.parse(value))}
            data={[
              { value: 'all', label: tExt('board.filter.status.all', {}) },
              { value: 'running', label: tExt('board.filter.status.running', {}) },
              { value: 'offline', label: tExt('board.filter.status.offline', {}) },
            ]}
          />
          {filterActive && (
            <span className='text-xs text-(--mantine-color-dimmed)'>
              {tExt('board.filter.matching', { count: matchingCount })}
            </span>
          )}
          <div className='ml-auto flex items-center gap-3'>
            <Switch
              size='xs'
              label={tExt('board.ungrouped.show', {})}
              checked={showUngrouped}
              onChange={(e) => setShowUngrouped(e.currentTarget.checked)}
            />
            <Tooltip label={tExt('board.dragHint', {})} multiline w={260} position='bottom-end'>
              <FontAwesomeIcon icon={faCircleInfo} className='text-(--mantine-color-dimmed)' />
            </Tooltip>
            {inlineToggle && <ViewToggle />}
          </div>
        </div>

        {data.loading ? (
          <Spinner.Centered />
        ) : (
          <DndBoard
            collisionDetection={dnd.collisionDetection}
            describeItem={dnd.describeItem}
            onDragStart={dnd.onDragStart}
            onDragOver={dnd.onDragOver}
            onDragEnd={dnd.onDragEnd}
            onDragCancel={dnd.onDragCancel}
            renderOverlay={renderOverlay}
          >
            {stacking && <ListDragMonitor boardRef={scrollRef} onTarget={setListTarget} />}
            <div
              ref={scrollRef}
              onPointerDown={onBoardPointerDown}
              className='kanban-board flex items-start gap-3 overflow-x-auto pb-4 *:h-full *:shrink-0'
            >
              {showUngrouped && (
                <UngroupedColumn
                  {...commonListProps}
                  uuids={dnd.columns[UNGROUPED_ID] ?? []}
                  visibleUuids={visibleColumns[UNGROUPED_ID] ?? []}
                  loading={data.ungrouped.loading}
                  color={null}
                  isDropTarget={dnd.activeContainer === UNGROUPED_ID && dnd.activeCard?.sourceId !== UNGROUPED_ID}
                  blockedReason={null}
                  headerExtra={
                    <Tooltip label={t('common.button.close', {})}>
                      <ActionIcon
                        variant='subtle'
                        color='gray'
                        size='sm'
                        aria-label={t('common.button.close', {})}
                        onClick={() => setShowUngrouped(false)}
                      >
                        <FontAwesomeIcon icon={faEyeSlash} className='text-xs' />
                      </ActionIcon>
                    </Tooltip>
                  }
                  footer={
                    data.ungrouped.hasMore ? (
                      <LoadMoreButton loading={data.ungrouped.loadingMore} onClick={() => data.ungrouped.loadMore()} />
                    ) : null
                  }
                />
              )}

              {stacking ? (
                <>
                  {stackColumns.map((column, columnIndex) => (
                    <Fragment key={column[0].uuid}>
                      {listTarget?.kind === 'column' && listTarget.index === columnIndex && <ColumnDropIndicator />}
                      <div
                        data-kanban-column
                        className='flex w-[var(--kanban-list-width,20rem)] min-h-0 flex-col gap-3'
                      >
                        {column.map((group, listIndex) => (
                          <Fragment key={group.uuid}>
                            {listTarget?.kind === 'stack' &&
                              listTarget.column === columnIndex &&
                              listTarget.index === listIndex && <StackDropIndicator />}
                            <StackedListItem group={group} collapsed={!!collapsed[group.uuid]}>
                              {(dragHandleProps) => renderList(group, dragHandleProps)}
                            </StackedListItem>
                          </Fragment>
                        ))}
                        {listTarget?.kind === 'stack' &&
                          listTarget.column === columnIndex &&
                          listTarget.index === column.length && <StackDropIndicator />}
                      </div>
                    </Fragment>
                  ))}
                  {listTarget?.kind === 'column' && listTarget.index === stackColumns.length && <ColumnDropIndicator />}
                </>
              ) : (
                <DndSortableList id={LISTS_CONTAINER_ID} items={listIds} strategy={horizontalListSortingStrategy}>
                  {data.groups.map((group) => (
                    <SortableItem
                      key={group.uuid}
                      id={listDndId(group.uuid)}
                      data={{ type: 'list', columnId: group.uuid } satisfies ListDragData}
                      renderItem={({ dragHandleProps }) => renderList(group, dragHandleProps)}
                    />
                  ))}
                </DndSortableList>
              )}

              <div>
                <AddListColumn />
              </div>
            </div>
          </DndBoard>
        )}
      </div>
    </BoardActionsContext.Provider>
  );
}
