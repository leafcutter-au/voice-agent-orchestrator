export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { loadSessionDetail } from '@/features/sessions/sessions.loader';
import { SessionDetail } from '@/features/sessions/components/session-detail';

interface SessionDetailPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionDetailPage({
  params,
}: SessionDetailPageProps) {
  const { sessionId } = await params;

  try {
    const { session, events } = await loadSessionDetail(sessionId);
    return <SessionDetail session={session} events={events} />;
  } catch {
    notFound();
  }
}
