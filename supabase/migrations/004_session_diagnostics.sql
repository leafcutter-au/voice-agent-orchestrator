-- Add columns to persist agent diagnostics before container destruction
ALTER TABLE voice_sessions ADD COLUMN pipecat_logs TEXT;
ALTER TABLE voice_sessions ADD COLUMN latency_data JSONB;
