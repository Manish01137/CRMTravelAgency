import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { StickyNote, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/formErrors';
import type { OrganizationNote } from './types';

/** Internal, owner-only notes — never visible to the organization itself
 *  (enforced server-side by RLS with no policy on organization_notes). */
export function OrganizationNotes({ organizationId }: { organizationId: string }) {
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['owner', 'organizations', organizationId, 'notes'],
    queryFn: () => api.get<OrganizationNote[]>(`/platform-admin/organizations/${organizationId}/notes`),
  });

  const addNote = useMutation({
    mutationFn: (text: string) => api.post(`/platform-admin/organizations/${organizationId}/notes`, { body: text }),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['owner', 'organizations', organizationId, 'notes'] });
    },
    onError: (err) => handleApiError(err),
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => api.delete(`/platform-admin/organizations/${organizationId}/notes/${noteId}`),
    onSuccess: () => {
      toast.success('Note deleted');
      queryClient.invalidateQueries({ queryKey: ['owner', 'organizations', organizationId, 'notes'] });
    },
    onError: (err) => handleApiError(err),
  });

  return (
    <div className="mt-8">
      <h2 className="font-display text-base font-semibold text-foreground">Internal notes</h2>
      <p className="mt-1 text-xs text-muted-foreground">Only visible here — never shown to the organization itself.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) addNote.mutate(body.trim());
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start"
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g. Upgraded to annual plan on 8/10, primary contact prefers WhatsApp…"
          className="min-h-[44px] flex-1"
        />
        <Button type="submit" disabled={addNote.isPending || !body.trim()}>
          Add note
        </Button>
      </form>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : !notes || notes.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <StickyNote className="size-4" /> No notes yet.
          </p>
        ) : (
          notes.map((note) => (
            <Card key={note.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <StickyNote className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {note.adminEmail} · {formatDateTime(note.createdAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteNote.mutate(note.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Delete note"
              >
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
