import 'server-only';

import { createServiceRoleClient } from '@/lib/supabase/admin';
import { createPoolApi } from '@/features/pool/pool.api';
import { createSessionsApi } from '@/features/sessions/sessions.api';

export async function loadDashboardData() {
  const client = createServiceRoleClient();
  const poolApi = createPoolApi(client);
  const sessionsApi = createSessionsApi(client);

  const [poolCounts, recentSessions] = await Promise.all([
    poolApi.getStatusCounts(),
    sessionsApi.getRecentSessions(10),
  ]);

  return { poolCounts, recentSessions };
}
