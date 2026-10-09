import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createServerGroup from '@/api/me/servers/groups/createServerGroup.ts';
import deleteServerGroup from '@/api/me/servers/groups/deleteServerGroup.ts';
import getServerGroups from '@/api/me/servers/groups/getServerGroups.ts';
import updateServerGroup from '@/api/me/servers/groups/updateServerGroup.ts';
import updateServerGroupsOrder from '@/api/me/servers/groups/updateServerGroupsOrder.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { getUserStore, useUserStore } from '@/stores/user.ts';
import { useExtTranslations } from '../translations.ts';
import type { Server } from './api.ts';
import { MAX_SERVERS_PER_GROUP, queryKeys, UNGROUPED_ID } from './constants.ts';

export type ServerGroup = z.infer<typeof userServerGroupSchema>;
export type DropBlockReason = 'alreadyInGroup' | 'groupFull';

export function dropBlockReason(group: ServerGroup, serverUuid: string): DropBlockReason | null {
  if (group.serverOrder.includes(serverUuid)) return 'alreadyInGroup';
  if (group.serverOrder.length >= MAX_SERVERS_PER_GROUP) return 'groupFull';

  return null;
}

// Same order the backend lists groups in.
export function sortGroups(groups: ServerGroup[]): ServerGroup[] {
  return [...groups].sort((a, b) => a.order - b.order || a.created.getTime() - b.created.getTime());
}

// Places `serverUuid` into `order` right before `beforeUuid` (or at the end when it is null or unknown).
export function insertBefore(order: string[], serverUuid: string, beforeUuid: string | null): string[] {
  const next = order.filter((uuid) => uuid !== serverUuid);
  const at = beforeUuid ? next.indexOf(beforeUuid) : -1;

  if (at === -1) {
    next.push(serverUuid);
  } else {
    next.splice(at, 0, serverUuid);
  }

  return next;
}

// Applies a new order of the visible servers to the stored order. Servers we could not load
// (e.g. access was revoked) keep their slots at the end so they are never dropped by accident.
export function mergeVisibleOrder(stored: string[], visible: string[]): string[] {
  const visibleSet = new Set(visible);

  return [...visible, ...stored.filter((uuid) => !visibleSet.has(uuid))];
}

