export async function register() {
  // Start pool manager on server startup (only in Node.js runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getPoolManager } = await import('@/features/pool/pool-manager');
    getPoolManager();
  }
}
