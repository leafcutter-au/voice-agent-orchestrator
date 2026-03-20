import 'server-only';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getLogger } from '@/lib/logger';

interface EnhanceActionConfig<Schema extends z.ZodType> {
  auth?: boolean;
  schema?: Schema;
}

type ActionFn<Args, Response> = (
  params: Args,
  user?: { id: string; email?: string },
) => Promise<Response>;

export function enhanceAction<
  Schema extends z.ZodType,
  Response,
>(
  fn: ActionFn<z.infer<Schema>, Response>,
  config?: EnhanceActionConfig<Schema>,
) {
  return async (rawInput: z.infer<Schema>): Promise<Response> => {
    const logger = getLogger();

    // Auth check
    if (config?.auth !== false) {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        throw new Error('Unauthorized');
      }
    }

    // Schema validation
    let input = rawInput;
    if (config?.schema) {
      const parsed = config.schema.safeParse(rawInput);
      if (!parsed.success) {
        logger.warn(
          { errors: parsed.error.flatten() },
          'Action validation failed',
        );
        throw new Error(parsed.error.issues[0]?.message ?? 'Validation failed');
      }
      input = parsed.data;
    }

    try {
      return await fn(input);
    } catch (error) {
      logger.error({ error }, 'Action failed');
      throw error;
    }
  };
}
