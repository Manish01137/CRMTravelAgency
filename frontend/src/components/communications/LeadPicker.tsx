import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Lead, Paginated } from '@/types';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useDebounce } from '@/lib/useDebounce';

/**
 * Search-and-pick widget for "do something against a lead" screens (Communications,
 * Call Log). Reads the existing `/leads` list endpoint — Leads' own files are never
 * touched, same pattern the backend communications/call-log modules already use.
 */
export function LeadPicker({ selected, onSelect }: { selected: Lead | null; onSelect: (lead: Lead | null) => void }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 300);

  const searchQuery = useQuery({
    queryKey: ['lead-picker-search', debounced],
    queryFn: () => api.get<Paginated<Lead>>(`/leads?search=${encodeURIComponent(debounced)}&pageSize=8`),
    enabled: debounced.length > 0,
  });

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{selected.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[selected.phone, selected.email].filter(Boolean).join(' · ') || 'No contact details'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" /> Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search leads by name or phone…"
          className="pl-9"
          aria-label="Search leads"
        />
      </div>
      {debounced.length > 0 && (
        <div className="absolute z-10 mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-pop">
          {searchQuery.isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Spinner className="size-4 text-muted-foreground" />
            </div>
          ) : (searchQuery.data?.items.length ?? 0) === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No leads match "{debounced}"</p>
          ) : (
            searchQuery.data!.items.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => {
                  onSelect(lead);
                  setQuery('');
                }}
                className="flex w-full flex-col items-start gap-0.5 border-b border-border px-4 py-2.5 text-left last:border-b-0 hover:bg-muted/60"
              >
                <span className="font-medium text-foreground">{lead.name}</span>
                <span className="text-xs text-muted-foreground">{[lead.phone, lead.email].filter(Boolean).join(' · ') || '—'}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
