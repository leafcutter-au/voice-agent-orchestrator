import 'server-only';

import { createServiceRoleClient } from '@/lib/supabase/admin';
import { createPoolApi } from './pool.api';

export async function loadPoolData() {
  const client = createServiceRoleClient();
  const api = createPoolApi(client);

  const [agents, counts] = await Promise.all([
    api.getAllAgents(),
    api.getStatusCounts(),
  ]);

  return { agents, counts };
}

export async function loadAgentDetail(agentId: string) {
  const client = createServiceRoleClient();
  const api = createPoolApi(client);
  return api.getAgentWithSession(agentId);
}
