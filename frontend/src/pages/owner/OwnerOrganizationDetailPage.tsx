import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CalendarCheck2, ShieldBan, ShieldCheck, TrendingUp, UsersRound, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, fromNow } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { handleApiError } from '@/lib/formErrors';
import { OwnerShell } from './OwnerShell';
import { OrganizationNotes } from './OrganizationNotes';
import { StatTile } from './StatTile';
import type { OwnerOrganizationDetail } from './types';

export function OwnerOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: org, isLoading } = useQuery({
    queryKey: ['owner', 'organizations', id],
    queryFn: () => api.get<OwnerOrganizationDetail>(`/platform-admin/organizations/${id}`),
    enabled: !!id,
  });

  const toggleStatus = useMutation({
    mutationFn: () =>
      api.patch(`/platform-admin/organizations/${id}/status`, {
        status: org?.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      }),
    onSuccess: () => {
      toast.success(org?.status === 'ACTIVE' ? 'Organization suspended' : 'Organization reactivated');
      queryClient.invalidateQueries({ queryKey: ['owner', 'organizations'] });
      setConfirmOpen(false);
    },
    onError: (err) => handleApiError(err),
  });

  const toggleUserStatus = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'ACTIVE' | 'DISABLED' }) =>
      api.patch(`/platform-admin/users/${userId}/status`, { status }),
    onSuccess: () => {
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['owner', 'organizations', id] });
    },
    onError: (err) => handleApiError(err),
  });

  if (isLoading || !org) {
    return (
      <OwnerShell>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-40 rounded-lg" />
      </OwnerShell>
    );
  }

  return (
    <OwnerShell>
      <button
        type="button"
        onClick={() => navigate('/owner/organizations')}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to organizations
      </button>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{org.name}</h1>
            <Badge variant={org.status === 'ACTIVE' ? 'success' : 'destructive'}>{org.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {org.slug} · Signed up {formatDate(org.createdAt)}
          </p>
          {org.status === 'SUSPENDED' && org.suspendedReason && (
            <p className="mt-2 text-sm text-amber-600">Reason: {org.suspendedReason}</p>
          )}
        </div>
        <Button variant={org.status === 'ACTIVE' ? 'destructive' : 'default'} onClick={() => setConfirmOpen(true)}>
          {org.status === 'ACTIVE' ? (
            <>
              <ShieldBan className="size-4" /> Suspend organization
            </>
          ) : (
            <>
              <ShieldCheck className="size-4" /> Reactivate organization
            </>
          )}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile icon={UsersRound} label="Users" value={org.users.length} accent="teal" />
        <StatTile icon={TrendingUp} label="Leads" value={org._count.leads} accent="sky" />
        <StatTile icon={CalendarCheck2} label="Bookings" value={org._count.bookings} accent="amber" />
        <StatTile icon={Wallet} label="Booking value" value={formatCurrency(org.totalBookingValue, 'INR')} accent="violet" />
      </div>

      <div className="mt-8">
        <h2 className="font-display text-base font-semibold text-foreground">Team members</h2>
        <Card className="mt-3 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {org.users.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.role === 'ADMIN' ? 'default' : 'muted'}>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.status === 'DISABLED' ? 'destructive' : 'success'}>{user.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.lastLoginAt ? fromNow(user.lastLoginAt) : 'Never'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={toggleUserStatus.isPending}
                      onClick={() =>
                        toggleUserStatus.mutate({ userId: user.id, status: user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' })
                      }
                    >
                      {user.status === 'DISABLED' ? 'Enable' : 'Disable'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <OrganizationNotes organizationId={org.id} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={org.status === 'ACTIVE' ? `Suspend ${org.name}?` : `Reactivate ${org.name}?`}
        description={
          org.status === 'ACTIVE'
            ? 'Every user in this organization will be immediately signed out and unable to log back in until reactivated. Their data is untouched.'
            : 'Users in this organization will be able to log in again.'
        }
        confirmLabel={org.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
        destructive={org.status === 'ACTIVE'}
        loading={toggleStatus.isPending}
        onConfirm={() => toggleStatus.mutate()}
      />
    </OwnerShell>
  );
}
