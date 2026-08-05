import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { Instagram, MessageCircle, Plus, Trash2, Workflow } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BotFlow, BotFlowAssignment, ChannelStatus } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FormValues {
  name: string;
}

function NewFlowDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({ defaultValues: { name: '' } });

  const mutation = useMutation({
    mutationFn: (v: FormValues) => api.post<BotFlow>('/bot-flows', { name: v.name.trim() }),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: ['bot-flows'] });
      toast.success('Flow created');
      reset();
      onOpenChange(false);
      navigate(`/bot-flows/${flow.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not create flow'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Bot Flow</DialogTitle>
          <DialogDescription>Give it a name, then build the conversation in the canvas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          <Field label="Flow name" htmlFor="flowName" error={errors.name?.message} required>
            <Input id="flowName" placeholder="e.g. Kashmir Enquiry Bot" {...register('name', { required: 'Name is required' })} />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner className="size-4" />} Create & open builder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentsCard() {
  const queryClient = useQueryClient();
  const channelsQuery = useQuery({ queryKey: ['channels'], queryFn: () => api.get<ChannelStatus[]>('/channels') });
  const flowsQuery = useQuery({ queryKey: ['bot-flows'], queryFn: () => api.get<BotFlow[]>('/bot-flows') });
  const assignmentsQuery = useQuery({ queryKey: ['bot-flow-assignments'], queryFn: () => api.get<BotFlowAssignment[]>('/bot-flows/assignments/all') });

  const channels = (channelsQuery.data ?? []).filter((c) => c.channel === 'WHATSAPP' || c.channel === 'INSTAGRAM');
  const flows = flowsQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];

  const assignMutation = useMutation({
    mutationFn: (v: { channel: string; flowId: string }) => api.post('/bot-flows/assignments', v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flow-assignments'] });
      toast.success('Flow assigned');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not assign flow'),
  });
  const unassignMutation = useMutation({
    mutationFn: (channel: string) => api.delete(`/bot-flows/assignments/${channel}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flow-assignments'] });
      toast.success('Flow unassigned');
    },
  });

  if (channelsQuery.isLoading) return <Skeleton className="h-40 rounded-xl" />;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Live on each channel</CardTitle>
        <CardDescription>Pick which flow runs automatically on each connected WhatsApp number / Instagram handle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Connect WhatsApp or Instagram in Settings → Channels first.</p>
        ) : (
          channels.map((c) => {
            const current = assignments.find((a) => a.channel === c.channel);
            return (
              <div key={c.channel} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  {c.channel === 'WHATSAPP' ? <MessageCircle className="size-4 text-emerald-600" /> : <Instagram className="size-4 text-pink-600" />}
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.channel === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'}</p>
                    <p className="text-xs text-muted-foreground">{c.displayName ?? (c.status === 'CONNECTED' ? 'Connected' : 'Not connected')}</p>
                  </div>
                </div>
                {c.status !== 'CONNECTED' ? (
                  <Badge variant="muted">Not connected</Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select
                      value={current?.flowId ?? '__none'}
                      onValueChange={(v) => {
                        if (v === '__none') {
                          if (current) unassignMutation.mutate(c.channel);
                          return;
                        }
                        assignMutation.mutate({ channel: c.channel, flowId: v });
                      }}
                    >
                      <SelectTrigger className="w-56"><SelectValue placeholder="No flow assigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">No flow assigned</SelectItem>
                        {flows.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function BotFlowsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [deleting, setDeleting] = useState<BotFlow | null>(null);

  const flowsQuery = useQuery({ queryKey: ['bot-flows'], queryFn: () => api.get<BotFlow[]>('/bot-flows') });
  const flows = flowsQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bot-flows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flows'] });
      toast.success('Flow deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Could not delete flow'),
  });

  return (
    <div>
      <PageHeader title="Bot Flows" description="Visual conversation flows for WhatsApp and Instagram — collect info, confirm, and hand off cleanly.">
        <Button onClick={() => setNewOpen(true)}>
          <Plus /> New flow
        </Button>
      </PageHeader>

      <AssignmentsCard />

      {flowsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : flows.length === 0 ? (
        <EmptyState
          icon={<Workflow />}
          title="No flows yet"
          description="Create a flow, then assign it to a connected WhatsApp number or Instagram handle."
          action={<Button onClick={() => setNewOpen(true)}><Plus /> New flow</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((f) => (
            <Card key={f.id} className="cursor-pointer transition-shadow hover:shadow-pop" onClick={() => navigate(`/bot-flows/${f.id}`)}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{f.name}</CardTitle>
                  <Badge variant={f.isActive ? 'success' : 'muted'}>{f.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                <CardDescription>{f._count?.steps ?? 0} steps · {f._count?.assignments ?? 0} channel{(f._count?.assignments ?? 0) === 1 ? '' : 's'}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn('text-muted-foreground hover:text-destructive')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(f);
                  }}
                  aria-label="Delete flow"
                >
                  <Trash2 />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewFlowDialog open={newOpen} onOpenChange={setNewOpen} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this flow?"
        description={`"${deleting?.name}" and all its steps will be permanently removed. Any channel it's assigned to will stop running it.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
