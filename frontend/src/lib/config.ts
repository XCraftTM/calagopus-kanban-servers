import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';
import { PACKAGE_NAME, queryKeys } from './constants.ts';

export const CARD_GAP_MIN = 0;
export const CARD_GAP_MAX = 32;

// mirrors `KanbanSettings` in src/settings.rs
export const kanbanSettingsSchema = z.object({
  cardGap: z.number().int().min(CARD_GAP_MIN).max(CARD_GAP_MAX),
  allowListStacking: z.boolean(),
});
export type KanbanSettings = z.infer<typeof kanbanSettingsSchema>;

export const defaultKanbanSettings: KanbanSettings = { cardGap: 8, allowListStacking: false };

export async function getConfig(): Promise<KanbanSettings> {
  const { data } = await axiosInstance.get(`/api/client/extensions/${PACKAGE_NAME}/config`);
  return parseFromApi(kanbanSettingsSchema, data.config);
}

export async function getSettings(): Promise<KanbanSettings> {
  const { data } = await axiosInstance.get(`/api/admin/extensions/${PACKAGE_NAME}/settings`);
  return parseFromApi(kanbanSettingsSchema, data.settings);
}

export async function updateSettings(settings: KanbanSettings): Promise<KanbanSettings> {
  const { data } = await axiosInstance.put(
    `/api/admin/extensions/${PACKAGE_NAME}/settings`,
    serializeForApi(kanbanSettingsSchema, settings),
  );
  return parseFromApi(kanbanSettingsSchema, data.settings);
}

// The board falls back to the defaults while loading or if the backend part is unavailable, so a
// missing config never blocks the board.
export function useKanbanConfig(): KanbanSettings {
  const { data } = useQuery({
    queryKey: queryKeys.config(),
    queryFn: getConfig,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return data ?? defaultKanbanSettings;
}
