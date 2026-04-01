import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Client = SupabaseClient<Database>;
type SessionRow = Database['public']['Tables']['voice_sessions']['Row'];
type SessionInsert = Database['public']['Tables']['voice_sessions']['Insert'];
type SessionUpdate = Database['public']['Tables']['voice_sessions']['Update'];
type EventRow = Database['public']['Tables']['session_events']['Row'];
type EventInsert = Database['public']['Tables']['session_events']['Insert'];

export function createSessionsApi(client: Client) {
  return new SessionsApi(client);
}

class SessionsApi {
  constructor(private readonly client: Client) {}

  async createSession(session: SessionInsert): Promise<SessionRow> {
    const { data, error } = await this.client
      .from('voice_sessions')
      .insert(session)
      .select()
      .returns<SessionRow[]>()
      .single();
    if (error) throw error;
    return data;
  }

  async updateSession(id: string, update: SessionUpdate): Promise<SessionRow> {
    const { data, error } = await this.client
      .from('voice_sessions')
      .update(update)
      .eq('id', id)
      .select()
      .returns<SessionRow[]>()
      .single();
    if (error) throw error;
    return data;
  }

  async getSessionById(id: string): Promise<SessionRow> {
    const { data, error } = await this.client
      .from('voice_sessions')
      .select('*')
      .eq('id', id)
      .returns<SessionRow[]>()
      .single();
    if (error) throw error;
    return data;
  }

  async getRecentSessions(limit = 20): Promise<SessionRow[]> {
    const { data, error } = await this.client
      .from('voice_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<SessionRow[]>();
    if (error) throw error;
    return data;
  }

  async getSessionsPaginated(
    page: number,
    pageSize: number,
    status?: string,
  ): Promise<{ data: SessionRow[]; count: number }> {
    let query = this.client
      .from('voice_sessions')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status as SessionRow['status']);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)
      .returns<SessionRow[]>();

    if (error) throw error;
    return { data, count: count ?? 0 };
  }

  async deleteSession(id: string) {
    const { error } = await this.client
      .from('voice_sessions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async insertEvent(event: EventInsert): Promise<EventRow> {
    const { data, error } = await this.client
      .from('session_events')
      .insert(event)
      .select()
      .returns<EventRow[]>()
      .single();
    if (error) throw error;
    return data;
  }

  async getEventsBySession(sessionId: string): Promise<EventRow[]> {
    const { data, error } = await this.client
      .from('session_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .returns<EventRow[]>();
    if (error) throw error;
    return data;
  }
}
