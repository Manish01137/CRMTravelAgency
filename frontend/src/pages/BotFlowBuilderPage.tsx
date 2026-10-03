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
import {
  ArrowLeft,
  ChevronDown,
  HelpCircle,
  Headset,
  ImagePlus,
  LayoutList,
  ListChecks,
  Megaphone,
  MessageSquareText,
  Package as PackageIcon,
  Plus,
  Flag,
  PenLine,
  Settings2,
  Sparkles,
  Tag,
  Trash2,
  Zap,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  BotFlowAnswerType,
  BotFlowConfirmOption,
  BotFlowDetail,
  BotFlowLeadField,
  BotFlowSettableField,
  BotFlowStep,
  BotFlowStepMedia,
  BotFlowStepType,
  CustomerType,
  LeadStatus,
  TravelPackage,
  User,
} from '@/types';
import { TagInput } from '@/components/ui/tag-input';
import { WhatsAppPreview } from '@/components/bot-flow/WhatsAppPreview';
import { StepMediaPicker } from '@/components/bot-flow/StepMediaPicker';
import { LEAD_STATUSES, LEAD_STATUS_STYLES } from '@/lib/leadMeta';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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

const ANSWER_TYPE_LABELS: Record<BotFlowAnswerType, string> = {
  text: 'Any text',
  email: 'Email address',
  phone: 'Phone number',
  number: 'Number',
  date: 'Date',
};

// Mirrors backend/src/lib/answerValidation.ts.
function defaultAnswerType(leadField: BotFlowLeadField | ''): BotFlowAnswerType {
  if (leadField === 'email') return 'email';
  if (leadField === 'phone') return 'phone';
  if (leadField === 'travelerCount') return 'number';
  if (leadField === 'travelDate') return 'date';
  return 'text';
}

const DEFAULT_ERROR_MESSAGES: Record<BotFlowAnswerType, string> = {
  text: 'Sorry, I didn’t get that — could you type your answer?',
  email: 'That doesn’t look like a valid email address. Please send it again (e.g. name@example.com).',
  phone: 'That doesn’t look like a valid phone number. Please send it again with the country code (e.g. +91 98765 43210).',
  number: 'Please reply with a number (e.g. 4).',
  date: 'Please send the date like 25/12/2026 or 25 Dec.',
};

const STEP_STYLES: Record<BotFlowStepType, { icon: typeof MessageSquareText; label: string; accent: string; bg: string }> = {
  COLLECT: { icon: MessageSquareText, label: 'Collect', accent: 'border-sky-400', bg: 'bg-sky-50' },
  CONFIRM: { icon: HelpCircle, label: 'Confirm', accent: 'border-amber-400', bg: 'bg-amber-50' },
  CLOSING: { icon: ListChecks, label: 'Closing', accent: 'border-emerald-400', bg: 'bg-emerald-50' },
  MESSAGE: { icon: Megaphone, label: 'Message', accent: 'border-violet-400', bg: 'bg-violet-50' },
  HANDOFF: { icon: Headset, label: 'Handoff', accent: 'border-rose-400', bg: 'bg-rose-50' },
  SEND_PACKAGE: { icon: PackageIcon, label: 'Send package', accent: 'border-teal-400', bg: 'bg-teal-50' },
  AI_OPEN: { icon: Sparkles, label: 'AI conversation', accent: 'border-fuchsia-400', bg: 'bg-fuchsia-50' },
  CAROUSEL: { icon: LayoutList, label: 'Carousel', accent: 'border-cyan-400', bg: 'bg-cyan-50' },
  SET_ATTRIBUTE: { icon: PenLine, label: 'Set attribute', accent: 'border-indigo-400', bg: 'bg-indigo-50' },
  ADD_TAG: { icon: Tag, label: 'Add tag', accent: 'border-lime-500', bg: 'bg-lime-50' },
  UPDATE_STAGE: { icon: Flag, label: 'Update stage', accent: 'border-orange-400', bg: 'bg-orange-50' },
};

