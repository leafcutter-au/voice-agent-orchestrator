export const dynamic = 'force-dynamic';

import { loadSessionsList } from '@/features/sessions/sessions.loader';
import { SessionsTable } from '@/features/sessions/components/sessions-table';

interface SessionsPageProps {
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const status = params.status;

  const { data: sessions, count } = await loadSessionsList(page, 20, status);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sessions</h1>
      <SessionsTable sessions={sessions} totalCount={count} />
    </div>
  );
}
