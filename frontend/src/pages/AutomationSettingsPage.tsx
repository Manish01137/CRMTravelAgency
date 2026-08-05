import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Clock, MinusCircle, Zap } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { AutomationSettingsData, FollowUpAttempt } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatSmartTime } from '@/lib/format';

const STATUS_ICON: Record<FollowUpAttempt['status'], React.ReactNode> = {
  SENT: <CheckCircle2 className="size-3.5" />,
  SKIPPED: <MinusCircle className="size-3.5" />,
  FAILED: <AlertCircle className="size-3.5" />,
  PENDING: <Clock className="size-3.5" />,
};
const STATUS_VARIANT: Record<FollowUpAttempt['status'], 'success' | 'muted' | 'destructive' | 'warning'> = {
  SENT: 'success',
  SKIPPED: 'muted',
  FAILED: 'destructive',
  PENDING: 'warning',
};

/**
 * Follow-up automation — nudges a lead if their status hasn't changed and
 * there's been no reply within `delayHours`. Channel-agnostic: picks
 * WhatsApp/Instagram when a live conversation is within window, else Email.
 */
export function AutomationSettingsPage() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [delayHours, setDelayHours] = useState(48);
  const [nudgeMessage, setNudgeMessage] = useState('');

  const settingsQuery = useQuery({ queryKey: ['automation-settings'], queryFn: () => api.get<AutomationSettingsData>('/automation/settings') });
  const attemptsQuery = useQuery({ queryKey: ['automation-attempts'], queryFn: () => api.get<FollowUpAttempt[]>('/automation/attempts') });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setEnabled(settingsQuery.data.enabled);
    setDelayHours(settingsQuery.data.delayHours);
    setNudgeMessage(settingsQuery.data.nudgeMessage ?? '');
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (next: Partial<AutomationSettingsData>) => api.patch<AutomationSettingsData>('/automation/settings', next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-settings'] });
      toast.success('Automation settings saved');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save settings'),
  });

  const attempts = attemptsQuery.data ?? [];

  return (
    <div>
      <PageHeader title="Follow-up Automation" description="Automatically nudge leads that have gone quiet — respects each channel's own rules." />

      {settingsQuery.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Zap className="size-5 text-primary" /> Automatic follow-up nudges
              </CardTitle>
              <Switch
                checked={enabled}
                onCheckedChange={(v) => {
                  setEnabled(v);
                  saveMutation.mutate({ enabled: v });
                }}
              />
            </div>
            <CardDescription>Runs a check every 15 minutes for open leads with no reply and an unchanged status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Nudge after" htmlFor="autoDelay" hint="Hours of silence before a nudge is sent (1-720).">
              <Input id="autoDelay" type="number" min={1} max={720} value={delayHours} onChange={(e) => setDelayHours(Number(e.target.value) || 1)} className="max-w-[140px]" />
            </Field>
            <Field label="Nudge message" htmlFor="autoMessage">
              <Textarea
                id="autoMessage"
                rows={3}
                value={nudgeMessage}
                onChange={(e) => setNudgeMessage(e.target.value)}
                placeholder="Just checking in — happy to help if you still have questions about your trip! Let us know."
              />
            </Field>
            <Button
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ enabled, delayHours, nudgeMessage: nudgeMessage.trim() })}
            >
              {saveMutation.isPending && <Spinner className="size-4" />} Save
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nudge log</CardTitle>
          <CardDescription>Every scheduled check, whether it sent, was skipped, or failed — most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {attemptsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : attempts.length === 0 ? (
            <EmptyState icon={<Zap />} title="No nudges yet" description="Once automation is enabled, attempts will appear here." className="border-none py-8" />
          ) : (
            <div className="space-y-2">
              {attempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{a.lead?.name ?? 'Unknown lead'}</p>
                    <p className={cn('text-xs text-muted-foreground')}>
                      {a.channel} · {formatSmartTime(a.createdAt)}
                      {a.reason && <span className="text-red-600"> — {a.reason}</span>}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[a.status]} className="shrink-0 gap-1">
                    {STATUS_ICON[a.status]} {a.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
