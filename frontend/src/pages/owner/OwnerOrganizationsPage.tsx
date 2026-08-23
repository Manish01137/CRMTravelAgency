import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Search, ShieldBan, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { handleApiError } from '@/lib/formErrors';
import { OwnerShell } from './OwnerShell';
import { CreateOrganizationDialog } from './CreateOrganizationDialog';
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
      <PageHeader title="Organizations" description="Every travel agency using Joinetra.">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or slug…" className="pl-9" />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus /> New organization
        </Button>
      </PageHeader>

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No organizations found" className="border-none" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
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
            <tbody className="divide-y divide-border">
              {data.items.map((org) => (
                <tr key={org.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link to={`/owner/organizations/${org.id}`} className="font-medium text-foreground hover:text-primary">
                      {org.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{org.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground">{org._count.users}</td>
                  <td className="px-4 py-3 text-foreground">{org._count.leads}</td>
                  <td className="px-4 py-3 text-foreground">{org._count.bookings}</td>
                  <td className="px-4 py-3">
                    <Badge variant={org.status === 'ACTIVE' ? 'success' : 'destructive'}>{org.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(org.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setTarget(org)}>
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
      </Card>

      <ConfirmDialog
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
