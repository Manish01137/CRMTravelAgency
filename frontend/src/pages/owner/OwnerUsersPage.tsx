import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { fromNow } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
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
      <PageHeader title="Users" description="Every team member across every organization.">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" className="pl-9" />
        </div>
      </PageHeader>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No users found" className="border-none" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/owner/organizations/${user.organization.id}`} className="text-foreground hover:text-primary">
                      {user.organization.name}
                    </Link>
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
      </Card>
    </OwnerShell>
  );
}
