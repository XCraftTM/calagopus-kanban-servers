import {
  faArrowRightArrowLeft,
  faBan,
  faCheck,
  faClone,
  faEgg,
  faEllipsis,
  faHardDrive,
  faMemory,
  faMicrochip,
  faNetworkWired,
  faPlay,
  faRotateRight,
  faSkull,
  faStop,
  faTrash,
  faTriangleExclamation,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { memo, useCallback, useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuActionItem, ContextMenuItem } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { formatAllocation, serverStatusInfo } from '@/lib/domain/server.ts';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { formatMilliseconds } from '@/lib/format/time.ts';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { useBulkPowerActions } from '@/plugins/server/useBulkPowerActions.ts';
import { useServerStats } from '@/plugins/server/useServerStats.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';
import type { Server } from '../../lib/api.ts';
import { MAX_SERVERS_PER_GROUP, UNGROUPED_ID } from '../../lib/constants.ts';
import { sortGroups, useBoardActionsContext } from '../../lib/useBoardActions.ts';
import { useExtTranslations } from '../../translations.ts';
import Chip from './Chip.tsx';

const powerStateColor = {
  running: 'green',
  starting: 'yellow',
  stopping: 'orange',
  offline: 'red',
} as const;

const powerStateStripe = {
  running: 'var(--color-server-status-running, var(--mantine-color-green-filled))',
  starting: 'var(--color-server-status-starting, var(--mantine-color-yellow-filled))',
  stopping: 'var(--color-server-status-stopping, var(--mantine-color-orange-filled))',
  offline: 'var(--color-server-status-offline, var(--mantine-color-red-filled))',
} as const;

function usageColor(percent: number | null) {
  if (percent === null) return 'gray';
  if (percent >= 90) return 'red';
  if (percent >= 75) return 'yellow';

  return 'gray';
}

const percentOf = (used: number, limit: number) => (limit > 0 ? (used / limit) * 100 : null);

// chips are tiny, so drop the decimals once the number has two digits ("5.9 GiB", "102 MiB")
const compactBytes = (bytes: number) => {
  const full = bytesToString(bytes, 1, true);
  const value = Number.parseFloat(full);

  return Number.isFinite(value) && value >= 10 ? bytesToString(bytes, 0, true) : full;
};

function ServerCard({
  server,
  columnId,
  isSelected = false,
  selectionActive = false,
  onSelectionChange,
  onClick,
  sKeyPressedRef,
  overlay = false,
}: {
  server: Server;
  columnId: string;
  isSelected?: boolean;
  selectionActive?: boolean;
  onSelectionChange?: (server: Server, selected: boolean) => void;
  onClick?: (server: Server, event: React.MouseEvent) => void;
  sKeyPressedRef?: React.RefObject<boolean>;
  overlay?: boolean;
}) {
  const { t } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const { user } = useAuth();
  const actions = useBoardActionsContext();
  const serverGroups = useUserStore((state) => state.serverGroups);
  const stats = useServerStats(server);
  const { handleBulkPowerAction, bulkActionLoading } = useBulkPowerActions();

  const [killOpen, setKillOpen] = useState(false);

  const state = stats?.state;
  const powerBlocked = !!server.status || server.isSuspended || server.isTransferring || server.nodeMaintenanceEnabled;

  const permissionSet = useMemo(
    () => new Set([...server.permissions, ...(user?.role?.serverPermissions ?? [])]),
    [server.permissions, user?.role?.serverPermissions],
  );
  const canPower = useCallback(
    (action: string) => permissionSet.has('*') || permissionSet.has(action),
    [permissionSet],
  );
  const doPowerAction = useCallback(
    (action: z.infer<typeof serverPowerAction>) => handleBulkPowerAction([server.uuid], action),
    [handleBulkPowerAction, server.uuid],
  );

  const menuItems: ContextMenuItem[] = useMemo(() => {
    const groups = sortGroups(serverGroups);
    const inGroup = columnId !== UNGROUPED_ID;
    const otherGroups = groups.filter((g) => g.uuid !== columnId && !g.serverOrder.includes(server.uuid));
    const groupItem = (onPick: (uuid: string) => void) => (g: (typeof groups)[number]) =>
      ({
        type: 'action',
        label: g.name,
        disabled: g.serverOrder.length >= MAX_SERVERS_PER_GROUP,
        onClick: () => onPick(g.uuid),
      }) satisfies Omit<ContextMenuActionItem, 'items'>;

    return [
      {
        type: 'action',
        icon: faPlay,
        label: t('common.enum.serverPowerAction.start', {}),
        canAccess: canPower('control.start'),
        disabled: powerBlocked || bulkActionLoading !== null || state !== 'offline',
        onClick: () => doPowerAction('start'),
      },
      {
        type: 'action',
        icon: faRotateRight,
        label: t('common.enum.serverPowerAction.restart', {}),
        canAccess: canPower('control.restart'),
        disabled: powerBlocked || bulkActionLoading !== null || !state,
        onClick: () => doPowerAction('restart'),
      },
      {
        type: 'action',
        icon: faStop,
        label: t('common.enum.serverPowerAction.stop', {}),
        color: 'red',
        canAccess: canPower('control.stop'),
        disabled: powerBlocked || bulkActionLoading !== null || !state || state === 'offline',
        onClick: () => doPowerAction('stop'),
      },
      {
        type: 'action',
        icon: faSkull,
        label: t('common.enum.serverPowerAction.kill', {}),
        color: 'red',
        hidden: state !== 'stopping',
        canAccess: canPower('control.stop'),
        disabled: powerBlocked || bulkActionLoading !== null,
        onClick: () => setKillOpen(true),
      },
      { type: 'divider', hidden: otherGroups.length === 0 && !inGroup },
      {
        type: 'action',
        icon: faArrowRightArrowLeft,
        label: tExt('board.card.moveTo', {}),
        hidden: otherGroups.length === 0,
        items: otherGroups.map(groupItem((uuid) => actions.moveServer(server, columnId, uuid, null))),
      },
      {
        type: 'action',
        icon: faClone,
        label: tExt('board.card.copyTo', {}),
        hidden: !inGroup || otherGroups.length === 0,
        items: otherGroups.map(groupItem((uuid) => actions.addServers(uuid, [server]))),
      },
      {
        type: 'action',
        icon: faTrash,
        label: tExt('board.card.remove', {}),
        color: 'red',
        hidden: !inGroup,
        onClick: () => actions.removeServer(columnId, server),
      },
    ];
  }, [
    actions,
    bulkActionLoading,
    canPower,
    columnId,
    doPowerAction,
    powerBlocked,
    server,
    serverGroups,
    state,
    t,
    tExt,
  ]);

  const blockingStatus = server.isSuspended
    ? { label: t('common.server.state.suspended', {}), color: 'red', icon: faBan }
    : server.isTransferring
      ? { label: t('common.server.state.transferring', {}), color: 'blue', icon: faArrowRightArrowLeft }
      : server.nodeMaintenanceEnabled
        ? { label: t('common.server.state.nodeMaintenance', {}), color: 'orange', icon: faBan }
        : server.status
          ? {
              label: serverStatusInfo[server.status].label(),
              color: serverStatusInfo[server.status].badgeColor,
              icon: serverStatusInfo[server.status].failed ? faTriangleExclamation : undefined,
            }
          : null;

  const stripe = blockingStatus
    ? `var(--mantine-color-${blockingStatus.color}-filled)`
    : state
      ? powerStateStripe[state]
      : 'var(--mantine-color-gray-6)';

  const cpuLimit = server.limits.cpu !== 0 ? `${server.limits.cpu}%` : t('common.unlimited', {});
  const memoryLimitBytes = server.limits.memory !== 0 ? mbToBytes(server.limits.memory) : 0;
  const diskLimitBytes = server.limits.disk !== 0 ? mbToBytes(server.limits.disk) : 0;

  const cpuPercent = stats ? percentOf(stats.cpuAbsolute, server.limits.cpu) : null;
  const memoryPercent = stats ? percentOf(stats.memoryBytes, memoryLimitBytes) : null;
  const diskPercent = stats ? percentOf(stats.diskBytes, diskLimitBytes) : null;

  const address = server.allocation ? formatAllocation(server.allocation) : null;
  const showControls = selectionActive || isSelected;

  return (
    <>
      {!overlay && (
        <ConfirmationModal
          opened={killOpen}
          onClose={() => setKillOpen(false)}
          title={t('pages.server.console.power.modal.forceStop.title', {})}
          confirm={t('common.button.continue', {})}
          onConfirmed={() => {
            setKillOpen(false);
            return doPowerAction('kill');
          }}
        >
          {t('pages.server.console.power.modal.forceStop.content', {}).md()}
        </ConfirmationModal>
      )}

      <ContextMenu enabled={!overlay} items={menuItems}>
        {({ items, openMenu }) => (
          <div
            className='group/card relative min-w-0'
            onClick={(e) => onClick?.(server, e)}
            onContextMenu={(e) => {
              if (overlay) return;
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <NavLink
              to={`/server/${server.uuidShort}`}
              draggable={false}
              className='block min-w-0'
              onClick={(e) => {
                if (sKeyPressedRef?.current) e.preventDefault();
              }}
            >
              <div
                className={classNames(
                  'kanban-card relative overflow-hidden rounded-lg border min-w-0',
                  'bg-(--mantine-color-dark-6) light:bg-white! border-(--mantine-color-default-border)',
                  'shadow-sm transition-[box-shadow,border-color,background-color] duration-150',
                  'hover:border-(--mantine-color-dimmed) hover:shadow-md',
                  isSelected && 'ring-2 ring-(--mantine-color-green-filled)',
                  overlay && 'rotate-2 shadow-xl! cursor-grabbing',
                )}
              >
                <div aria-hidden className='h-1 w-full transition-colors duration-300' style={{ background: stripe }} />

                <div className='flex flex-col gap-1.5 px-2.5 pt-2 pb-2.5'>
                  <div className='flex flex-wrap items-center gap-1 min-h-5'>
                    {blockingStatus ? (
                      <Chip color={blockingStatus.color} icon={blockingStatus.icon}>
                        {blockingStatus.label}
                      </Chip>
                    ) : (
                      <>
                        <Chip
                          color={state ? powerStateColor[state] : 'gray'}
                          dot={state ? powerStateStripe[state] : 'var(--mantine-color-gray-6)'}
                          tooltip={
                            state === 'running' && stats?.uptime
                              ? `${tExt('board.card.uptime', {})}: ${formatMilliseconds(stats.uptime, true, false)}`
                              : undefined
                          }
                        >
                          {tExt(`board.status.${state ?? 'unknown'}`, {})}
                        </Chip>
                        {stats && (
                          <>
                            <Chip
                              icon={faMicrochip}
                              percent={cpuPercent ?? 0}
                              color={usageColor(cpuPercent)}
                              tooltip={`${tExt('board.card.cpu', {})}: ${tExt('board.card.usage', {
                                used: `${stats.cpuAbsolute.toFixed(2)}%`,
                                limit: cpuLimit,
                              })}`}
                            >
                              {stats.cpuAbsolute.toFixed(stats.cpuAbsolute >= 10 ? 0 : 1)}%
                            </Chip>
                            <Chip
                              icon={faMemory}
                              percent={memoryPercent ?? 0}
                              color={usageColor(memoryPercent)}
                              tooltip={`${tExt('board.card.memory', {})}: ${tExt('board.card.usage', {
                                used: bytesToString(stats.memoryBytes),
                                limit: memoryLimitBytes ? bytesToString(memoryLimitBytes) : t('common.unlimited', {}),
                              })}`}
                            >
                              {compactBytes(stats.memoryBytes)}
                            </Chip>
                            <Chip
                              icon={faHardDrive}
                              percent={diskPercent ?? 0}
                              color={usageColor(diskPercent)}
                              tooltip={`${tExt('board.card.disk', {})}: ${tExt('board.card.usage', {
                                used: bytesToString(stats.diskBytes),
                                limit: diskLimitBytes ? bytesToString(diskLimitBytes) : t('common.unlimited', {}),
                              })}`}
                            >
                              {compactBytes(stats.diskBytes)}
                            </Chip>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <div className='flex items-start gap-1 min-w-0'>
                    <p className='flex-1 min-w-0 text-sm font-semibold leading-snug wrap-break-word line-clamp-2'>
                      {server.name}
                    </p>
                    {!overlay && (
                      <div
                        className={classNames(
                          '-mt-0.5 -mr-1 flex shrink-0 items-center gap-0.5 transition-opacity duration-150',
                          showControls
                            ? 'opacity-100'
                            : 'opacity-0 group-hover/card:opacity-100 focus-within:opacity-100',
                        )}
                      >
                        {onSelectionChange && (
                          <Tooltip
                            label={
                              isSelected
                                ? t('pages.account.home.bulkActions.deselect', {})
                                : t('pages.account.home.bulkActions.select', {})
                            }
                          >
                            <ActionIcon
                              size='sm'
                              variant={isSelected ? 'filled' : 'default'}
                              color={isSelected ? 'green' : 'gray'}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSelectionChange(server, !isSelected);
                              }}
                            >
                              <FontAwesomeIcon icon={faCheck} className='text-[10px]' />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {items.some((item) => !item.hidden && item.canAccess !== false && item.type === 'action') && (
                          <Tooltip label={tExt('board.card.menu', {})}>
                            <ActionIcon
                              size='sm'
                              variant='default'
                              color='gray'
                              loading={bulkActionLoading !== null}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                openMenu(rect.left, rect.bottom);
                              }}
                            >
                              <FontAwesomeIcon icon={faEllipsis} className='text-[11px]' />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>

                  {server.description && (
                    <p className='text-xs leading-snug text-(--mantine-color-dimmed) line-clamp-2 wrap-break-word'>
                      {server.description}
                    </p>
                  )}

                  <div className='flex flex-wrap items-center gap-1 mt-0.5 min-w-0'>
                    {address ? (
                      <CopyOnClick content={address} className='min-w-0 max-w-full'>
                        <Chip icon={faNetworkWired} tooltip={tExt('board.card.address', {})} className='cursor-pointer'>
                          <RedactedText value={address} />
                        </Chip>
                      </CopyOnClick>
                    ) : (
                      <Chip icon={faNetworkWired}>{t('common.server.noAllocation', {})}</Chip>
                    )}
                    <Chip icon={faEgg} tooltip={tExt('board.card.egg', {})}>
                      {server.egg.name}
                    </Chip>
                    {!server.isOwner && <Chip color='yellow' icon={faUsers} tooltip={tExt('board.card.owner', {})} />}
                  </div>
                </div>
              </div>
            </NavLink>
          </div>
        )}
      </ContextMenu>
    </>
  );
}

export default memo(ServerCard);
