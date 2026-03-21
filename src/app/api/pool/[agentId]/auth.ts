import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Validates request auth via Bearer token OR Supabase session cookie.
 * Returns null if auth is valid, or an error response if not.
 */
export async function validateRequest(request: NextRequest): Promise<NextResponse | null> {
  // Check Bearer token first (external API callers)
  const apiKey = process.env.API_SECRET_KEY;
  const header = request.headers.get('authorization');
  if (apiKey && header === `Bearer ${apiKey}`) {
    return null; // authorized
  }

  // Fall back to Supabase cookie auth (browser requests)
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return null; // authorized
    }
  } catch {
    // cookie parsing failed
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
