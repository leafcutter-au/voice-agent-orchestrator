'use client';

import { useState, useTransition } from 'react';
import { updateTestModeAction } from '../server-actions';
import { DEFAULT_INTERVIEWEE_PROFILE } from '../testing.defaults';
import type { TestModeState } from '../testing.state';
import { FlaskConical, RotateCcw, Save } from 'lucide-react';

interface Props {
  initialState: TestModeState;
}

export function TestModeConfig({ initialState }: Props) {
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialState.enabled);

  const profile = initialState.intervieweeProfile ?? DEFAULT_INTERVIEWEE_PROFILE;
  const [personality, setPersonality] = useState(profile.personality);
  const [expertiseStrong, setExpertiseStrong] = useState(profile.expertise.strong.join(', '));
  const [expertiseWeak, setExpertiseWeak] = useState(profile.expertise.weak.join(', '));
  const [instructions, setInstructions] = useState(profile.instructions);

  function parseList(value: string): string[] {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function buildProfile() {
    return {
      personality,
      expertise: {
        strong: parseList(expertiseStrong),
        weak: parseList(expertiseWeak),
      },
      instructions,
    };
  }

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      await updateTestModeAction({
        enabled: next,
        intervieweeProfile: next ? buildProfile() : null,
      });
    });
  }

  function handleSaveProfile() {
    startTransition(async () => {
      await updateTestModeAction({
        enabled,
        intervieweeProfile: buildProfile(),
      });
    });
  }

  function handleResetProfile() {
    const d = DEFAULT_INTERVIEWEE_PROFILE;
    setPersonality(d.personality);
    setExpertiseStrong(d.expertise.strong.join(', '));
    setExpertiseWeak(d.expertise.weak.join(', '));
    setInstructions(d.instructions);
    startTransition(async () => {
      await updateTestModeAction({
        enabled,
        intervieweeProfile: null,
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* Toggle card */}
      <div className="border-border rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-amber-500" />
            <div>
              <h2 className="text-lg font-semibold">Test Mode</h2>
              <p className="text-muted-foreground text-sm">
                When active, agents run simulated text-based interviews instead of joining real meetings.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={isPending}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
              enabled ? 'bg-amber-500' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {enabled && (
          <div className="mt-3 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
            Test mode is active. All new sessions will use a simulated interviewee.
            Results and transcripts flow through the normal pipeline.
          </div>
        )}
      </div>

      {/* Profile editor card */}
      <div className={`border-border rounded-lg border p-6 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="mb-4 text-base font-semibold">Simulated Interviewee Profile</h3>
        <p className="text-muted-foreground mb-4 text-sm">
          Controls how the LLM-powered simulated interviewee behaves. Identity (name, role)
          comes from the interview config sent by Discovery.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Personality</label>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              rows={2}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. Cooperative, gives substantive 2-4 sentence answers"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Strong Expertise</label>
              <input
                type="text"
                value={expertiseStrong}
                onChange={(e) => setExpertiseStrong(e.target.value)}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                placeholder="e.g. benefits tracking, stakeholder engagement"
              />
              <p className="text-muted-foreground mt-1 text-xs">Comma-separated areas of knowledge</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Weak Expertise</label>
              <input
                type="text"
                value={expertiseWeak}
                onChange={(e) => setExpertiseWeak(e.target.value)}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                placeholder="e.g. quantitative risk analysis"
              />
              <p className="text-muted-foreground mt-1 text-xs">Comma-separated knowledge gaps</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. Answer honestly. When asked about weak areas, acknowledge gaps."
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSaveProfile}
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              Save Profile
            </button>
            <button
              onClick={handleResetProfile}
              disabled={isPending}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>

      {/* Info note */}
      <div className="text-muted-foreground text-xs">
        Test mode resets to OFF when the server restarts. The simulated interviewee&apos;s identity
        (name and role) is taken from the interview config — the profile only controls behaviour.
      </div>
    </div>
  );
}
