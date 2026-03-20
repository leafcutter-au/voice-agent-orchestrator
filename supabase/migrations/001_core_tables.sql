CREATE TABLE pool_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'starting'
    CHECK (status IN ('starting', 'warm', 'active', 'draining', 'failed')),
  host_port INTEGER,
  internal_ip VARCHAR(45),
  session_id UUID,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_at TIMESTAMPTZ,
  last_health_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_agent_id UUID REFERENCES pool_agents(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'connecting', 'active', 'completed', 'failed', 'cancelled')),
  meeting_url TEXT NOT NULL,
  interview_config JSONB NOT NULL,
  stakeholder_name VARCHAR(255),
  stakeholder_role VARCHAR(255),
  callback_url TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pool_agents_status ON pool_agents(status);
CREATE INDEX idx_voice_sessions_status ON voice_sessions(status);
CREATE INDEX idx_session_events_session ON session_events(session_id, created_at);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pool_agents_updated_at BEFORE UPDATE ON pool_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER voice_sessions_updated_at BEFORE UPDATE ON voice_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add FK from pool_agents.session_id to voice_sessions after both tables exist
ALTER TABLE pool_agents ADD CONSTRAINT fk_pool_agent_session
  FOREIGN KEY (session_id) REFERENCES voice_sessions(id) ON DELETE SET NULL;
