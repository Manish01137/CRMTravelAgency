import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Check, Mail, MessageSquareText, Send } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ChannelStatus, CommunicationLog, Lead } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { LeadPicker } from '@/components/communications/LeadPicker';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSmartTime } from '@/lib/format';

function EmailPanel({ lead, connected }: { lead: Lead; connected: boolean }) {
  const queryClient = useQueryClient();
  const [to, setTo] = useState(lead.email ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post<CommunicationLog>(`/communications/leads/${lead.id}/email`, { to: to.trim(), subject: subject.trim(), body: body.trim() }),
    onSuccess: () => {
      toast.success('Email sent');
      setSubject('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['comm-log', lead.id] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Send failed'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-5 text-primary" /> Email
        </CardTitle>
        <CardDescription>Send from this lead — e.g. a package PDF or a follow-up.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!connected && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Connect Email in Settings → Channels first.</p>
        )}
        <Field label="To" htmlFor="commEmailTo">
          <Input id="commEmailTo" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="traveller@example.com" />
        </Field>
        <Field label="Subject" htmlFor="commEmailSubject">
          <Input id="commEmailSubject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Your Kashmir package" />
        </Field>
        <Field label="Message" htmlFor="commEmailBody">
          <Textarea id="commEmailBody" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
        </Field>
        <Button
          size="sm"
          disabled={!connected || !to.trim() || !subject.trim() || !body.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Spinner className="size-4" /> : <Send className="size-4" />} Send email
        </Button>
      </CardContent>
    </Card>
  );
}

function SmsPanel({ lead, connected }: { lead: Lead; connected: boolean }) {
  const queryClient = useQueryClient();
  const [to, setTo] = useState(lead.phone ?? '');
  const [body, setBody] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post<CommunicationLog>(`/communications/leads/${lead.id}/sms`, { to: to.trim(), body: body.trim() }),
    onSuccess: () => {
      toast.success('SMS sent');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['comm-log', lead.id] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Send failed'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="size-5 text-primary" /> SMS
        </CardTitle>
        <CardDescription>Booking confirmations and follow-up nudges — a fallback to WhatsApp.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!connected && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Connect SMS in Settings → Channels first.</p>
        )}
        <Field label="To" htmlFor="commSmsTo">
          <Input id="commSmsTo" value={to} onChange={(e) => setTo(e.target.value)} placeholder="+91 98200 55012" />
        </Field>
        <Field label="Message" htmlFor="commSmsBody" hint={`${body.length}/1600`}>
          <Textarea id="commSmsBody" rows={5} maxLength={1600} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
        </Field>
        <Button size="sm" disabled={!connected || !to.trim() || !body.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? <Spinner className="size-4" /> : <Send className="size-4" />} Send SMS
        </Button>
      </CardContent>
    </Card>
  );
}

function SendLog({ leadId }: { leadId: string }) {
  const logQuery = useQuery({
    queryKey: ['comm-log', leadId],
    queryFn: () => api.get<CommunicationLog[]>(`/communications/leads/${leadId}/log`),
  });
  const items = logQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send history</CardTitle>
        <CardDescription>Email and SMS sent to this lead, most recent first.</CardDescription>
      </CardHeader>
      <CardContent>
        {logQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Send />} title="No messages yet" description="Sent emails and SMS will appear here." className="border-none py-8" />
        ) : (
          <div className="space-y-2">
            {items.map((log) => (
              <div key={log.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {log.channel === 'EMAIL' ? <Mail className="size-3.5 text-muted-foreground" /> : <MessageSquareText className="size-3.5 text-muted-foreground" />}
                    <span className="text-sm font-medium text-foreground">{log.toAddress}</span>
                  </div>
                  <Badge variant={log.status === 'SENT' ? 'success' : 'destructive'} className="gap-1">
                    {log.status === 'SENT' ? <Check className="size-3" /> : <AlertCircle className="size-3" />}
                    {log.status === 'SENT' ? 'Sent' : 'Failed'}
                  </Badge>
                </div>
                {log.subject && <p className="mt-1 text-sm font-medium text-foreground">{log.subject}</p>}
                <p className={cn('mt-0.5 line-clamp-2 text-xs text-muted-foreground')}>{log.body}</p>
                {log.errorMessage && <p className="mt-1 text-xs text-red-600">{log.errorMessage}</p>}
                <p className="mt-1.5 text-[11px] text-muted-foreground">{formatSmartTime(log.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CommunicationsPage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const channelsQuery = useQuery({ queryKey: ['channels'], queryFn: () => api.get<ChannelStatus[]>('/channels') });
  const emailConnected = channelsQuery.data?.find((c) => c.channel === 'EMAIL')?.status === 'CONNECTED';
  const smsConnected = channelsQuery.data?.find((c) => c.channel === 'SMS')?.status === 'CONNECTED';

  return (
    <div>
      <PageHeader title="Communications" description="Send an email or SMS from a lead, and see its send history." />

      <div className="mb-5 max-w-md">
        <LeadPicker selected={selectedLead} onSelect={setSelectedLead} />
      </div>

      {!selectedLead ? (
        <EmptyState
          icon={<Send />}
          title="Search for a lead"
          description="Pick a lead above to send them an email or SMS, and view what's already been sent."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <EmailPanel lead={selectedLead} connected={emailConnected} />
            <SmsPanel lead={selectedLead} connected={smsConnected} />
          </div>
          <SendLog leadId={selectedLead.id} />
        </div>
      )}
    </div>
  );
}
