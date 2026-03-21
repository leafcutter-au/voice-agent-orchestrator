'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type SessionRow = Database['public']['Tables']['voice_sessions']['Row'];

async function fetchSessions() {
  const supabase = createClient();

  const { data, error, count } = await supabase
    .from('voice_sessions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<SessionRow[]>();

  if (error) throw error;
  return { sessions: (data ?? []) as SessionRow[], count: count ?? 0 };
}

export function useSessionsData(initialData?: {
  sessions: SessionRow[];
  count: number;
}) {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    initialData: initialData
      ? { sessions: initialData.sessions, count: initialData.count }
      : undefined,
    refetchInterval: 30_000,
  });
}

async function fetchRecentSessions() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('voice_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
    .returns<SessionRow[]>();

  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

export function useRecentSessions(initialData?: SessionRow[]) {
  return useQuery({
    queryKey: ['dashboard-sessions'],
    queryFn: fetchRecentSessions,
    initialData,
    refetchInterval: 30_000,
  });
}
