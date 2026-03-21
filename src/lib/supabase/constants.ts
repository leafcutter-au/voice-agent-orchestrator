// Consistent cookie name across all Supabase clients.
// This prevents mismatches when the server-side URL (host.docker.internal)
// differs from the client-side URL (127.0.0.1) in containerized deployments.
export const SUPABASE_COOKIE_NAME = 'sb-orchestrator-auth-token';
