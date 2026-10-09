import { verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  faAnglesLeft,
  faCheckDouble,
  faCircleExclamation,
  faEllipsis,
  faInbox,
  faPalette,
  faPen,
  faPlay,
  faPlus,
  faRotateRight,
  faStop,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { ComponentProps, ReactNode, useState } from 'react';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { DndSortableList, SortableItem } from '@/elements/dnd/DragAndDrop.tsx';
import BlockedOverlay from '@/elements/feedback/BlockedOverlay.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Menu from '@/elements/overlays/Menu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { useBulkPowerActions } from '@/plugins/server/useBulkPowerActions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import type { Server } from '../../lib/api.ts';
import {
  colorToCss,
  GROUP_NAME_MAX,
  GROUP_NAME_MIN,
  isPresetColor,
  type ListColorValue,
  listColors,
  MAX_SERVERS_PER_GROUP,
} from '../../lib/constants.ts';
import { DropBlockReason, ServerGroup, useBoardActionsContext } from '../../lib/useBoardActions.ts';
import type { CardDragData } from '../../lib/useBoardDnd.ts';
import { useExtTranslations } from '../../translations.ts';
import CardComposer from './CardComposer.tsx';
import ListColorModal from './ListColorModal.tsx';
import { listTintStyle, plainListClasses, tintedListClasses } from './listTint.ts';
import ServerCard from './ServerCard.tsx';

export interface CardSelection {
  isSelected: (server: Server) => boolean;
  active: boolean;
  onChange: (server: Server, selected: boolean) => void;
  onManyChange: (servers: Server[], selected: boolean) => void;
  onClick: (server: Server, event: React.MouseEvent) => void;
  sKeyPressedRef: React.RefObject<boolean>;
}

export interface BoardListProps {
  columnId: string;
  group: ServerGroup | null;
  uuids: string[];
  visibleUuids: string[];
  serverMap: Map<string, Server>;
  loading: boolean;
  filterActive: boolean;
  color: ListColorValue | null;
  onColorChange?: (color: ListColorValue | null) => void;
  onCollapse?: () => void;
  isDropTarget: boolean;
  blockedReason: DropBlockReason | null;
  cardIdFor: (columnId: string, serverUuid: string) => string;
  dragHandleProps?: ComponentProps<'div'>;
  selection: CardSelection;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  overlay?: boolean;
}

export function ListShell({
  color,
  isDropTarget = false,
  overlay = false,
  className,
  children,
}: {
  color: ListColorValue | null;
  isDropTarget?: boolean;
  overlay?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={classNames(
        'kanban-list relative flex flex-col w-[var(--kanban-list-width,20rem)] rounded-xl border',
        'max-h-full min-h-24',
        color ? tintedListClasses : plainListClasses,
        'transition-[box-shadow,background-color,border-color] duration-150',
        isDropTarget && 'ring-2 ring-(--mantine-color-blue-filled)',
        overlay && 'rotate-2 shadow-2xl',
        className,
      )}
      style={listTintStyle(color)}
    >
      {color && (
        <div aria-hidden className='h-1.5 shrink-0 rounded-t-[11px]' style={{ backgroundColor: colorToCss(color) }} />
      )}
      {children}
    </div>
  );
}

export default function BoardList({
  columnId,
  group,
  uuids,
  visibleUuids,
  serverMap,
  loading,
  filterActive,
  color,
  onColorChange,
  onCollapse,
  isDropTarget,
  blockedReason,
  cardIdFor,
  dragHandleProps,
  selection,
  footer,
  headerExtra,
  overlay = false,
}: BoardListProps) {
  const { t, tItem } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const actions = useBoardActionsContext();
  const { handleBulkPowerAction, bulkActionLoading } = useBulkPowerActions();

  const [menuOpened, setMenuOpened] = useState(false);
  const [composerOpened, setComposerOpened] = useState(false);
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [colorOpened, setColorOpened] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const title = group?.name ?? tExt('board.ungrouped.title', {});
  const servers = visibleUuids.map((uuid) => serverMap.get(uuid)).filter((server): server is Server => !!server);
  const cardIds = servers.map((server) => cardIdFor(columnId, server.uuid));
  const allSelected = servers.length > 0 && servers.every((server) => selection.isSelected(server));
  const total = group ? group.serverOrder.length : uuids.length;
  const nameValid = name.trim().length >= GROUP_NAME_MIN && name.trim().length <= GROUP_NAME_MAX;

  const startEditing = () => {
    if (!group || overlay) return;
    setName(group.name);
    setEditing(true);
  };

  const submitName = () => {
    if (group && nameValid) void actions.renameGroup(group.uuid, name.trim());
    setEditing(false);
  };

  return (
    <ListShell color={color} isDropTarget={isDropTarget && !blockedReason} overlay={overlay}>
      {group && !overlay && (
        <ConfirmationModal
          opened={deleteOpened}
          onClose={() => setDeleteOpened(false)}
          title={t('pages.account.home.tabs.groupedServers.page.modal.deleteServerGroup.title', {})}
          confirm={t('common.button.delete', {})}
          onConfirmed={() => actions.deleteGroup(group).then(() => setDeleteOpened(false))}
        >
          {t('pages.account.home.tabs.groupedServers.page.modal.deleteServerGroup.content', {
            group: group.name,
          }).md()}
        </ConfirmationModal>
      )}

      {group && onColorChange && !overlay && (
        <ListColorModal
          opened={colorOpened}
          onClose={() => setColorOpened(false)}
          listName={group.name}
          color={color}
          onSave={onColorChange}
        />
      )}

      <BlockedOverlay
        visible={blockedReason === 'alreadyInGroup'}
        icon={faCircleExclamation}
        title={t('pages.account.home.tabs.groupedServers.page.drag.blocked.alreadyInGroup.title', {})}
        description={t('pages.account.home.tabs.groupedServers.page.drag.blocked.alreadyInGroup.description', {
          group: title,
        })}
      />
      <BlockedOverlay
        visible={blockedReason === 'groupFull'}
        icon={faCircleExclamation}
        title={t('pages.account.home.tabs.groupedServers.page.drag.blocked.groupFull.title', {})}
        description={t('pages.account.home.tabs.groupedServers.page.drag.blocked.groupFull.description', {
          max: MAX_SERVERS_PER_GROUP,
        })}
      />

      <div
        {...dragHandleProps}
        className='flex items-center gap-1 pl-3 pr-1.5 pt-2 pb-1.5 shrink-0 select-none'
        style={{ ...dragHandleProps?.style, cursor: dragHandleProps ? (overlay ? 'grabbing' : 'grab') : undefined }}
      >
        {!group && <FontAwesomeIcon icon={faInbox} className='text-xs text-(--mantine-color-dimmed) mr-1' />}

        {editing ? (
          <TextInput
            size='xs'
            autoFocus
            value={name}
            maxLength={GROUP_NAME_MAX}
            error={!nameValid}
            className='flex-1 min-w-0'
            onChange={(e) => setName(e.currentTarget.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={submitName}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') submitName();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <Tooltip label={group ? tExt('board.list.renameHint', {}) : tExt('board.ungrouped.description', {})}>
            <button
              type='button'
              onClick={startEditing}
              className={classNames(
                'text-left text-sm font-semibold leading-tight px-1 py-1 rounded-md wrap-break-word line-clamp-2',
                group && 'hover:bg-(--mantine-color-default-hover) cursor-pointer',
                !group && 'cursor-help',
              )}
            >
              {title}
            </button>
          </Tooltip>
        )}

        {!editing && (
          <span
            className={classNames(
              'ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
              'bg-(--mantine-color-default-hover) text-(--mantine-color-dimmed)',
              group && total >= MAX_SERVERS_PER_GROUP * 0.9 && 'text-(--mantine-color-orange-light-color)!',
            )}
            title={tItem('server', total)}
          >
            {filterActive ? `${servers.length}/${total}` : total}
          </span>
        )}

        {headerExtra}

        {!overlay && group && (
          <Menu opened={menuOpened} onChange={setMenuOpened} shadow='md' width={240} position='bottom-start'>
            <Menu.Target>
              <ActionIcon
                variant='subtle'
                color='gray'
                size='sm'
                aria-label={tExt('board.list.menu.title', {})}
                loading={bulkActionLoading !== null}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <FontAwesomeIcon icon={faEllipsis} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{tExt('board.list.menu.title', {})}</Menu.Label>
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faPlus} />}
                disabled={total >= MAX_SERVERS_PER_GROUP}
                onClick={() => setComposerOpened(true)}
              >
                {tExt('board.list.menu.addServers', {})}
              </Menu.Item>
              <Menu.Item leftSection={<FontAwesomeIcon icon={faPen} />} onClick={startEditing}>
                {tExt('board.list.menu.rename', {})}
              </Menu.Item>
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faCheckDouble} />}
                disabled={servers.length === 0}
                onClick={() => selection.onManyChange(servers, !allSelected)}
              >
                {allSelected ? t('common.button.deselectAll', {}) : tExt('board.list.menu.selectAll', {})}
              </Menu.Item>
              {onCollapse && (
                <Menu.Item leftSection={<FontAwesomeIcon icon={faAnglesLeft} />} onClick={onCollapse}>
                  {tExt('board.list.menu.collapse', {})}
                </Menu.Item>
              )}

              {onColorChange && (
                <>
                  <Menu.Divider />
                  <Menu.Label>
                    <FontAwesomeIcon icon={faPalette} className='mr-1.5' />
                    {tExt('board.list.menu.color', {})}
                  </Menu.Label>
                  <div className='grid grid-cols-7 gap-1.5 px-3 pb-2 pt-1'>
                    {listColors.map((c) => (
                      <button
                        key={c}
                        type='button'
                        aria-label={c}
                        onClick={() => {
                          onColorChange(c === color ? null : c);
                          setMenuOpened(false);
                        }}
                        className={classNames(
                          'h-6 w-full rounded-md transition-transform hover:scale-110',
                          c === color &&
                            'ring-2 ring-offset-1 ring-(--mantine-color-text) ring-offset-(--mantine-color-body)',
                        )}
                        style={{ backgroundColor: colorToCss(c) }}
                      />
                    ))}
                    <button
                      type='button'
                      aria-label={tExt('board.list.menu.customColor', {})}
                      title={tExt('board.list.menu.customColor', {})}
                      onClick={() => {
                        setMenuOpened(false);
                        setColorOpened(true);
                      }}
                      className={classNames(
                        'flex h-6 w-full items-center justify-center rounded-md transition-transform hover:scale-110',
                        color &&
                          !isPresetColor(color) &&
                          'ring-2 ring-offset-1 ring-(--mantine-color-text) ring-offset-(--mantine-color-body)',
                      )}
                      style={{
                        background:
                          color && !isPresetColor(color)
                            ? color
                            : 'conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)',
                      }}
                    >
                      <FontAwesomeIcon icon={faPalette} className='text-[10px] text-white drop-shadow' />
                    </button>
                    <button
                      type='button'
                      aria-label={tExt('board.list.menu.noColor', {})}
                      title={tExt('board.list.menu.noColor', {})}
                      onClick={() => {
                        onColorChange(null);
                        setMenuOpened(false);
                      }}
                      className='h-6 w-full rounded-md border border-dashed border-(--mantine-color-default-border) text-(--mantine-color-dimmed) hover:scale-110 transition-transform'
                    >
                      <FontAwesomeIcon icon={faXmark} className='text-xs' />
                    </button>
                  </div>
                </>
              )}

              <Menu.Divider />
              <Menu.Label>{tExt('board.list.menu.powerAll', {})}</Menu.Label>
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faPlay} />}
                color='green'
                disabled={bulkActionLoading !== null || total === 0}
                onClick={() => handleBulkPowerAction(group.serverOrder, 'start')}
              >
                {t('common.enum.serverPowerAction.start', {})}
              </Menu.Item>
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faRotateRight} />}
                disabled={bulkActionLoading !== null || total === 0}
                onClick={() => handleBulkPowerAction(group.serverOrder, 'restart')}
              >
                {t('common.enum.serverPowerAction.restart', {})}
              </Menu.Item>
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faStop} />}
                color='red'
                disabled={bulkActionLoading !== null || total === 0}
                onClick={() => handleBulkPowerAction(group.serverOrder, 'stop')}
              >
                {t('common.enum.serverPowerAction.stop', {})}
              </Menu.Item>

              <Menu.Divider />
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faTrash} />}
                color='red'
                onClick={() => setDeleteOpened(true)}
              >
                {tExt('board.list.menu.delete', {})}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </div>

      <div className='kanban-list-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pb-1'>
        {loading && servers.length === 0 ? (
          <div className='py-4'>
            <Spinner.Centered />
          </div>
        ) : (
          <DndSortableList id={columnId} items={cardIds} strategy={verticalListSortingStrategy}>
            <div className='flex flex-col gap-2 min-h-10 pb-1'>
              {servers.map((server, i) => (
                <SortableItem
                  key={cardIds[i]}
                  id={cardIds[i]}
                  data={{ type: 'card', columnId, serverUuid: server.uuid, server } satisfies CardDragData}
                >
                  <ServerCard
                    server={server}
                    columnId={columnId}
                    isSelected={selection.isSelected(server)}
                    selectionActive={selection.active}
                    onSelectionChange={selection.onChange}
                    onClick={selection.onClick}
                    sKeyPressedRef={selection.sKeyPressedRef}
                  />
                </SortableItem>
              ))}
              {servers.length === 0 && (
                <div className='flex items-center justify-center rounded-lg border-2 border-dashed border-(--mantine-color-default-border) px-3 py-4 text-center text-xs text-(--mantine-color-dimmed)'>
                  {filterActive && total > 0
                    ? tExt('board.list.noMatches', {})
                    : group
                      ? tExt('board.list.empty', {})
                      : tExt('board.ungrouped.empty', {})}
                </div>
              )}
            </div>
          </DndSortableList>
        )}
      </div>

      <div className='shrink-0 px-2 pb-2 pt-1'>
        {group && !overlay ? (
          <CardComposer group={group} opened={composerOpened} setOpened={setComposerOpened} />
        ) : (
          footer
        )}
      </div>
    </ListShell>
  );
}

export function LoadMoreButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  const { t: tExt } = useExtTranslations();

  return (
    <Button variant='subtle' color='gray' size='xs' fullWidth loading={loading} onClick={onClick}>
      {tExt('board.ungrouped.loadMore', {})}
    </Button>
  );
}