export function useBoardActions() {
  const { t, tItem } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const setServerGroups = useUserStore((state) => state.setServerGroups);
  const updateStateServerGroup = useUserStore((state) => state.updateServerGroup);
  const addStateServerGroup = useUserStore((state) => state.addServerGroup);
  const removeStateServerGroup = useUserStore((state) => state.removeServerGroup);

  return useMemo(() => {
    const findGroup = (uuid: string) => getUserStore().serverGroups.find((g) => g.uuid === uuid) ?? null;

    const patchGroupServers = (groupUuid: string, patch: (servers: Server[]) => Server[]) => {
      queryClient.setQueryData<Server[]>(queryKeys.groupServers(groupUuid), (old) => (old ? patch(old) : old));
    };

    const resync = async () => {
      await getServerGroups()
        .then(setServerGroups)
        .catch(() => null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.all });
    };

    const reorderGroup = async (groupUuid: string, visibleOrder: string[]) => {
      const group = findGroup(groupUuid);
      if (!group) return;

      const previous = group.serverOrder;
      const serverOrder = mergeVisibleOrder(previous, visibleOrder);
      if (serverOrder.every((uuid, i) => previous[i] === uuid)) return;

      updateStateServerGroup(groupUuid, { serverOrder });

      await updateServerGroup(groupUuid, { serverOrder }).catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
        updateStateServerGroup(groupUuid, { serverOrder: previous });
      });
    };

    // Moves a server from one column to another. Either side may be the "ungrouped" column, which
    // turns the move into a plain add (from ungrouped) or a plain remove (to ungrouped).
    const moveServer = async (server: Server, fromId: string, toId: string, beforeUuid: string | null) => {
      if (fromId === toId) return;

      const source = fromId === UNGROUPED_ID ? null : findGroup(fromId);
      const target = toId === UNGROUPED_ID ? null : findGroup(toId);
      if ((fromId !== UNGROUPED_ID && !source) || (toId !== UNGROUPED_ID && !target)) return;
      if (target && dropBlockReason(target, server.uuid)) return;

      const previousSource = source?.serverOrder ?? null;
      const previousTarget = target?.serverOrder ?? null;

      const targetOrder = target ? insertBefore(target.serverOrder, server.uuid, beforeUuid) : null;
      const sourceOrder = source ? source.serverOrder.filter((uuid) => uuid !== server.uuid) : null;

      if (target && targetOrder) {
        updateStateServerGroup(target.uuid, { serverOrder: targetOrder });
        patchGroupServers(target.uuid, (servers) => [...servers.filter((s) => s.uuid !== server.uuid), server]);
      }
      if (source && sourceOrder) {
        updateStateServerGroup(source.uuid, { serverOrder: sourceOrder });
        patchGroupServers(source.uuid, (servers) => servers.filter((s) => s.uuid !== server.uuid));
      }

      try {
        // add first, remove second: a failure half-way leaves the server in both lists, never in none
        if (target && targetOrder) await updateServerGroup(target.uuid, { serverOrder: targetOrder });
        if (source && sourceOrder) await updateServerGroup(source.uuid, { serverOrder: sourceOrder });

        if (target && source) {
          addToast(
            t('pages.account.home.tabs.groupedServers.page.drag.toast.moved', { group: target.name }),
            'success',
          );
        } else if (target) {
          addToast(tExt('board.card.toast.added', { group: target.name }), 'success');
        } else if (source) {
          addToast(tExt('board.card.toast.removed', { group: source.name }), 'success');
        }
      } catch (err) {
        addToast(httpErrorToHuman(err), 'error');

        if (target && previousTarget) updateStateServerGroup(target.uuid, { serverOrder: previousTarget });
        if (source && previousSource) updateStateServerGroup(source.uuid, { serverOrder: previousSource });
        await resync();
      }
    };

    const addServers = async (groupUuid: string, servers: Server[]) => {
      const group = findGroup(groupUuid);
      if (!group) return false;

      const toAdd = servers.filter((server) => !group.serverOrder.includes(server.uuid));
      if (!toAdd.length) return true;

      const previous = group.serverOrder;
      const serverOrder = [...previous, ...toAdd.map((server) => server.uuid)];

      return updateServerGroup(groupUuid, { serverOrder })
        .then(() => {
          updateStateServerGroup(groupUuid, { serverOrder });
          patchGroupServers(groupUuid, (current) => [
            ...current,
            ...toAdd.filter((server) => !current.some((s) => s.uuid === server.uuid)),
          ]);
          addToast(
            t('pages.account.home.tabs.groupedServers.page.modal.addServerToGroup.toast.added', {
              servers: tItem('server', toAdd.length),
            }),
            'success',
          );

          return true;
        })
        .catch((err) => {
          addToast(httpErrorToHuman(err), 'error');
          updateStateServerGroup(groupUuid, { serverOrder: previous });

          return false;
        });
    };

    const removeServer = async (groupUuid: string, server: Server) => moveServer(server, groupUuid, UNGROUPED_ID, null);

    const renameGroup = async (groupUuid: string, name: string) => {
      const group = findGroup(groupUuid);
      if (!group || group.name === name) return;

      const previous = group.name;
      updateStateServerGroup(groupUuid, { name });

      await updateServerGroup(groupUuid, { name })
        .then(() => addToast(tExt('board.list.toast.renamed', {}), 'success'))
        .catch((err) => {
          addToast(httpErrorToHuman(err), 'error');
          updateStateServerGroup(groupUuid, { name: previous });
        });
    };

    const deleteGroup = async (group: ServerGroup) =>
      deleteServerGroup(group.uuid)
        .then(() => {
          removeStateServerGroup(group);
          queryClient.removeQueries({ queryKey: queryKeys.groupServers(group.uuid) });
          addToast(
            t('pages.account.home.tabs.groupedServers.page.modal.deleteServerGroup.toast.deleted', {}),
            'success',
          );
        })
        .catch((err) => {
          addToast(httpErrorToHuman(err), 'error');
        });

    const reorderGroups = async (orderedUuids: string[]) => {
      const previous = getUserStore().serverGroups;
      const positions = new Map(orderedUuids.map((uuid, i) => [uuid, i]));

      setServerGroups(previous.map((g) => ({ ...g, order: positions.get(g.uuid) ?? g.order })));

      await updateServerGroupsOrder(orderedUuids).catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
        setServerGroups(previous);
      });
    };

    const createGroup = async (name: string) =>
      createServerGroup({ name, serverOrder: [] })
        .then(async (group) => {
          const existing = sortGroups(getUserStore().serverGroups).map((g) => g.uuid);

          addStateServerGroup(group);
          queryClient.setQueryData<Server[]>(queryKeys.groupServers(group.uuid), []);
          addToast(
            t('pages.account.home.tabs.groupedServers.page.modal.createServerGroup.toast.created', {}),
            'success',
          );

          // new groups get the default order, so pin the new list to the end of the board like Trello does
          await reorderGroups([...existing, group.uuid]);

          return true;
        })
        .catch((err) => {
          addToast(httpErrorToHuman(err), 'error');

          return false;
        });

    return {
      reorderGroup,
      moveServer,
      addServers,
      removeServer,
      renameGroup,
      createGroup,
      deleteGroup,
      reorderGroups,
    };
  }, [
    addStateServerGroup,
    addToast,
    queryClient,
    removeStateServerGroup,
    setServerGroups,
    t,
    tExt,
    tItem,
    updateStateServerGroup,
  ]);
}

export type BoardActions = ReturnType<typeof useBoardActions>;

export const BoardActionsContext = createContext<BoardActions | null>(null);

export function useBoardActionsContext(): BoardActions {
  const actions = useContext(BoardActionsContext);
  if (!actions) throw new Error('useBoardActionsContext must be used inside the Kanban board');

  return actions;
}
