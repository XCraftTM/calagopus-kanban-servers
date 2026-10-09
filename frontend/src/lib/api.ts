import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';
import { MAX_SERVERS_PER_GROUP } from './constants.ts';

export type Server = z.infer<typeof serverSchema>;

export async function getGroupServers(groupUuid: string): Promise<Server[]> {
  const { data } = await axiosInstance.get(`/api/client/servers/groups/${groupUuid}`, {
    params: { page: 1, per_page: MAX_SERVERS_PER_GROUP },
  });

  return parsePaginationFromApi(serverSchema, data.servers).data;
}

export async function getOwnServers(page: number): Promise<Pagination<Server>> {
  const { data } = await axiosInstance.get('/api/client/servers', {
    params: { page, per_page: 100 },
  });

  return parsePaginationFromApi(serverSchema, data.servers);
}
