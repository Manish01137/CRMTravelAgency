import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Search, ShieldBan, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { handleApiError } from '@/lib/formErrors';
import { OwnerShell } from './OwnerShell';
import { CreateOrganizationDialog } from './CreateOrganizationDialog';
import { OwnerConfirmDialog } from './OwnerConfirmDialog';
import type { OwnerOrganizationRow, Paginated } from './types';

export function OwnerOrganizationsPage() {
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<OwnerOrganizationRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'organizations', search],
    queryFn: () =>
      api.get<Paginated<OwnerOrganizationRow>>(`/platform-admin/organizations?${new URLSearchParams({ ...(search ? { search } : {}), pageSize: '50' })}`),
  });

  const toggleStatus = useMutation({
    mutationFn: (org: OwnerOrganizationRow) =>
      api.patch(`/platform-admin/organizations/${org.id}/status`, {
        status: org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      }),
    onSuccess: (_data, org) => {
      toast.success(org.status === 'ACTIVE' ? 'Organization suspended' : 'Organization reactivated');
      queryClient.invalidateQueries({ queryKey: ['owner', 'organizations'] });
      setTarget(null);
    },
    onError: (err) => handleApiError(err),
  });

  return (
    <OwnerShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Organizations</h1>
          <p className="mt-1 text-sm text-white/50">Every travel agency using Joinetra.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or slug…"
              className="border-white/10 bg-white/[0.03] pl-9 text-white placeholder:text-white/30"
            />
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-gradient-to-r from-primary to-secondary text-white shadow-[0_4px_16px_rgba(79,70,229,0.35)] hover:brightness-110"
          >
            <Plus className="size-4" /> New organization
          </Button>
        </div>
      </div>

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md bg-white/5" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No organizations found" className="border-none bg-transparent text-white/50" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Leads</th>
                <th className="px-4 py-3 font-medium">Bookings</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.items.map((org) => (
                <tr key={org.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <Link to={`/owner/organizations/${org.id}`} className="font-medium text-white hover:text-primary">
                      {org.name}
                    </Link>
                    <p className="text-xs text-white/40">{org.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-white/70">{org._count.users}</td>
                  <td className="px-4 py-3 text-white/70">{org._count.leads}</td>
                  <td className="px-4 py-3 text-white/70">{org._count.bookings}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        org.status === 'ACTIVE'
                          ? 'inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/20'
                          : 'inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-inset ring-rose-400/20'
                      }
                    >
                      {org.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/50">{formatDate(org.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-white/15 bg-transparent text-xs text-white hover:bg-white/10"
                      onClick={() => setTarget(org)}
                    >
                      {org.status === 'ACTIVE' ? (
                        <>
                          <ShieldBan className="size-3.5" /> Suspend
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="size-3.5" /> Reactivate
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <OwnerConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target?.status === 'ACTIVE' ? `Suspend ${target.name}?` : `Reactivate ${target?.name}?`}
        description={
          target?.status === 'ACTIVE'
            ? 'Every user in this organization will be immediately signed out and unable to log back in until reactivated. Their data is untouched.'
            : 'Users in this organization will be able to log in again.'
        }
        confirmLabel={target?.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
        destructive={target?.status === 'ACTIVE'}
        loading={toggleStatus.isPending}
        onConfirm={() => target && toggleStatus.mutate(target)}
      />
    </OwnerShell>
  );
}