const SETTABLE_FIELD_LABELS: Record<BotFlowSettableField, string> = {
  destination: 'Destination',
  travelerCount: 'Traveller count',
  budgetAmount: 'Budget',
  customerType: 'Customer type',
  assignedToId: 'Assigned agent',
  notes: 'Notes (adds a line)',
};

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = { B2C: 'B2C', B2B: 'B2B', CORPORATE: 'Corporate', VIP: 'VIP' };

/** Steps that change the lead and continue — nothing is sent to the traveller. */
const LEAD_UPDATE_TYPES: BotFlowStepType[] = ['SET_ATTRIBUTE', 'ADD_TAG', 'UPDATE_STAGE'];

/** Step types that auto-chain to the next step without waiting for a reply — shown as a hint on the node. */
const NON_INTERACTIVE_TYPES: BotFlowStepType[] = ['MESSAGE', 'SEND_PACKAGE', ...LEAD_UPDATE_TYPES];
/** Step types with no outgoing connection at all. */
const TERMINAL_TYPES: BotFlowStepType[] = ['CLOSING', 'HANDOFF'];

/** "Add step" menu order + one-line descriptions — the whole roster, in the order they're most likely to be reached for. */
type AddStepKind = BotFlowStepType | 'MEDIA_BUTTONS';

const ADD_STEP_MENU: { type: AddStepKind; blurb: string }[] = [
  { type: 'COLLECT', blurb: 'Ask a question, save the answer to a Lead field' },
  { type: 'CONFIRM', blurb: 'Tappable buttons or a list menu, branches by answer' },
  { type: 'MEDIA_BUTTONS', blurb: 'A photo, video or PDF with up to 3 buttons under it' },
  { type: 'MESSAGE', blurb: 'Send text or a photo / video / PDF — continues right away' },
  { type: 'SEND_PACKAGE', blurb: 'Share a package, then continue right away' },
  { type: 'CAROUSEL', blurb: 'Show up to 10 packages as swipeable cards with a View package button' },
  { type: 'AI_OPEN', blurb: 'Let the AI Agent converse freely until it moves on' },
  { type: 'SET_ATTRIBUTE', blurb: 'Fill in a lead field — destination, budget, agent…' },
  { type: 'ADD_TAG', blurb: 'Label the lead (e.g. honeymoon, hot lead)' },
  { type: 'UPDATE_STAGE', blurb: 'Move the lead to a pipeline stage' },
  { type: 'HANDOFF', blurb: 'End the bot\'s turn, flag the lead for your team' },
  { type: 'CLOSING', blurb: 'Final message — ends the flow' },
];

function leadUpdateSummary(step: BotFlowStep): string | null {
  const c = step.config;
  if (step.type === 'ADD_TAG') return c.tags?.length ? `Tag: ${c.tags.join(', ')}` : null;
  if (step.type === 'UPDATE_STAGE') return c.status ? `Stage → ${LEAD_STATUS_STYLES[c.status].label}` : null;
  if (!c.field || !c.value) return null;
  if (c.field === 'assignedToId') return 'Assign to an agent';
  const value = c.field === 'customerType' ? CUSTOMER_TYPE_LABELS[c.value as CustomerType] ?? c.value : c.value;
  return `${SETTABLE_FIELD_LABELS[c.field].replace(' (adds a line)', '')} → ${value}`;
}

