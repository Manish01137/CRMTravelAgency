import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ArrowLeft, HelpCircle, ListChecks, MessageSquareText, Plus, Settings2, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BotFlowConfirmOption, BotFlowDetail, BotFlowLeadField, BotFlowStep, BotFlowStepType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const LEAD_FIELD_LABELS: Record<BotFlowLeadField, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  destination: 'Destination',
  travelDate: 'Travel date',
  travelerCount: 'Traveler count',
  notes: 'Notes',
};
const LEAD_FIELDS = Object.keys(LEAD_FIELD_LABELS) as BotFlowLeadField[];

const STEP_STYLES: Record<BotFlowStepType, { icon: typeof MessageSquareText; label: string; accent: string; bg: string }> = {
  COLLECT: { icon: MessageSquareText, label: 'Collect', accent: 'border-sky-400', bg: 'bg-sky-50' },
  CONFIRM: { icon: HelpCircle, label: 'Confirm', accent: 'border-amber-400', bg: 'bg-amber-50' },
  CLOSING: { icon: ListChecks, label: 'Closing', accent: 'border-emerald-400', bg: 'bg-emerald-50' },
};

/** Custom node — a labeled card matching the step's type, with connection handles. */
function StepNode({ data, selected }: NodeProps<{ step: BotFlowStep }>) {
  const { step } = data;
  const style = STEP_STYLES[step.type];
  const Icon = style.icon;
  return (
    <div
      className={cn(
        'w-56 rounded-xl border-2 bg-white p-3 shadow-card transition-shadow',
        style.accent,
        selected && 'ring-2 ring-primary ring-offset-2',
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-white !bg-slate-400" />
      <div className={cn('mb-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', style.bg)}>
        <Icon className="size-3" /> {style.label}
      </div>
      <p className="line-clamp-3 text-sm font-medium text-foreground">{step.question || <span className="italic text-muted-foreground">No text yet</span>}</p>
      {step.type === 'COLLECT' && step.leadField && (
        <p className="mt-1 text-[11px] text-muted-foreground">→ Lead.{LEAD_FIELD_LABELS[step.leadField]}</p>
      )}
      {step.type === 'CONFIRM' && step.options && (
        <p className="mt-1 text-[11px] text-muted-foreground">{step.options.length} options</p>
      )}
      {step.type !== 'CLOSING' && <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-white !bg-slate-400" />}
    </div>
  );
}

const nodeTypes = { step: StepNode };

/** Side panel for editing one step's content. */
function StepEditor({
  step,
  allSteps,
  open,
  onOpenChange,
  onSave,
  onDelete,
  saving,
}: {
  step: BotFlowStep | null;
  allSteps: BotFlowStep[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: Partial<BotFlowStep>) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [question, setQuestion] = useState('');
  const [leadField, setLeadField] = useState<BotFlowLeadField | ''>('');
  const [options, setOptions] = useState<BotFlowConfirmOption[]>([]);
  const [nextStepId, setNextStepId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!step) return;
    setQuestion(step.question ?? '');
    setLeadField(step.leadField ?? '');
    setOptions(step.options ?? [{ label: 'Yes', nextStepId: null }, { label: 'No', nextStepId: null }]);
    setNextStepId(step.nextStepId);
  }, [step]);

  if (!step) return null;
  const style = STEP_STYLES[step.type];
  const otherSteps = allSteps.filter((s) => s.id !== step.id);

  const handleSave = () => {
    if (step.type === 'CONFIRM') {
      onSave({ question, options });
    } else {
      onSave({ question, leadField: leadField || undefined, nextStepId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <style.icon className="size-4" /> {style.label} step
          </DialogTitle>
          <DialogDescription>
            {step.type === 'COLLECT' && "Ask a question and write the traveller's answer into a Lead field."}
            {step.type === 'CONFIRM' && 'Ask a yes/no or multiple-choice question and branch based on the answer.'}
            {step.type === 'CLOSING' && 'End the flow with a final message.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          <Field label={step.type === 'CLOSING' ? 'Closing message' : 'Question'} htmlFor="stepQuestion" required>
            <Textarea id="stepQuestion" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What's your destination?" />
          </Field>

          {step.type === 'COLLECT' && (
            <>
              <Field label="Write the answer into" htmlFor="stepLeadField" required>
                <Select value={leadField} onValueChange={(v) => setLeadField(v as BotFlowLeadField)}>
                  <SelectTrigger id="stepLeadField"><SelectValue placeholder="Choose a Lead field" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>{LEAD_FIELD_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Then go to" htmlFor="stepNext" hint="Or drag a connection on the canvas instead.">
                <Select value={nextStepId ?? '__end'} onValueChange={(v) => setNextStepId(v === '__end' ? null : v)}>
                  <SelectTrigger id="stepNext"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__end">End flow here</SelectItem>
                    {otherSteps.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.question || `${s.type} step`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {step.type === 'CONFIRM' && (
            <Field label="Options" htmlFor="stepOptions" hint="Each option branches to a different step.">
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2">
                    <Input
                      value={opt.label}
                      onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, label: e.target.value } : o)))}
                      placeholder="Yes"
                      className="flex-1"
                    />
                    <Select
                      value={opt.nextStepId ?? '__end'}
                      onValueChange={(v) => setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, nextStepId: v === '__end' ? null : v } : o)))}
                    >
                      <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__end">End flow</SelectItem>
                        {otherSteps.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.question || `${s.type} step`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {options.length > 2 && (
                      <Button variant="ghost" size="icon-sm" onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove option">
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                {options.length < 10 && (
                  <Button variant="outline" size="sm" onClick={() => setOptions((prev) => [...prev, { label: '', nextStepId: null }])}>
                    <Plus className="size-3.5" /> Add option
                  </Button>
                )}
              </div>
            </Field>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="size-4" /> Delete step
          </Button>
          <Button onClick={handleSave} disabled={saving || !question.trim()}>
            {saving && <Spinner className="size-4" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this step?"
        description="Any step pointing to it will need to be reconnected."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDelete();
        }}
      />
    </Dialog>
  );
}

/** Flow-level settings: name, fallback message, needs-review keywords, active. */
function FlowSettingsDialog({ flow, open, onOpenChange }: { flow: BotFlowDetail; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(flow.name);
  const [fallbackMessage, setFallbackMessage] = useState(flow.fallbackMessage);
  const [keywordsText, setKeywordsText] = useState(flow.needsReviewKeywords.join(', '));
  const [isActive, setIsActive] = useState(flow.isActive);

  useEffect(() => {
    setName(flow.name);
    setFallbackMessage(flow.fallbackMessage);
    setKeywordsText(flow.needsReviewKeywords.join(', '));
    setIsActive(flow.isActive);
  }, [flow]);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/bot-flows/${flow.id}`, {
        name: name.trim(),
        fallbackMessage: fallbackMessage.trim(),
        needsReviewKeywords: keywordsText.split(',').map((k) => k.trim()).filter(Boolean),
        isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flow', flow.id] });
      queryClient.invalidateQueries({ queryKey: ['bot-flows'] });
      toast.success('Flow settings saved');
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Flow settings</DialogTitle>
          <DialogDescription>Fallback message and the keywords that hand a conversation off to a human.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Flow name" htmlFor="fsName" required>
            <Input id="fsName" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Fallback message" htmlFor="fsFallback" hint="Shown when the bot doesn't understand a reply.">
            <Textarea id="fsFallback" rows={2} value={fallbackMessage} onChange={(e) => setFallbackMessage(e.target.value)} />
          </Field>
          <Field label="Needs Review keywords" htmlFor="fsKeywords" hint="Comma-separated. A match stops the bot and flags the lead for a human.">
            <Textarea id="fsKeywords" rows={2} value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder="refund, complaint, urgent, legal" />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">Inactive flows can't be assigned to a channel.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending && <Spinner className="size-4" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const GRID_X = 320;
const GRID_Y = 160;

export function BotFlowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const positionSaveTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flowQuery = useQuery({
    queryKey: ['bot-flow', id],
    queryFn: () => api.get<BotFlowDetail>(`/bot-flows/${id}`),
    enabled: !!id,
  });

  const steps = useMemo(() => flowQuery.data?.steps ?? [], [flowQuery.data]);

  // Rebuild nodes/edges whenever the server data changes (fresh load, or after a save).
  useEffect(() => {
    if (!flowQuery.data) return;
    setNodes(
      steps.map((s, i) => ({
        id: s.id,
        type: 'step',
        position: { x: s.canvasX ?? (i % 3) * GRID_X, y: s.canvasY ?? Math.floor(i / 3) * GRID_Y },
        data: { step: s },
      })),
    );
    const newEdges: Edge[] = [];
    for (const s of steps) {
      if (s.type === 'CONFIRM' && s.options) {
        s.options.forEach((opt, i) => {
          if (opt.nextStepId) newEdges.push({ id: `${s.id}-opt${i}`, source: s.id, target: opt.nextStepId, label: opt.label, animated: false });
        });
      } else if (s.nextStepId) {
        newEdges.push({ id: `${s.id}-next`, source: s.id, target: s.nextStepId });
      }
    }
    setEdges(newEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowQuery.data]);

  const updateStepMutation = useMutation({
    mutationFn: ({ stepId, patch }: { stepId: string; patch: Partial<BotFlowStep> }) => {
      const existing = steps.find((s) => s.id === stepId)!;
      return api.patch(`/bot-flows/${id}/steps/${stepId}`, { ...existing, ...patch });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flow', id] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save step'),
  });

  const createStepMutation = useMutation({
    mutationFn: (type: BotFlowStepType) =>
      api.post<BotFlowStep>(`/bot-flows/${id}/steps`, {
        type,
        order: steps.length,
        question: type === 'CLOSING' ? "Thank you! Our team will reach out shortly." : 'New question',
        ...(type === 'COLLECT' && { leadField: 'notes' }),
        ...(type === 'CONFIRM' && { options: [{ label: 'Yes', nextStepId: null }, { label: 'No', nextStepId: null }] }),
        canvasX: 40 + (steps.length % 3) * GRID_X,
        canvasY: 40 + Math.floor(steps.length / 3) * GRID_Y,
      }),
    onSuccess: (step) => {
      queryClient.invalidateQueries({ queryKey: ['bot-flow', id] });
      setSelectedStepId(step.id);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not add step'),
  });

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => api.delete(`/bot-flows/${id}/steps/${stepId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flow', id] });
      setSelectedStepId(null);
      toast.success('Step deleted');
    },
  });

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        // debounce per-node position saves while dragging
        clearTimeout(positionSaveTimer.current[change.id]);
        positionSaveTimer.current[change.id] = setTimeout(() => {
          updateStepMutation.mutate({ stepId: change.id, patch: { canvasX: Math.round(change.position!.x), canvasY: Math.round(change.position!.y) } });
        }, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const sourceStep = steps.find((s) => s.id === connection.source);
      if (!sourceStep || sourceStep.type === 'CLOSING') return; // closing steps have no outgoing connection
      setEdges((eds) => addEdge(connection, eds));
      if (sourceStep.type === 'CONFIRM') {
        // Connect the first not-yet-wired option; if all are wired, update the first.
        const options = sourceStep.options ?? [];
        const idx = options.findIndex((o) => !o.nextStepId);
        const targetIdx = idx === -1 ? 0 : idx;
        const nextOptions = options.map((o, i) => (i === targetIdx ? { ...o, nextStepId: connection.target! } : o));
        updateStepMutation.mutate({ stepId: sourceStep.id, patch: { options: nextOptions } });
      } else {
        updateStepMutation.mutate({ stepId: sourceStep.id, patch: { nextStepId: connection.target } });
      }
    },
    [steps, updateStepMutation],
  );

  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null;

  if (flowQuery.isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-4 h-[70vh] w-full rounded-xl" />
      </div>
    );
  }
  if (!flowQuery.data) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Flow not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/bot-flows')}><ArrowLeft /> Back</Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate('/bot-flows')} aria-label="Back to flows">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="font-display text-lg font-bold text-foreground">{flowQuery.data.name}</h1>
            <p className="text-xs text-muted-foreground">{steps.length} step{steps.length === 1 ? '' : 's'} · drag a connection to link steps in sequence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" /> Flow settings
          </Button>
          <Button size="sm" onClick={() => createStepMutation.mutate('COLLECT')} disabled={createStepMutation.isPending}>
            <Plus className="size-4" /> Collect
          </Button>
          <Button size="sm" variant="secondary" onClick={() => createStepMutation.mutate('CONFIRM')} disabled={createStepMutation.isPending}>
            <Plus className="size-4" /> Confirm
          </Button>
          <Button size="sm" variant="secondary" onClick={() => createStepMutation.mutate('CLOSING')} disabled={createStepMutation.isPending}>
            <Plus className="size-4" /> Closing
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
        {steps.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Start with a Collect step to ask your first question.</p>
            <Button onClick={() => createStepMutation.mutate('COLLECT')}><Plus className="size-4" /> Add first step</Button>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_e, node) => setSelectedStepId(node.id)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} />
            <Controls />
            <MiniMap pannable zoomable className="!bottom-4 !right-4" />
          </ReactFlow>
        )}
      </div>

      <StepEditor
        step={selectedStep}
        allSteps={steps}
        open={!!selectedStep}
        onOpenChange={(v) => !v && setSelectedStepId(null)}
        saving={updateStepMutation.isPending}
        onSave={(patch) => {
          if (!selectedStep) return;
          updateStepMutation.mutate({ stepId: selectedStep.id, patch });
          setSelectedStepId(null);
        }}
        onDelete={() => selectedStep && deleteStepMutation.mutate(selectedStep.id)}
      />
      <FlowSettingsDialog flow={flowQuery.data} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
