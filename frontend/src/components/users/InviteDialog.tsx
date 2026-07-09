import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Check, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import type { InviteResult } from '@/types';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { handleApiError } from '@/lib/formErrors';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  role: z.enum(['AGENT', 'ADMIN']),
});
type Values = z.infer<typeof schema>;

function InviteForm({ onInvited }: { onInvited: (result: InviteResult) => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', role: 'AGENT' } });

  const mutation = useMutation({
    mutationFn: (values: Values) => api.post<InviteResult>('/users/invite', values),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('Invitation created');
      onInvited(result);
    },
    onError: (err) => handleApiError(err, setError),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="invite-email" error={errors.email?.message} required>
        <Input
          id="invite-email"
          type="email"
          placeholder="teammate@agency.com"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
      </Field>
      <Field label="Role" htmlFor="invite-role">
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AGENT">Agent — works leads</SelectItem>
                <SelectItem value="ADMIN">Admin — full access</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <DialogFooter className="pt-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          Create invite
        </Button>
      </DialogFooter>
    </form>
  );
}

function InviteSuccess({ result, onReset }: { result: InviteResult; onReset: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.acceptUrl);
      setCopied(true);
      toast.success('Invite link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select and copy the link manually');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
        <p className="text-muted-foreground">
          Email delivery arrives in a later phase. For now, share this secure link with{' '}
          <span className="font-medium text-foreground">{result.invitation.email}</span> so they can
          set up their account.
        </p>
      </div>
      <Field label="Invite link">
        <div className="flex gap-2">
          <Input readOnly value={result.acceptUrl} className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copy link">
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </Field>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onReset}>
          Invite another
        </Button>
        <DialogClose asChild>
          <Button type="button">Done</Button>
        </DialogClose>
      </DialogFooter>
    </div>
  );
}

export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [result, setResult] = useState<InviteResult | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) setResult(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" /> Invite a teammate
          </DialogTitle>
          <DialogDescription>
            They'll join {result ? '' : 'your organization'} with the role you choose.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <InviteSuccess result={result} onReset={() => setResult(null)} />
        ) : (
          <InviteForm onInvited={setResult} />
        )}
      </DialogContent>
    </Dialog>
  );
}
