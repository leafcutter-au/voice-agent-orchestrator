export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { loadAgentDetail } from '@/features/pool/pool.loader';
import { AgentDetail } from '@/features/pool/components/agent-detail';

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function AgentDetailPage({ params }: Props) {
  const { agentId } = await params;

  try {
    const { agent, session } = await loadAgentDetail(agentId);
    return <AgentDetail agent={agent} session={session} />;
  } catch {
    notFound();
  }
}
