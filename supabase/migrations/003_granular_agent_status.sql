-- Expand agent statuses from simple warm/active to granular lifecycle states
ALTER TABLE pool_agents DROP CONSTRAINT pool_agents_status_check;
ALTER TABLE pool_agents ADD CONSTRAINT pool_agents_status_check
  CHECK (status IN ('starting', 'warm', 'assigned', 'joining', 'in_meeting', 'interviewing', 'draining', 'failed'));

-- Add container_name column
ALTER TABLE pool_agents ADD COLUMN container_name VARCHAR(255);
