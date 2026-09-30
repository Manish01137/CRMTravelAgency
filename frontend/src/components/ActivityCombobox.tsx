import { useState } from 'react';
import { MapPin, Search as SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SightseeingActivity } from '@/types';

/** Search-and-pick from the Sightseeing library — shared by the Package
 *  Builder's Itinerary step and the standalone Itinerary Composer. Keyboard:
 *  ↑/↓ to move, Enter to pick, Escape to close. */
export function ActivityCombobox({
  activities,
  onPick,
}: {
  activities: SightseeingActivity[];
  onPick: (a: SightseeingActivity) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  if (activities.length === 0) {
    return (
      <a
        href="/sightseeing"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        <MapPin className="size-3.5 shrink-0" /> No sightseeing activities yet — add some on the Sightseeing page
      </a>
    );
  }

  const needle = q.trim().toLowerCase();
  const filtered = activities
    .filter((a) => !needle || a.name.toLowerCase().includes(needle) || (a.notes ?? '').toLowerCase().includes(needle))
    .slice(0, 8);
  const current = Math.min(active, Math.max(0, filtered.length - 1));

  const pick = (a: SightseeingActivity) => {
    onPick(a);
    setQ('');
    setActive(0);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              // Never let Enter fall through to the surrounding form (it would save and leave the page).
              e.preventDefault();
              if (open && filtered[current]) pick(filtered[current]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder="Add sightseeing — search your library…"
          className="pl-9"
        />
      </div>
      {open && (
        <div role="listbox" className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card p-1 shadow-pop">
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">No sightseeing matches “{q.trim()}”.</p>
          ) : (
            filtered.map((a, i) => (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={i === current}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus in the input so blur doesn't close before the pick
                  pick(a);
                }}
                className={cn('flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left', i === current ? 'bg-muted' : 'hover:bg-muted')}
              >
                {a.imageUrl ? (
                  <img src={a.imageUrl} alt="" className="size-8 shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                    <MapPin className="size-3.5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{a.name}</span>
                  {a.notes && <span className="block truncate text-xs text-muted-foreground">{a.notes}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
