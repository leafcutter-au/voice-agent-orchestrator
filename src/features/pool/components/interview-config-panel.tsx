'use client';

import { Copy } from 'lucide-react';
import type { Json } from '@/lib/supabase/database.types';

interface InterviewConfigPanelProps {
  config: Json;
}

export function InterviewConfigPanel({ config }: InterviewConfigPanelProps) {
  const cfg = config as Record<string, unknown> | null;
  if (!cfg) return null;

  // The actual config structure uses stakeholder_context, interview_settings, interview_framework
  const stakeholder = (cfg.stakeholder_context ?? cfg.stakeholder) as Record<string, string> | undefined;
  const settings = (cfg.interview_settings ?? cfg.settings) as Record<string, unknown> | undefined;
  const topics = (cfg.interview_framework ?? cfg.topics) as Array<Record<string, unknown>> | undefined;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
  };

  return (
    <div className="border-border rounded-lg border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Interview Config</h3>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded p-1 text-xs"
          title="Copy JSON"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy JSON
        </button>
      </div>

      {stakeholder && (
        <div className="mb-4">
          <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
            Stakeholder
          </h4>
          <div className="text-sm">
            <span className="font-medium">{stakeholder.name}</span>
            {stakeholder.role && (
              <span className="text-muted-foreground"> — {stakeholder.role}</span>
            )}
          </div>
        </div>
      )}

      {settings && (
        <div className="mb-4">
          <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
            Settings
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(settings).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">{key.replaceAll('_', ' ')}:</span>
                <span className="font-mono text-xs">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topics && topics.length > 0 && (
        <div>
          <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
            Topics ({topics.length})
          </h4>
          <div className="space-y-3">
            {topics.map((topic, i) => {
              const name = (topic.topic ?? topic.name) as string;
              return (
                <div key={i} className="border-border rounded border p-3">
                  <div className="text-sm font-medium">{name}</div>
                  {topic.objective ? (
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {String(topic.objective)}
                    </div>
                  ) : null}
                  {topic.target_time_mins != null && (
                    <div className="text-muted-foreground mt-1 text-xs">
                      Target: {String(topic.target_time_mins)} min
                      {topic.max_time_mins != null && ` / Max: ${String(topic.max_time_mins)} min`}
                    </div>
                  )}
                  {Array.isArray(topic.sub_topics) && topic.sub_topics.length > 0 ? (
                    <div className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                      {(topic.sub_topics as string[]).map((sub, j) => (
                        <div key={j} className="flex items-center gap-1.5">
                          <span className="bg-muted-foreground/30 h-1 w-1 rounded-full" />
                          {String(sub)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
