import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { handleApiError } from '@/lib/formErrors';

const schema = z.object({
  organizationName: z.string().trim().min(1, 'Organization name is required'),
  adminName: z.string().trim().min(1, "Admin's name is required"),
  adminEmail: z.string().trim().email('Enter a valid email'),
});
type Values = z.infer<typeof schema>;

interface CreatedResult {
  organization: { id: string; name: string };
  admin: { email: string; name: string };
  generatedPassword: string;
}

export function CreateOrganizationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<CreatedResult | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { organizationName: '', adminName: '', adminEmail: '' } });

  const create = useMutation({
    mutationFn: (values: Values) => api.post<CreatedResult>('/platform-admin/organizations', values),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['owner', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['owner', 'stats'] });
    },
    onError: (err) => handleApiError(err, setError),
  });

  const close = (openNext: boolean) => {
    if (!openNext) {
      reset();
      setResult(null);
    }
    onOpenChange(openNext);
  };

  const copyCredentials = () => {
    if (!result) return;
    void navigator.clipboard.writeText(`Email: ${result.admin.email}\nPassword: ${result.generatedPassword}`);
    toast.success('Credentials copied');
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Organization created</DialogTitle>
              <DialogDescription>
                Send these credentials to the agency — this password is shown once and can't be retrieved again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-lg border border-success/30 bg-success/5 p-4 font-mono text-sm text-foreground">
              <p>Email: {result.admin.email}</p>
              <p>Password: {result.generatedPassword}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={copyCredentials}>
                <Copy className="size-4" /> Copy
              </Button>
              <Button type="button" onClick={() => close(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New organization</DialogTitle>
              <DialogDescription>
                Creates the org and its first admin account, skipping self-signup/OTP. A password is generated for you.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4" noValidate>
              <Field label="Organization name" htmlFor="organizationName" error={errors.organizationName?.message} required>
                <Input id="organizationName" aria-invalid={!!errors.organizationName} {...register('organizationName')} />
              </Field>
              <Field label="Admin name" htmlFor="adminName" error={errors.adminName?.message} required>
                <Input id="adminName" aria-invalid={!!errors.adminName} {...register('adminName')} />
              </Field>
              <Field label="Admin email" htmlFor="adminEmail" error={errors.adminEmail?.message} required>
                <Input id="adminEmail" type="email" aria-invalid={!!errors.adminEmail} {...register('adminEmail')} />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => close(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Spinner />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
