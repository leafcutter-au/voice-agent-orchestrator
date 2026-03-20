import type { Json } from '@/lib/supabase/database.types';

interface TopicProgressProps {
  config: Json;
}

export function TopicProgress({ config }: TopicProgressProps) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return null;
  }

  const framework = (config as Record<string, unknown>)
    .interview_framework as Array<{ topic: string; sub_topics: string[] }> | undefined;

  if (!framework) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Topic Progress</h2>
      <div className="grid gap-2">
        {framework.map((topic, i) => (
          <div
            key={i}
            className="border-border flex items-center justify-between rounded-lg border px-4 py-2"
          >
            <div>
              <div className="text-sm font-medium">{topic.topic}</div>
              <div className="text-muted-foreground text-xs">
                {topic.sub_topics.length} sub-topics
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
