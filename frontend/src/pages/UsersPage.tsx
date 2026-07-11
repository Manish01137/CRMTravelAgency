import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Ban,
  CircleCheck,
  Clock,
  MoreHorizontal,
  Shield,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Invitation, Role, User, UserStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InviteDialog } from '@/components/users/InviteDialog';
import { ROLE_LABEL, USER_STATUS_META } from '@/lib/leadMeta';
import { fromNow, formatDate } from '@/lib/format';
import { handleApiError } from '@/lib/formErrors';

function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === 'ADMIN' ? 'default' : 'muted'}>
      {role === 'ADMIN' && <Shield className="size-3" />}
      {ROLE_LABEL[role]}
    </Badge>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const meta = USER_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<User | null>(null);

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });
  const invitationsQuery = useQuery({
    queryKey: ['invitations'],
    queryFn: () => api.get<Invitation[]>('/users/invitations'),
  });

  const members = usersQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<User, 'role' | 'status'>> }) =>
      api.patch<User>(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Team member updated');
    },
    onError: (err) => handleApiError(err),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Team member removed');
      setRemoving(null);
    },
    onError: (err) => handleApiError(err),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/users/invitations/${id}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('Invitation revoked');
    },
    onError: () => toast.error('Could not revoke invitation'),
  });

  const renderActions = (member: User) => {
    if (member.id === currentUser?.id) {
      return <span className="text-xs font-medium text-muted-foreground">You</span>;
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              updateMutation.mutate({
                id: member.id,
                data: { role: member.role === 'ADMIN' ? 'AGENT' : 'ADMIN' },
              })
            }
          >
            {member.role === 'ADMIN' ? <UserRound /> : <Shield />}
            {member.role === 'ADMIN' ? 'Change to agent' : 'Make admin'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              updateMutation.mutate({
                id: member.id,
                data: { status: member.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' },
              })
            }
          >
            {member.status === 'DISABLED' ? <CircleCheck /> : <Ban />}
            {member.status === 'DISABLED' ? 'Enable access' : 'Disable access'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setRemoving(member)}>
            <Trash2 /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div>
      <PageHeader title="Team" description="Invite teammates and manage their access.">
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus /> Invite teammate
        </Button>
      </PageHeader>

      {/* Team stat chips */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Members', value: members.length, tile: 'bg-gradient-to-br from-primary to-violet-500' },
          { label: 'Admins', value: members.filter((m) => m.role === 'ADMIN').length, tile: 'bg-gradient-to-br from-sky-500 to-blue-600' },
          { label: 'Pending invites', value: invitations.length, tile: 'bg-gradient-to-br from-amber-400 to-orange-500' },
        ].map((s) => (
          <Card key={s.label} className="flex items-center gap-3 p-4">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-white ${s.tile}`}>
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs text-muted-foreground">{s.label}</span>
              <span className="block font-display text-xl font-bold text-foreground">{s.value}</span>
            </span>
          </Card>
        ))}
      </div>

      {/* Members */}
      {usersQuery.isLoading ? (
        <Card className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-primary/[0.04] text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Last active</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((member) => (
                    <tr key={member.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{member.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={member.role} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={member.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {member.lastLoginAt ? fromNow(member.lastLoginAt) : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-right">{renderActions(member)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {members.map((member) => (
              <Card key={member.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{member.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  {renderActions(member)}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <RoleBadge role={member.role} />
                  <StatusBadge status={member.status} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Friendly nudge when the team is just the owner */}
      {!usersQuery.isLoading && members.length <= 1 && invitations.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={<Users />}
            title="It's just you so far"
            description="Invite agents so your whole team can capture and work leads together."
            action={
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus /> Invite teammate
              </Button>
            }
          />
        </div>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="size-4 text-muted-foreground" /> Pending invitations
          </h2>
          <Card className="divide-y divide-border">
            {invitations.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{invite.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ROLE_LABEL[invite.role]} · expires {formatDate(invite.expiresAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Invited</Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Revoke invitation for ${invite.email}`}
                    onClick={() => revokeMutation.mutate(invite.id)}
                    disabled={revokeMutation.isPending}
                  >
                    <X />
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove team member?"
        description={
          removing ? (
            <>
              <span className="font-medium text-foreground">{removing.name}</span> will lose access to
              this workspace. Leads assigned to them become unassigned.
            </>
          ) : undefined
        }
        confirmLabel="Remove member"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => removing && removeMutation.mutate(removing.id)}
      />
    </div>
  );
}
