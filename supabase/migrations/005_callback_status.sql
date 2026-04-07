-- Track whether results were successfully forwarded to the Discovery callback URL
ALTER TABLE voice_sessions ADD COLUMN callback_status VARCHAR DEFAULT 'pending';
