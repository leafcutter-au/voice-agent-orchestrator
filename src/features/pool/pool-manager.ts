import 'server-only';

import { getLogger } from '@/lib/logger';
import { createPoolService } from './pool.service';

declare global {
  // eslint-disable-next-line no-var
  var __poolManager: PoolManager | undefined;
}

export function getPoolManager(): PoolManager {
  if (!globalThis.__poolManager) {
    globalThis.__poolManager = new PoolManager();
    globalThis.__poolManager.start();
  }
  return globalThis.__poolManager;
}

const HEALTH_INTERVAL_MS = 10_000;
const RECONCILE_INTERVAL_MS = 30_000;

class PoolManager {
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private reconcileTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;

    const logger = getLogger();
    logger.info('Pool manager starting');

    const service = createPoolService();

    // Initial reconciliation
    service.reconcilePool().catch((e) =>
      logger.error({ error: e }, 'Initial reconciliation failed'),
    );

    // Health check loop
    this.healthTimer = setInterval(() => {
      service.healthCheck().catch((e) =>
        logger.error({ error: e }, 'Health check failed'),
      );
    }, HEALTH_INTERVAL_MS);

    // Reconciliation loop
    this.reconcileTimer = setInterval(() => {
      service.reconcilePool().catch((e) =>
        logger.error({ error: e }, 'Reconciliation failed'),
      );
    }, RECONCILE_INTERVAL_MS);

    logger.info('Pool manager started');
  }

  stop() {
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    this.started = false;
    getLogger().info('Pool manager stopped');
  }
}
