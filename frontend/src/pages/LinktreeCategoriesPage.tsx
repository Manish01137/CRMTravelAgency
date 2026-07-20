import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, GripVertical, ListTree, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { LinktreeCategory, TravelPackage } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * LinkTree category manager: create / rename / delete / drag-reorder categories,
 * and assign packages to a category via checkboxes. The same PackageCategory
 * rows are also editable from each package's edit screen — both stay in sync.
 */
export function LinktreeCategoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState<LinktreeCategory | null>(null);
  const [assigning, setAssigning] = useState<LinktreeCategory | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const categoriesQuery = useQuery({ queryKey: ['linktree-categories'], queryFn: () => api.get<LinktreeCategory[]>('/linktree-categories') });
  const packagesQuery = useQuery({ queryKey: ['packages'], queryFn: () => api.get<TravelPackage[]>('/packages') });

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const packages = packagesQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['linktree-categories'] });
    queryClient.invalidateQueries({ queryKey: ['packages'] });
  };

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post<LinktreeCategory>('/linktree-categories', { name }),
    onSuccess: () => {
      invalidate();
      setNewName('');
      toast.success('LinktreeCategory created');
    },
    onError: () => toast.error('Could not create the category'),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch<LinktreeCategory>(`/linktree-categories/${id}`, { name }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast.success('LinktreeCategory renamed');
    },
    onError: () => toast.error('Could not rename the category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/linktree-categories/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast.success('LinktreeCategory deleted — its packages were kept');
    },
    onError: () => toast.error('Could not delete the category'),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => api.put('/linktree-categories/reorder', { ids }),
    onSuccess: invalidate,
    onError: () => toast.error('Could not save the new order'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ pkg, categoryIds }: { pkg: TravelPackage; categoryIds: string[] }) =>
      api.patch<TravelPackage>(`/packages/${pkg.id}`, { linktreeCategoryIds: categoryIds }),
    onSuccess: invalidate,
    onError: () => toast.error('Could not update the assignment'),
  });

  /** Drop dragged category onto target: reorder the full list and persist. */
  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = categories.map((c) => c.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setDragId(null);
    reorderMutation.mutate(ids);
  };

  const move = (id: string, dir: -1 | 1) => {
    const ids = categories.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderMutation.mutate(ids);
  };

  const togglePackage = (pkg: TravelPackage, category: LinktreeCategory) => {
    const has = pkg.linktreeCategoryIds.includes(category.id);
    const categoryIds = has ? pkg.linktreeCategoryIds.filter((id) => id !== category.id) : [...pkg.linktreeCategoryIds, category.id];
    assignMutation.mutate({ pkg, categoryIds });
  };

  return (
    <div>
      <button
        onClick={() => navigate('/linktree')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> LinkTree
      </button>

      <PageHeader
        title="Manage LinkTree Categories"
        description="LinkTree tabs come from these categories, in this order. Drag to reorder; assign packages from here or from each package's edit screen."
      />

      {/* Create */}
      <Card className="mb-5 p-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createMutation.mutate(newName.trim());
          }}
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category — e.g. Weekend Trips, Chardham, Kashmir…"
            className="flex-1"
          />
          <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
            <Plus /> Create
          </Button>
        </form>
      </Card>

      {categoriesQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<ListTree />}
          title="No categories yet"
          description="Create categories like 'Weekend Trips' or 'Chardham' — they become the tabs on your public LinkTree page."
        />
      ) : (
        <Card className="divide-y divide-border p-0">
          {categories.map((cat, i) => (
            <div
              key={cat.id}
              draggable
              onDragStart={() => setDragId(cat.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(cat.id)}
              onDragEnd={() => setDragId(null)}
              className={cn(
                'flex flex-wrap items-center gap-3 p-3.5 transition-colors',
                dragId === cat.id ? 'opacity-50' : 'hover:bg-muted/40',
              )}
            >
              <span className="cursor-grab text-muted-foreground/50 active:cursor-grabbing" title="Drag to reorder">
                <GripVertical className="size-4" />
              </span>

              {/* Up/down fallback for touch devices */}
              <span className="flex flex-col">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(cat.id, -1)}
                  className="text-muted-foreground/60 hover:text-foreground disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === categories.length - 1}
                  onClick={() => move(cat.id, 1)}
                  className="text-muted-foreground/60 hover:text-foreground disabled:opacity-30"
                >
                  ▼
                </button>
              </span>

              <div className="min-w-0 flex-1">
                {editingId === cat.id ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editName.trim()) renameMutation.mutate({ id: cat.id, name: editName.trim() });
                    }}
                  >
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9 max-w-xs" autoFocus />
                    <Button type="submit" size="icon-sm" aria-label="Save name" disabled={renameMutation.isPending}>
                      <Check />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel" onClick={() => setEditingId(null)}>
                      <X />
                    </Button>
                  </form>
                ) : (
                  <>
                    <p className="font-medium text-foreground">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cat.packageCount ?? 0} package{(cat.packageCount ?? 0) === 1 ? '' : 's'} · tab #{i + 1}
                    </p>
                  </>
                )}
              </div>

              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setAssigning(cat)}>
                  Assign packages
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Rename category"
                  onClick={() => {
                    setEditingId(cat.id);
                    setEditName(cat.name);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete category"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleting(cat)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Assign packages to a category */}
      <Dialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign packages — {assigning?.name}</DialogTitle>
            <DialogDescription>
              Tick the packages that belong in this category. This is the same assignment you can edit on each package.
            </DialogDescription>
          </DialogHeader>
          {packages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No packages yet.</p>
          ) : (
            <div className="space-y-1">
              {packages.map((pkg) => {
                const checked = assigning ? pkg.linktreeCategoryIds.includes(assigning.id) : false;
                return (
                  <label
                    key={pkg.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={assignMutation.isPending}
                      onChange={() => assigning && togglePackage(pkg, assigning)}
                      className="size-4 accent-[var(--tw-prose-links,#4F46E5)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{pkg.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {pkg.destination} · {pkg.days}D/{pkg.nights}N
                        {!pkg.showOnLinktree && ' · not shown on LinkTree yet'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description={`Packages assigned to it are NOT deleted — they only lose this category tag${
          deleting?.packageCount ? ` (${deleting.packageCount} package${deleting.packageCount === 1 ? '' : 's'} affected)` : ''
        }. The tab disappears from your LinkTree page.`}
        confirmLabel="Delete category"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
