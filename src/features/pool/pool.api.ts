import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Client = SupabaseClient<Database>;
type AgentRow = Database['public']['Tables']['pool_agents']['Row'];
type AgentInsert = Database['public']['Tables']['pool_agents']['Insert'];
type AgentUpdate = Database['public']['Tables']['pool_agents']['Update'];

export function createPoolApi(client: Client) {
  return new PoolApi(client);
}

class PoolApi {
  constructor(private readonly client: Client) {}

  async getAgentsByStatus(statuses: AgentRow['status'][]): Promise<AgentRow[]> {
    const { data, error } = await this.client
      .from('pool_agents')
      .select('*')
      .in('status', statuses)
      .order('started_at', { ascending: true })
      .returns<AgentRow[]>();
    if (error) throw error;
    return data;
  }

  async getOldestWarmAgent(): Promise<AgentRow | null> {
    const { data, error } = await this.client
      .from('pool_agents')
      .select('*')
      .eq('status', 'warm')
      .order('started_at', { ascending: true })
      .limit(1)
      .returns<AgentRow[]>();
    if (error) throw error;
    return data?.[0] ?? null;
  }

  async insertAgent(agent: AgentInsert): Promise<AgentRow> {
    const { data, error } = await this.client
      .from('pool_agents')
      .insert(agent)
      .select()
      .returns<AgentRow[]>()
      .single();
    if (error) throw error;
    return data;
  }

  async updateAgent(id: string, update: AgentUpdate): Promise<AgentRow> {
    const { data, error } = await this.client
      .from('pool_agents')
      .update(update)
      .eq('id', id)
      .select()
      .returns<AgentRow[]>()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteAgent(id: string) {
    const { error } = await this.client
      .from('pool_agents')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async getAgentById(id: string): Promise<AgentRow> {
    const { data, error } = await this.client
      .from('pool_agents')
      .select('*')
      .eq('id', id)
      .returns<AgentRow[]>()
      .single();
    if (error) throw error;
    return data;
  }

  async getStatusCounts(): Promise<Record<string, number>> {
    const { data, error } = await this.client
      .from('pool_agents')
      .select('status')
      .returns<Pick<AgentRow, 'status'>[]>();
    if (error) throw error;

    const counts: Record<string, number> = {
      starting: 0,
      warm: 0,
      active: 0,
      draining: 0,
      failed: 0,
    };
    for (const row of data) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return counts;
  }

  async getAllAgents(): Promise<AgentRow[]> {
    const { data, error } = await this.client
      .from('pool_agents')
      .select('*')
      .order('started_at', { ascending: false })
      .returns<AgentRow[]>();
    if (error) throw error;
    return data;
  }
}
