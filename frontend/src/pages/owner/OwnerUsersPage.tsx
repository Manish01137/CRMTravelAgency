import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { fromNow } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { handleApiError } from '@/lib/formErrors';
import { OwnerShell } from './OwnerShell';
import type { OwnerUserRow, Paginated } from './types';

export function OwnerUsersPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'users', search],
    queryFn: () =>
      api.get<Paginated<OwnerUserRow>>(`/platform-admin/users?${new URLSearchParams({ ...(search ? { search } : {}), pageSize: '50' })}`),
  });

  const toggleStatus = useMutation({
    mutationFn: (user: OwnerUserRow) =>
      api.patch(`/platform-admin/users/${user.id}/status`, { status: user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' }),
    onSuccess: () => {
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['owner', 'users'] });
    },
    onError: (err) => handleApiError(err),
  });

  return (
    <OwnerShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Users</h1>
          <p className="mt-1 text-sm text-white/50">Every team member across every organization.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="border-white/10 bg-white/[0.03] pl-9 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md bg-white/5" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No users found" className="border-none bg-transparent text-white/50" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.items.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{user.name}</p>
                    <p className="text-xs text-white/40">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/owner/organizations/${user.organization.id}`} className="text-white/70 hover:text-primary">
                      {user.organization.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        user.role === 'ADMIN'
                          ? 'inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-400/20'
                          : 'inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60 ring-1 ring-inset ring-white/10'
                      }
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        user.status === 'DISABLED'
                          ? 'inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-inset ring-rose-400/20'
                          : 'inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/20'
                      }
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/50">{user.lastLoginAt ? fromNow(user.lastLoginAt) : 'Never'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-white/15 bg-transparent text-xs text-white hover:bg-white/10"
                      disabled={toggleStatus.isPending}
                      onClick={() => toggleStatus.mutate(user)}
                    >
                      {user.status === 'DISABLED' ? 'Enable' : 'Disable'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </OwnerShell>
  );
}
