import { useInfiniteQuery, useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import getServerGroups from '@/api/me/servers/groups/getServerGroups.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useUserStore } from '@/stores/user.ts';
import { getGroupServers, getOwnServers, type Server } from './api.ts';
import { queryKeys, UNGROUPED_ID } from './constants.ts';
import { sortGroups } from './useBoardActions.ts';
import type { Columns } from './useBoardDnd.ts';

export function useBoardData(showUngrouped: boolean) {
  const { addToast } = useToast();
  const serverGroups = useUserStore((state) => state.serverGroups);
  const setServerGroups = useUserStore((state) => state.setServerGroups);
  const [groupsLoading, setGroupsLoading] = useState(true);

  useEffect(() => {
    getServerGroups()
      .then(setServerGroups)
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setGroupsLoading(false));
  }, [addToast, setServerGroups]);

  const groups = useMemo(() => sortGroups(serverGroups), [serverGroups]);

  const groupQueries = useQueries({
    queries: groups.map((group) => ({
      queryKey: queryKeys.groupServers(group.uuid),
      queryFn: () => getGroupServers(group.uuid),
      staleTime: 30_000,
    })),
  });

  const ungroupedQuery = useInfiniteQuery({
    queryKey: queryKeys.ungrouped(),
    queryFn: ({ pageParam }) => getOwnServers(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.perPage < last.total ? last.page + 1 : undefined),
    enabled: showUngrouped,
    staleTime: 30_000,
  });

  // useQueries hands out a new array on every render, so the memos below key on this instead
  const groupData = groupQueries.map((query) => query.data);
  const groupDataKey = groupQueries
    .map((query) => `${query.status}:${query.dataUpdatedAt}:${query.errorUpdatedAt}`)
    .join(',');
  const ungroupedPages = ungroupedQuery.data?.pages;

  const serverMap = useMemo(() => {
    const map = new Map<string, Server>();

    for (const page of ungroupedPages ?? []) {
      for (const server of page.data) map.set(server.uuid, server);
    }
    for (const servers of groupData) {
      for (const server of servers ?? []) map.set(server.uuid, server);
    }

    return map;
  }, [groupDataKey, ungroupedPages]);

  const loadingGroups = useMemo(
    () => new Set(groups.filter((_, i) => groupQueries[i]?.isPending).map((g) => g.uuid)),
    [groups, groupDataKey],
  );

  const columns = useMemo(() => {
    const result: Columns = {};
    const grouped = new Set<string>();

    for (const group of groups) {
      result[group.uuid] = group.serverOrder.filter((uuid) => serverMap.has(uuid));
      for (const uuid of group.serverOrder) grouped.add(uuid);
    }

    if (showUngrouped) {
      const seen = new Set<string>();
      result[UNGROUPED_ID] = [];

      for (const page of ungroupedPages ?? []) {
        for (const server of page.data) {
          if (grouped.has(server.uuid) || seen.has(server.uuid)) continue;

          seen.add(server.uuid);
          result[UNGROUPED_ID].push(server.uuid);
        }
      }
    }

    return result;
  }, [groups, serverMap, showUngrouped, ungroupedPages]);

  return {
    groups,
    columns,
    serverMap,
    loading: groupsLoading,
    loadingGroups,
    ungrouped: {
      loading: ungroupedQuery.isPending && showUngrouped,
      hasMore: !!ungroupedQuery.hasNextPage,
      loadingMore: ungroupedQuery.isFetchingNextPage,
      loadMore: () => ungroupedQuery.fetchNextPage(),
    },
  };
}