/** How a step is named in "go to" pickers. */
function stepLabel(step: BotFlowStep): string {
  return step.question || leadUpdateSummary(step) || `${STEP_STYLES[step.type].label} step`;
}

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
      {step.type === 'SEND_PACKAGE' ? (
        <p className="text-sm font-medium text-foreground">
          {step.config.packageId ? 'Sends the selected package' : <span className="italic text-muted-foreground">No package chosen yet</span>}
        </p>
      ) : step.type === 'CAROUSEL' ? (
        <p className="text-sm font-medium text-foreground">
          {step.config.packageIds?.length
            ? `Sends a list of ${step.config.packageIds.length} package${step.config.packageIds.length === 1 ? '' : 's'}`
            : <span className="italic text-muted-foreground">No packages chosen yet</span>}
        </p>
      ) : LEAD_UPDATE_TYPES.includes(step.type) ? (
        <p className="line-clamp-3 text-sm font-medium text-foreground">{leadUpdateSummary(step) ?? <span className="italic text-muted-foreground">Not set up yet</span>}</p>
      ) : (
        <p className="line-clamp-3 text-sm font-medium text-foreground">{step.question || <span className="italic text-muted-foreground">No text yet</span>}</p>
      )}
      {step.type === 'COLLECT' && step.leadField && (
        <p className="mt-1 text-[11px] text-muted-foreground">→ Lead.{LEAD_FIELD_LABELS[step.leadField]}</p>
      )}
      {step.type === 'CONFIRM' && step.options && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {step.options.map((o, i) => (
            <span key={i} className="max-w-full truncate rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] text-amber-800">
              {o.label}
            </span>
          ))}
        </div>
      )}
      {step.config.media && (
        <p className="mt-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {step.config.media.type === 'image' ? '📷 Photo' : step.config.media.type === 'video' ? '🎬 Video' : '📄 PDF'} attached
        </p>
      )}
      {step.type === 'AI_OPEN' && step.config.instructions && (
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">AI: {step.config.instructions}</p>
      )}
      {NON_INTERACTIVE_TYPES.includes(step.type) && <p className="mt-1 text-[11px] text-muted-foreground">Auto-continues, no reply needed</p>}
      {!TERMINAL_TYPES.includes(step.type) && <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-white !bg-slate-400" />}
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
  const [packageIds, setPackageIds] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [validation, setValidation] = useState<BotFlowAnswerType | ''>('');
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [errorMessage, setErrorMessage] = useState('');
  const [buttonLabel, setButtonLabel] = useState('');
  const [attrField, setAttrField] = useState<BotFlowSettableField>('destination');
  const [attrValue, setAttrValue] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [stageStatus, setStageStatus] = useState<LeadStatus | ''>('');
  const [media, setMedia] = useState<BotFlowStepMedia | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const packagesQuery = useQuery({
    queryKey: ['packages'],
    queryFn: () => api.get<TravelPackage[]>('/packages'),
    enabled: step?.type === 'SEND_PACKAGE' || step?.type === 'CAROUSEL',
  });
  const packages = (packagesQuery.data ?? []).filter((p) => p.isActive);

  useEffect(() => {
    if (!step) return;
    setQuestion(step.question ?? '');
    setLeadField(step.leadField ?? '');
    setOptions(step.options ?? [{ label: 'Yes', nextStepId: null }, { label: 'No', nextStepId: null }]);
    setNextStepId(step.nextStepId);
    // packageIds is the source of truth going forward; an older step saved
    // with only the single packageId still hydrates correctly here.
    setPackageIds(step.config.packageIds ?? (step.config.packageId ? [step.config.packageId] : []));
    setInstructions(step.config.instructions ?? '');
    setValidation(step.config.validation ?? '');
    setMaxAttempts(step.config.maxAttempts ?? 3);
    setErrorMessage(step.config.errorMessage ?? '');
    setButtonLabel(step.config.buttonLabel ?? '');
    setAttrField(step.config.field ?? 'destination');
    setAttrValue(step.config.value ?? '');
    setTags(step.config.tags ?? []);
    setStageStatus(step.config.status ?? '');
    setMedia(step.config.media ?? null);
  }, [step]);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
    enabled: step?.type === 'SET_ATTRIBUTE',
  });

  if (!step) return null;
  const style = STEP_STYLES[step.type];
  const otherSteps = allSteps.filter((s) => s.id !== step.id);

  const handleSave = () => {
    if (step.type === 'CONFIRM') {
      onSave({
        question,
        options: options.map((o) => ({ ...o, label: o.label.trim(), description: o.description?.trim() || undefined })),
        config: { buttonLabel: buttonLabel.trim() || undefined, media },
      });
    } else if (step.type === 'SEND_PACKAGE' || step.type === 'CAROUSEL') {
      onSave({ question: question || undefined, nextStepId, config: { packageIds } });
    } else if (step.type === 'AI_OPEN') {
      onSave({ question, nextStepId, config: { instructions } });
    } else if (step.type === 'HANDOFF') {
      onSave({ question: question || undefined });
    } else if (step.type === 'SET_ATTRIBUTE') {
      onSave({ nextStepId, config: { field: attrField, value: attrValue.trim() } });
    } else if (step.type === 'ADD_TAG') {
      onSave({ nextStepId, config: { tags } });
    } else if (step.type === 'UPDATE_STAGE') {
      onSave({ nextStepId, config: { status: stageStatus || undefined } });
    } else if (step.type === 'COLLECT') {
      onSave({
        question,
        leadField: leadField || undefined,
        nextStepId,
        config: { validation: validation || undefined, maxAttempts, errorMessage: errorMessage.trim() || undefined },
      });
    } else {
      // MESSAGE, CLOSING
      onSave({ question, leadField: leadField || undefined, nextStepId, ...(step.type === 'MESSAGE' && { config: { media } }) });
    }
  };

  const attrValueValid =
    attrField === 'travelerCount' ? /^[1-9]\d{0,5}$/.test(attrValue.trim())
      : attrField === 'budgetAmount' ? /^\d{1,10}$/.test(attrValue.trim())
      : !!attrValue.trim();
  const canSave =
    step.type === 'HANDOFF' // the only type with no required text
      ? true
      : step.type === 'SET_ATTRIBUTE'
        ? attrValueValid
      : step.type === 'ADD_TAG'
        ? tags.length > 0
      : step.type === 'UPDATE_STAGE'
        ? !!stageStatus
      : step.type === 'SEND_PACKAGE' || step.type === 'CAROUSEL'
        ? packageIds.length > 0
        : step.type === 'AI_OPEN'
          ? !!question.trim() && !!instructions.trim()
          : step.type === 'CONFIRM'
            ? !!question.trim() && options.every((o) => o.label.trim())
            : step.type === 'MESSAGE'
              ? !!question.trim() || !!media
              : !!question.trim();
  const effectiveAnswerType = validation || defaultAnswerType(leadField);
  // WhatsApp's own limits decide how the options are shown.
  const asButtons = options.length <= 3 && options.every((o) => o.label.trim().length <= 20);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <style.icon className="size-4" /> {style.label} step
          </DialogTitle>
          <DialogDescription>
            {step.type === 'COLLECT' && "Ask a question and write the traveller's answer into a Lead field."}
            {step.type === 'CONFIRM' &&
              'Ask a question with tappable options — each one leads to its own branch. Up to 3 short options show as WhatsApp buttons; more become a list menu.'}
            {step.type === 'CLOSING' && 'End the flow with a final message.'}
            {step.type === 'MESSAGE' && 'Send a message with no reply needed — the flow continues on to the next step right away.'}
            {step.type === 'HANDOFF' && 'End the bot\'s turn and flag this lead for a human — same as a "Needs Review" keyword match.'}
            {step.type === 'SEND_PACKAGE' &&
              "Select every package that could apply — the bot sends whichever one matches the traveller's destination, then continues on to the next step right away."}
            {step.type === 'CAROUSEL' && 'Send up to 10 packages as swipeable WhatsApp cards — each with its photo and a View package button. If they reply with a package name, that package is sent with its details; any other reply moves the flow on.'}
            {step.type === 'AI_OPEN' && "Let the AI Agent converse freely here, guided by your instructions, until it decides to move the flow on."}
            {step.type === 'SET_ATTRIBUTE' && 'Fill in a field on the lead, then continue right away. Nothing is sent to the traveller.'}
            {step.type === 'ADD_TAG' && 'Label the lead so you can filter and follow up later, then continue right away.'}
            {step.type === 'UPDATE_STAGE' && 'Move the lead along your pipeline (logged on its timeline), then continue right away. Moving to Won creates the booking, same as doing it by hand.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="max-h-[62vh] min-w-0 space-y-4 overflow-y-auto py-2 pr-1">
          {step.type === 'SET_ATTRIBUTE' ? (
            <>
              <Field label="Field" htmlFor="attrField" required>
                <Select
                  value={attrField}
                  onValueChange={(v) => {
                    setAttrField(v as BotFlowSettableField);
                    setAttrValue('');
                  }}
                >
                  <SelectTrigger id="attrField"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SETTABLE_FIELD_LABELS) as BotFlowSettableField[]).map((f) => (
                      <SelectItem key={f} value={f}>{SETTABLE_FIELD_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Value"
                htmlFor="attrValue"
                required
                error={attrValue.trim() && !attrValueValid ? 'Enter a whole number.' : undefined}
              >
                {attrField === 'customerType' ? (
                  <Select value={attrValue} onValueChange={setAttrValue}>
                    <SelectTrigger id="attrValue"><SelectValue placeholder="Choose a type" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CUSTOMER_TYPE_LABELS) as CustomerType[]).map((t) => (
                        <SelectItem key={t} value={t}>{CUSTOMER_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : attrField === 'assignedToId' ? (
                  <Select value={attrValue} onValueChange={setAttrValue}>
                    <SelectTrigger id="attrValue"><SelectValue placeholder={usersQuery.isLoading ? 'Loading team…' : 'Choose an agent'} /></SelectTrigger>
                    <SelectContent>
                      {(usersQuery.data ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : attrField === 'notes' ? (
                  <Textarea id="attrValue" rows={2} maxLength={1000} value={attrValue} onChange={(e) => setAttrValue(e.target.value)} placeholder="e.g. Came from the Manali flow" />
                ) : (
                  <Input
                    id="attrValue"
                    value={attrValue}
                    inputMode={attrField === 'destination' ? undefined : 'numeric'}
                    maxLength={attrField === 'destination' ? 120 : 10}
                    onChange={(e) => setAttrValue(e.target.value)}
                    placeholder={attrField === 'destination' ? 'e.g. Manali' : attrField === 'budgetAmount' ? 'e.g. 50000' : 'e.g. 2'}
                  />
                )}
              </Field>
            </>
          ) : step.type === 'ADD_TAG' ? (
            <Field label="Tags" htmlFor="stepTags" required hint="Press Enter after each. Leads can be filtered by tag on the Leads page.">
              <TagInput id="stepTags" value={tags} onChange={setTags} max={10} maxLength={40} placeholder="e.g. honeymoon" />
            </Field>
          ) : step.type === 'UPDATE_STAGE' ? (
            <Field label="Move the lead to" htmlFor="stepStage" required>
              <Select value={stageStatus} onValueChange={(v) => setStageStatus(v as LeadStatus)}>
                <SelectTrigger id="stepStage"><SelectValue placeholder="Choose a stage" /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map(({ value }) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <span className={cn('size-2 rounded-full', LEAD_STATUS_STYLES[value].dot)} />
                        {LEAD_STATUS_STYLES[value].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : step.type === 'SEND_PACKAGE' || step.type === 'CAROUSEL' ? (
            <Field
              label={step.type === 'SEND_PACKAGE' ? 'Packages to choose from' : 'Packages to show'}
              htmlFor="stepPackages"
              required
              hint={
                step.type === 'SEND_PACKAGE'
                  ? `The bot auto-picks whichever matches the traveller's destination, or the first one if none match. ${packageIds.length}/10 selected.`
                  : `Up to 10, shown in this order. Each card uses the package's banner photo (or your logo). ${packageIds.length}/10 selected.`
              }
            >
              <div id="stepPackages" className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
                {packagesQuery.isLoading ? (
                  <p className="p-2 text-sm text-muted-foreground">Loading packages…</p>
                ) : packages.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">No active packages yet.</p>
                ) : (
                  packages.map((p) => {
                    const checked = packageIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                          !checked && packageIds.length >= 10 ? 'opacity-50' : 'cursor-pointer hover:bg-muted/60',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && packageIds.length >= 10}
                          onChange={(e) =>
                            setPackageIds((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{p.name} — {p.destination}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </Field>
          ) : (
            <Field
              label={
                step.type === 'CLOSING' ? 'Closing message'
                  : step.type === 'MESSAGE' ? 'Message'
                  : step.type === 'HANDOFF' ? 'Message before handoff'
                  : step.type === 'AI_OPEN' ? 'Opening message'
                  : 'Question'
              }
              htmlFor="stepQuestion"
              required={step.type !== 'HANDOFF'}
              hint={step.type === 'HANDOFF' ? 'Optional — shown to the traveller before your team takes over.' : undefined}
            >
              <Textarea id="stepQuestion" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What's your destination?" />
            </Field>
          )}

          {step.type === 'AI_OPEN' && (
            <Field
              label="Instructions for the AI"
              htmlFor="stepInstructions"
              required
              hint="Plain language — e.g. 'Answer questions about our Bali packages; once they mention a budget, wrap up.'"
            >
              <Textarea id="stepInstructions" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What should the AI do here, and when should it move on?" />
            </Field>
          )}

          {step.type === 'COLLECT' && (
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
          )}

          {step.type === 'COLLECT' && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Answer check</p>
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <Field label="Accept" htmlFor="stepValidation">
                  <Select value={validation || '__auto'} onValueChange={(v) => setValidation(v === '__auto' ? '' : (v as BotFlowAnswerType))}>
                    <SelectTrigger id="stepValidation"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__auto">Auto ({ANSWER_TYPE_LABELS[defaultAnswerType(leadField)]})</SelectItem>
                      {(Object.keys(ANSWER_TYPE_LABELS) as BotFlowAnswerType[]).map((t) => (
                        <SelectItem key={t} value={t}>{ANSWER_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Attempts" htmlFor="stepAttempts">
                  <Select value={String(maxAttempts)} onValueChange={(v) => setMaxAttempts(Number(v))}>
                    <SelectTrigger id="stepAttempts"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {effectiveAnswerType !== 'text' && (
                <Field
                  label="Reply to an invalid answer"
                  htmlFor="stepError"
                  hint={`After ${maxAttempts} ${maxAttempts === 1 ? 'try' : 'tries'} the flow moves on without saving the answer.`}
                >
                  <Textarea
                    id="stepError"
                    rows={2}
                    maxLength={500}
                    value={errorMessage}
                    onChange={(e) => setErrorMessage(e.target.value)}
                    placeholder={DEFAULT_ERROR_MESSAGES[effectiveAnswerType]}
                  />
                </Field>
              )}
            </div>
          )}

          {(['COLLECT', 'MESSAGE', 'SEND_PACKAGE', 'AI_OPEN', 'CAROUSEL', ...LEAD_UPDATE_TYPES] as BotFlowStepType[]).includes(step.type) && (
            <Field label="Then go to" htmlFor="stepNext" hint="Or drag a connection on the canvas instead.">
              <Select value={nextStepId ?? '__end'} onValueChange={(v) => setNextStepId(v === '__end' ? null : v)}>
                <SelectTrigger id="stepNext"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__end">End flow here</SelectItem>
                  {otherSteps.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{stepLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {step.type === 'CONFIRM' && (
            <Field
              label="Options"
              htmlFor="stepOptions"
              hint={
                asButtons
                  ? 'Shown as WhatsApp reply buttons (up to 3, max 20 characters each). Each option branches to its own step.'
                  : 'Shown as a WhatsApp list menu (up to 10 options; titles over 24 characters are shortened, with the full text underneath). Each option branches to its own step.'
              }
            >
              <div className="space-y-2">
                {options.map((opt, i) => {
                  const limit = asButtons ? 20 : 24;
                  const len = opt.label.trim().length;
                  return (
                    <div key={i} className="space-y-1.5 rounded-lg border border-border p-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Input
                            value={opt.label}
                            maxLength={80}
                            onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, label: e.target.value } : o)))}
                            placeholder={i === 0 ? 'Yes' : i === 1 ? 'No' : `Option ${i + 1}`}
                            className="pr-12"
                          />
                          <span
                            className={cn(
                              'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums',
                              len > limit ? 'text-amber-600' : 'text-muted-foreground',
                            )}
                          >
                            {len}/{limit}
                          </span>
                        </div>
                        <Select
                          value={opt.nextStepId ?? '__end'}
                          onValueChange={(v) => setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, nextStepId: v === '__end' ? null : v } : o)))}
                        >
                          <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__end">End flow</SelectItem>
                            {otherSteps.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{stepLabel(s)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {options.length > 2 && (
                          <Button variant="ghost" size="icon-sm" onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove option">
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                      {!asButtons && (
                        <Input
                          value={opt.description ?? ''}
                          maxLength={72}
                          onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, description: e.target.value } : o)))}
                          placeholder="Description under this option (optional)"
                          className="h-8 text-xs"
                        />
                      )}
                    </div>
                  );
                })}
                {options.length < 10 && (
                  <Button variant="outline" size="sm" onClick={() => setOptions((prev) => [...prev, { label: '', nextStepId: null }])}>
                    <Plus className="size-3.5" /> Add option
                  </Button>
                )}
              </div>
            </Field>
          )}

          {step.type === 'CONFIRM' && !asButtons && (
            <Field label="List button label" htmlFor="stepButtonLabel" hint="The button they tap to open the list. Max 20 characters.">
              <Input id="stepButtonLabel" maxLength={20} value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} placeholder="Choose an option" />
            </Field>
          )}

          {(step.type === 'MESSAGE' || step.type === 'CONFIRM') && (
            <Field
              label="Photo, video or PDF"
              htmlFor="stepMedia"
              hint={
                step.type === 'CONFIRM'
                  ? asButtons
                    ? 'Optional — shown above the question, in the same message as the buttons.'
                    : 'Optional — a list menu can’t carry media, so it’s sent just before the list.'
                  : 'Optional — the message text becomes its caption.'
              }
            >
              <StepMediaPicker value={media} onChange={setMedia} />
            </Field>
          )}
        </div>

        <aside className="hidden py-2 md:block" aria-label="WhatsApp preview">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Live preview</p>
          <WhatsAppPreview
            type={step.type}
            text={
              step.type === 'COLLECT' || step.type === 'CONFIRM' || step.type === 'MESSAGE' || step.type === 'CLOSING' ||
              step.type === 'HANDOFF' || step.type === 'AI_OPEN'
                ? question
                : ''
            }
            options={step.type === 'CONFIRM' ? options : undefined}
            listButtonLabel={buttonLabel}
            media={step.type === 'MESSAGE' || step.type === 'CONFIRM' ? media : null}
            packages={
              step.type === 'SEND_PACKAGE' || step.type === 'CAROUSEL'
                ? packageIds.map((pid) => packages.find((p) => p.id === pid)).filter((p): p is TravelPackage => !!p)
                : undefined
            }
            errorMessage={
              step.type === 'COLLECT' && effectiveAnswerType !== 'text' ? errorMessage.trim() || DEFAULT_ERROR_MESSAGES[effectiveAnswerType] : undefined
            }
            silentNote={
              LEAD_UPDATE_TYPES.includes(step.type)
                ? 'Nothing is sent to the traveller — this step only updates the lead, then the flow continues.'
                : step.type === 'HANDOFF' && !question.trim()
                  ? 'Nothing is sent — the chat is handed to your team.'
                  : undefined
            }
          />
          {step.type === 'SEND_PACKAGE' && packageIds.length > 1 && (
            <p className="mt-2 text-[11px] text-muted-foreground">Shows the first package — the bot sends whichever matches the traveller’s destination.</p>
          )}
        </aside>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="size-4" /> Delete step
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
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
  const [triggerKeywords, setTriggerKeywords] = useState(flow.triggerKeywords ?? []);
  const [keywordMatch, setKeywordMatch] = useState(flow.keywordMatch ?? 'contains');
  const [triggerAdIds, setTriggerAdIds] = useState(flow.triggerAdIds ?? []);

  useEffect(() => {
    setName(flow.name);
    setFallbackMessage(flow.fallbackMessage);
    setKeywordsText(flow.needsReviewKeywords.join(', '));
    setIsActive(flow.isActive);
    setTriggerKeywords(flow.triggerKeywords ?? []);
    setKeywordMatch(flow.keywordMatch ?? 'contains');
    setTriggerAdIds(flow.triggerAdIds ?? []);
  }, [flow]);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/bot-flows/${flow.id}`, {
        name: name.trim(),
        fallbackMessage: fallbackMessage.trim(),
        needsReviewKeywords: keywordsText.split(',').map((k) => k.trim()).filter(Boolean),
        isActive,
        triggerKeywords,
        keywordMatch,
        triggerAdIds,
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
          <DialogDescription>What starts this flow, what it says when it's unsure, and when it hands over to your team.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <Field label="Flow name" htmlFor="fsName" required>
            <Input id="fsName" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground"><Zap className="size-3.5 text-primary" /> Start this flow when…</p>
              <p className="text-xs text-muted-foreground">
                Works on WhatsApp and Instagram. A chat whose flow has finished starts again when it sends a keyword. Chats that match nothing go to the channel's default flow.
              </p>
            </div>
            <Field label="The message has a keyword" htmlFor="fsTriggers" hint="Press Enter after each one — e.g. manali, kashmir, honeymoon, price.">
              <TagInput id="fsTriggers" value={triggerKeywords} onChange={setTriggerKeywords} placeholder="Type a keyword and press Enter" />
            </Field>
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs" role="radiogroup" aria-label="Keyword match">
              {(
                [
                  { key: 'contains', label: 'Anywhere in the message' },
                  { key: 'exact', label: 'Whole message only' },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={keywordMatch === m.key}
                  onClick={() => setKeywordMatch(m.key)}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-medium transition-colors',
                    keywordMatch === m.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <Field label="…or the lead came from these Meta ads" htmlFor="fsAds" hint="The Ad ID from Meta Ads Manager. New leads from these ads start here first.">
              <TagInput
                id="fsAds"
                value={triggerAdIds}
                onChange={setTriggerAdIds}
                inputMode="numeric"
                placeholder="Paste an Ad ID and press Enter"
                validate={(v) => (/^\d{6,30}$/.test(v) ? null : 'Digits only — the long number from Meta Ads Manager.')}
              />
            </Field>
          </div>
          <Field label="Fallback message" htmlFor="fsFallback" hint="Shown when the bot doesn't understand a reply.">
            <Textarea id="fsFallback" rows={2} value={fallbackMessage} onChange={(e) => setFallbackMessage(e.target.value)} />
          </Field>
          <Field label="Needs Review keywords" htmlFor="fsKeywords" hint="Comma-separated. A match stops the bot and flags the lead for a human.">
            <Textarea id="fsKeywords" rows={2} value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder="refund, complaint, urgent, legal" />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">Inactive flows don't start for new chats.</p>
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
    mutationFn: (kind: AddStepKind) => {
      const type: BotFlowStepType = kind === 'MEDIA_BUTTONS' ? 'CONFIRM' : kind;
      return api.post<BotFlowStep>(`/bot-flows/${id}/steps`, {
        type,
        order: steps.length,
        question:
          kind === 'MEDIA_BUTTONS' ? 'Have a look 👇 What would you like to do next?'
            : type === 'CLOSING' ? "Thank you! Our team will reach out shortly."
            : type === 'HANDOFF' ? "Let me connect you with our team."
            : type === 'AI_OPEN' ? "Sure, happy to help — what would you like to know?"
            : type === 'SEND_PACKAGE' ? undefined // unused for this type — the package's own details are the message
            : type === 'CAROUSEL' ? undefined // unused — the list's own body text is fixed, set in bot-flow.engine.ts
            : 'New question',
        ...(type === 'COLLECT' && { leadField: 'notes' }),
        ...(type === 'CONFIRM' && {
          options:
            kind === 'MEDIA_BUTTONS'
              ? [{ label: 'Know more', nextStepId: null }, { label: 'See prices', nextStepId: null }, { label: 'Talk to an expert', nextStepId: null }]
              : [{ label: 'Yes', nextStepId: null }, { label: 'No', nextStepId: null }],
        }),
        ...(type === 'AI_OPEN' && { config: { instructions: 'Answer the traveller naturally and helpfully.' } }),
        canvasX: 40 + (steps.length % 3) * GRID_X,
        canvasY: 40 + Math.floor(steps.length / 3) * GRID_Y,
      });
    },
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={createStepMutation.isPending}>
                <Plus className="size-4" /> Add step <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {ADD_STEP_MENU.map(({ type, blurb }) => {
                const style = type === 'MEDIA_BUTTONS' ? { icon: ImagePlus, label: 'Media + buttons' } : STEP_STYLES[type];
                return (
                  <DropdownMenuItem key={type} onClick={() => createStepMutation.mutate(type)} className="items-start py-2">
                    <style.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{style.label}</p>
                      <p className="text-xs text-muted-foreground">{blurb}</p>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
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
