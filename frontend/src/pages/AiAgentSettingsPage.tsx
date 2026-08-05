import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot, Check, KeyRound, Unplug } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { AiAgentSettings } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * AI Agent Builder — per-organization Gemini persona + API key. Powers Bot
 * Flow's natural-language field extraction and the Inbox's "Suggest Reply" /
 * "Summarize" actions (human-in-the-loop: nothing here ever auto-sends).
 */
export function AiAgentSettingsPage() {
  const queryClient = useQueryClient();
  const [systemPrompt, setSystemPrompt] = useState('');
  const [agencyFacts, setAgencyFacts] = useState('');
  const [tone, setTone] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

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
        ...(apiKey.trim() && { geminiApiKey: apiKey.trim() }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-settings'] });
      toast.success('AI Agent settings saved');
      setApiKey('');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save settings'),
  });

  const clearKeyMutation = useMutation({
    mutationFn: () => api.delete('/ai-agent/settings/key'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-settings'] });
      toast.success('Gemini API key removed');
    },
  });

  const hasKey = settingsQuery.data?.hasGeminiKey ?? false;

  return (
    <div>
      <PageHeader
        title="AI Agent"
        description="Persona, key facts and your Gemini API key — powers Bot Flow's natural-language understanding and the Inbox's Suggest Reply / Summarize."
      />

      {settingsQuery.isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="size-5 text-primary" /> Persona
              </CardTitle>
              <CardDescription>How the AI should sound and what it should know about your agency.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Tone" htmlFor="aiTone" hint="e.g. 'warm and casual' or 'concise and professional'">
                <Input id="aiTone" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Friendly, warm and professional" />
              </Field>
              <Field label="System prompt / instructions" htmlFor="aiSystemPrompt">
                <Textarea
                  id="aiSystemPrompt"
                  rows={4}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are the assistant for Voyage Travel — always mention our 24/7 support line if asked about emergencies…"
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-5 text-primary" /> Gemini API key
                </CardTitle>
                {hasKey && (
                  <Badge variant="success" className="gap-1">
                    <Check className="size-3" /> Configured
                  </Badge>
                )}
              </div>
              <CardDescription>Your own Google Gemini API key — stored encrypted, never shown again after saving.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label={hasKey ? 'Replace key' : 'API key'} htmlFor="aiGeminiKey">
                <Input id="aiGeminiKey" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza…" />
              </Field>
              {!hasKey && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Without a key, Bot Flow falls back to plain rule matching (no natural-language understanding) and Suggest Reply / Summarize are disabled.
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Spinner className="size-4" />} Save
                </Button>
                {hasKey && (
                  <Button variant="outline" onClick={() => setConfirmClearOpen(true)} disabled={clearKeyMutation.isPending}>
                    <Unplug className="size-4" /> Remove key
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="Remove the Gemini API key?"
        description="Bot Flow, Suggest Reply and Summarize will stop working until you add a new key."
        confirmLabel="Remove"
        destructive
        loading={clearKeyMutation.isPending}
        onConfirm={() => {
          clearKeyMutation.mutate();
          setConfirmClearOpen(false);
        }}
      />
    </div>
  );
}
