import 'server-only';

import { createSessionsService } from './sessions.service';

export async function loadSessionsList(page = 1, pageSize = 20, status?: string) {
  const service = createSessionsService();
  return service.getSessionsPaginated(page, pageSize, status);
}

export async function loadSessionDetail(sessionId: string) {
  const service = createSessionsService();
  const [session, events] = await Promise.all([
    service.getSession(sessionId),
    service.getSessionEvents(sessionId),
  ]);
  return { session, events };
}
