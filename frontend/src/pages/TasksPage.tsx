import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { format, isPast, isToday, parseISO } from 'date-fns';
import { BellRing, Check, ListChecks, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Task, TaskType, User } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
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
import { TASK_TYPES, TASK_TYPE_META, bookingRef } from '@/lib/crmMeta';
import { matchesSearch } from '@/lib/search';
import { formatSmartTime } from '@/lib/format';

const NONE = 'none';
type Filter = 'PENDING' | 'DONE' | 'ALL';

/** Everything a task can be found by: title, notes, type, lead (name + phone), booking, assignee and due date ("dec", "monday"). */
function taskSearchFields(t: Task): (string | null | undefined)[] {
  let due = '';
  try {
    due = format(parseISO(t.dueAt), 'd MMM MMMM yyyy EEEE dd/MM/yyyy');
  } catch {
    /* keep it searchable by everything else */
  }
  return [
    t.title,
    t.notes,
    TASK_TYPE_META[t.type]?.label,
    t.lead?.name,
    t.lead?.phone,
    t.booking?.customerName,
    t.booking ? bookingRef(t.booking.bookingNumber) : null,
    t.assignedTo?.name,
    due,
  ];
}

interface FormValues {
  title: string;
  type: TaskType;
  dueDate: string;
  dueTime: string;
  assignedToId: string;
  notes: string;
}

function TaskForm({ users, onDone }: { users: User[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    defaultValues: { title: '', type: 'FOLLOW_UP', dueDate: '', dueTime: '10:00', assignedToId: NONE, notes: '' },
  });

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      api.post<Task>('/tasks', {
        title: v.title.trim(),
        type: v.type,
        dueAt: new Date(`${v.dueDate}T${v.dueTime || '10:00'}`).toISOString(),
        assignedToId: v.assignedToId !== NONE ? v.assignedToId : undefined,
        notes: v.notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task scheduled');
      onDone();
    },
    onError: () => toast.error('Could not create this task'),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
      <Field label="What needs doing?" htmlFor="taskTitle" error={errors.title?.message} required>
        <Input id="taskTitle" placeholder="Call Priya about the Bali quote" {...register('title', { required: 'Title is required' })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type" htmlFor="taskType">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="taskType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label="Date" htmlFor="taskDate" error={errors.dueDate?.message} required>
          <Input id="taskDate" type="date" {...register('dueDate', { required: 'Pick a date' })} />
        </Field>
        <Field label="Time" htmlFor="taskTime">
          <Input id="taskTime" type="time" {...register('dueTime')} />
        </Field>
      </div>
      <Field label="Assign to" htmlFor="taskAssignee">
        <Controller
          control={control}
          name="assignedToId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="taskAssignee">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Notes" htmlFor="taskNotes">
        <Input id="taskNotes" placeholder="Optional context…" {...register('notes')} />
      </Field>
      <DialogFooter className="pt-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          Schedule task
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TasksPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [formOpen, setFormOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const search = searchInput.trim();

  const tasksQuery = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => api.get<Task[]>(filter === 'ALL' ? '/tasks' : `/tasks?status=${filter}`),
  });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });

  const toggleMutation = useMutation({
    mutationFn: (task: Task) =>
      api.patch<Task>(`/tasks/${task.id}`, { status: task.status === 'DONE' ? 'PENDING' : 'DONE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: () => toast.error('Could not update this task'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
    },
  });

  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const tasks = useMemo(() => (search ? allTasks.filter((t) => matchesSearch(search, taskSearchFields(t))) : allTasks), [allTasks, search]);

  // Group: Overdue / Today / Upcoming (or by state when showing done/all)
  const groups = useMemo(() => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const upcoming: Task[] = [];
    const done: Task[] = [];
    for (const t of tasks) {
      if (t.status === 'DONE') {
        done.push(t);
        continue;
      }
      const due = parseISO(t.dueAt);
      if (isToday(due)) today.push(t);
      else if (isPast(due)) overdue.push(t);
      else upcoming.push(t);
    }
    return [
      { label: 'Overdue', items: overdue, accent: 'text-destructive' },
      { label: 'Today', items: today, accent: 'text-primary' },
      { label: 'Upcoming', items: upcoming, accent: 'text-foreground' },
      { label: 'Done', items: done, accent: 'text-muted-foreground' },
    ].filter((g) => g.items.length > 0);
  }, [tasks]);

  const renderTask = (task: Task) => {
    const done = task.status === 'DONE';
    const overdue = !done && isPast(parseISO(task.dueAt)) && !isToday(parseISO(task.dueAt));
    return (
      <div
        key={task.id}
        className={cn('flex items-start gap-3 p-4 transition-colors hover:bg-muted/40', done && 'opacity-60')}
      >
        <button
          type="button"
          aria-label={done ? 'Mark pending' : 'Mark done'}
          onClick={() => toggleMutation.mutate(task)}
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/40 hover:border-primary',
          )}
        >
          {done && <Check className="size-3.5" strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('font-medium text-foreground', done && 'line-through')}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className={cn(overdue && 'font-semibold text-destructive')}>{formatSmartTime(task.dueAt)}</span>
            <span className={cn('rounded-full px-2 py-0.5 font-medium ring-1 ring-inset', TASK_TYPE_META[task.type].pill)}>
              {TASK_TYPE_META[task.type].label}
            </span>
            {task.lead && <span>Lead: {task.lead.name}</span>}
            {task.booking && <span>Booking: {task.booking.customerName}</span>}
            {task.assignedTo && <span>→ {task.assignedTo.name}</span>}
          </div>
          {task.notes && <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Delete task" onClick={() => deleteMutation.mutate(task.id)}>
          <Trash2 className="text-destructive" />
        </Button>
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Tasks" description="Scheduled calls, meetings and follow-up reminders.">
        <Button onClick={() => setFormOpen(true)}>
          <Plus /> New task
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search task, lead, phone or date…"
            className="pl-9 pr-9"
            aria-label="Search tasks"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
        {(['PENDING', 'DONE', 'ALL'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
              filter === f
                ? 'bg-foreground text-background'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {f === 'PENDING' ? 'Open' : f === 'DONE' ? 'Completed' : 'All'}
          </button>
        ))}
        </div>
      </div>

      {tasksQuery.isLoading ? (
        <Card className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-56" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          ))}
        </Card>
      ) : search && tasks.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="No tasks match"
          description={`Nothing ${filter === 'PENDING' ? 'open ' : filter === 'DONE' ? 'completed ' : ''}matches “${search}”. Try another word${filter !== 'ALL' ? ', or look in All' : ''}.`}
          action={
            <Button variant="outline" onClick={() => setSearchInput('')}>
              Clear search
            </Button>
          }
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={filter === 'DONE' ? <ListChecks /> : <BellRing />}
          title={filter === 'DONE' ? 'Nothing completed yet' : 'No tasks scheduled'}
          description={
            filter === 'DONE'
              ? 'Completed tasks will appear here.'
              : 'Schedule follow-ups so no lead or booking ever slips.'
          }
          action={
            filter !== 'DONE' ? (
              <Button onClick={() => setFormOpen(true)}>
                <Plus /> New task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className={cn('mb-2 font-display text-sm font-bold uppercase tracking-wide', group.accent)}>
                {group.label} · {group.items.length}
              </h2>
              <Card className="divide-y divide-border">{group.items.map(renderTask)}</Card>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Schedule a call, meeting, or follow-up reminder.</DialogDescription>
          </DialogHeader>
          {formOpen && <TaskForm users={usersQuery.data ?? []} onDone={() => setFormOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
