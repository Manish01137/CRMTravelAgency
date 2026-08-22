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
import { Spinner } from '@/components/ui/spinner';
import { handleApiError } from '@/lib/formErrors';
import { DarkField } from './DarkField';

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

  const darkInput = 'border-white/10 bg-white/[0.03] text-white placeholder:text-white/25 focus-visible:border-primary/60 focus-visible:ring-primary/25';
  const gradientButton = 'bg-gradient-to-r from-primary to-secondary text-white shadow-[0_4px_16px_rgba(79,70,229,0.35)] hover:brightness-110';

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-2xl border-white/10 bg-[#15171d]">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Organization created</DialogTitle>
              <DialogDescription className="text-white/50">
                Send these credentials to the agency — this password is shown once and can't be retrieved again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4 font-mono text-sm text-white">
              <p>Email: {result.admin.email}</p>
              <p>Password: {result.generatedPassword}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={copyCredentials}>
                <Copy className="size-4" /> Copy
              </Button>
              <Button type="button" className={gradientButton} onClick={() => close(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">New organization</DialogTitle>
              <DialogDescription className="text-white/50">
                Creates the org and its first admin account, skipping self-signup/OTP. A password is generated for you.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4" noValidate>
              <DarkField label="Organization name" htmlFor="organizationName" error={errors.organizationName?.message}>
                <Input id="organizationName" className={darkInput} aria-invalid={!!errors.organizationName} {...register('organizationName')} />
              </DarkField>
              <DarkField label="Admin name" htmlFor="adminName" error={errors.adminName?.message}>
                <Input id="adminName" className={darkInput} aria-invalid={!!errors.adminName} {...register('adminName')} />
              </DarkField>
              <DarkField label="Admin email" htmlFor="adminEmail" error={errors.adminEmail?.message}>
                <Input id="adminEmail" type="email" className={darkInput} aria-invalid={!!errors.adminEmail} {...register('adminEmail')} />
              </DarkField>
              <DialogFooter>
                <Button type="button" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={() => close(false)}>
                  Cancel
                </Button>
                <Button type="submit" className={gradientButton} disabled={isSubmitting}>
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
