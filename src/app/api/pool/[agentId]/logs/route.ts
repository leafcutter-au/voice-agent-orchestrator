import { type NextRequest } from 'next/server';
import { docker } from '@/lib/docker/client';
import { createPoolService } from '@/features/pool/pool.service';
import { getLogger } from '@/lib/logger';
import { validateRequest } from '../auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const authError = await validateRequest(request);
  if (authError) return authError;

  const { agentId } = await params;

  try {
    const service = createPoolService();
    const { agent } = await service.getAgentWithSession(agentId);

    const container = docker.getContainer(agent.container_id);
    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 200,
      timestamps: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      start(controller) {
        const onData = (chunk: Buffer) => {
          // Docker multiplexed stream: 8-byte header per frame
          let offset = 0;
          while (offset + 8 <= chunk.length) {
            const streamType = chunk[offset]; // 1=stdout, 2=stderr
            const size = chunk.readUInt32BE(offset + 4);
            if (offset + 8 + size > chunk.length) break;

            const payload = chunk.subarray(offset + 8, offset + 8 + size).toString('utf-8');
            const lines = payload.split('\n').filter(Boolean);

            for (const line of lines) {
              const event = JSON.stringify({
                text: line,
                stream: streamType === 2 ? 'stderr' : 'stdout',
              });
              controller.enqueue(encoder.encode(`data: ${event}\n\n`));
            }

            offset += 8 + size;
          }
        };

        const onEnd = () => {
          controller.enqueue(encoder.encode('data: {"closed":true}\n\n'));
          controller.close();
        };

        logStream.on('data', onData);
        logStream.on('end', onEnd);
        logStream.on('error', onEnd);

        // Clean up on client disconnect
        request.signal.addEventListener('abort', () => {
          logStream.removeListener('data', onData);
          logStream.removeListener('end', onEnd);
          if ('destroy' in logStream && typeof logStream.destroy === 'function') {
            logStream.destroy();
          }
        });
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (e) {
    getLogger().error({ error: e, agentId }, 'Failed to stream logs');
    return new Response(JSON.stringify({ error: 'Failed to stream logs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
