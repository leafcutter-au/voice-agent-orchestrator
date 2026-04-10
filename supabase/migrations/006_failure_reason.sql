-- Add failure_reason column to classify why a session failed
-- Values: participant_no_show, meeting_join_failed, pipeline_error, agent_error
ALTER TABLE voice_sessions ADD COLUMN failure_reason text;
