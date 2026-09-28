import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AiAgentSettings } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * AI Agent Builder — this organization's persona for every AI feature (Bot
 * Flow, Inbox Suggest Reply / Summarize, Package Builder). The Gemini key
 * itself is platform-level, set on the server — nothing to configure here.
 */
export function AiAgentSettingsPage() {
  const queryClient = useQueryClient();
  const [systemPrompt, setSystemPrompt] = useState('');
  const [agencyFacts, setAgencyFacts] = useState('');
  const [tone, setTone] = useState('');

  const settingsQuery = useQuery({ queryKey: ['ai-agent-settings'], queryFn: () => api.get<AiAgentSettings>('/ai-agent/settings') });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSystemPrompt(settingsQuery.data.systemPrompt ?? '');
    setAgencyFacts(settingsQuery.data.agencyFacts ?? '');
    setTone(settingsQuery.data.tone ?? '');
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch<AiAgentSettings>('/ai-agent/settings', {
        systemPrompt: systemPrompt.trim(),
        agencyFacts: agencyFacts.trim(),
        tone: tone.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-settings'] });
      toast.success('AI Agent settings saved');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save settings'),
  });

  return (
    <div>
      <PageHeader
        title="AI Agent"
        description="How the AI sounds and what it knows about your agency — used by Bot Flow, the Inbox's Suggest Reply / Summarize, and the Package Builder's Generate with AI."
      />

      {settingsQuery.isLoading ? (
        <Skeleton className="h-96 max-w-2xl rounded-xl" />
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" /> Persona
            </CardTitle>
            <CardDescription>How the AI should sound and what it should know about your agency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {settingsQuery.data && !settingsQuery.data.aiEnabled && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                AI features aren't enabled on this server yet — contact your administrator. You can still save your persona now.
              </p>
            )}
            <Field label="Tone" htmlFor="aiTone" hint="e.g. 'warm and casual' or 'concise and professional'">
              <Input id="aiTone" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Friendly, warm and professional" />
            </Field>
            <Field label="System prompt / instructions" htmlFor="aiSystemPrompt">
              <Textarea
                id="aiSystemPrompt"
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are the assistant for Wander & Co. Travel — always mention our 24/7 support line if asked about emergencies…"
              />
            </Field>
            <Field label="Key facts about the agency" htmlFor="aiAgencyFacts" hint="Pricing policy, popular destinations, anything the AI should reliably know.">
              <Textarea
                id="aiAgencyFacts"
                rows={4}
                value={agencyFacts}
                onChange={(e) => setAgencyFacts(e.target.value)}
                placeholder="We specialise in Kashmir, Ladakh and Himachal packages. Payment: 30% advance, balance before departure."
              />
            </Field>
            <div className="pt-1">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Spinner className="size-4" />} Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
