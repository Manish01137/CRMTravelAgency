import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarCheck2, Search, TrendingUp, UsersRound } from 'lucide-react';
import { api } from '@/lib/api';
import type { SearchResults } from './types';

/** Debounces a value by `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(query, 250);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['owner', 'search', debounced],
    queryFn: () => api.get<SearchResults>(`/platform-admin/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.trim().length > 0,
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const goToOrg = (orgId: string) => {
    setOpen(false);
    setQuery('');
    navigate(`/owner/organizations/${orgId}`);
  };

  const hasResults =
    !!data && (data.organizations.length > 0 || data.users.length > 0 || data.leads.length > 0 || data.bookings.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search organizations, users, leads, bookings…"
        className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
      />

      {open && debounced.trim().length > 0 && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
          {isFetching && !data ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : !hasResults ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No results for "{debounced}"</p>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1">
              {data!.organizations.length > 0 && (
                <ResultGroup icon={Building2} label="Organizations">
                  {data!.organizations.map((org) => (
                    <ResultRow key={org.id} title={org.name} subtitle={org.slug} onClick={() => goToOrg(org.id)} />
                  ))}
                </ResultGroup>
              )}
              {data!.users.length > 0 && (
                <ResultGroup icon={UsersRound} label="Users">
                  {data!.users.map((u) => (
                    <ResultRow key={u.id} title={u.name} subtitle={`${u.email} · ${u.organization.name}`} onClick={() => goToOrg(u.organization.id)} />
                  ))}
                </ResultGroup>
              )}
              {data!.leads.length > 0 && (
                <ResultGroup icon={TrendingUp} label="Leads">
                  {data!.leads.map((lead) => (
                    <ResultRow
                      key={lead.id}
                      title={lead.name}
                      subtitle={`${lead.phone ?? lead.email ?? ''} · ${lead.organization.name}`}
                      onClick={() => goToOrg(lead.organization.id)}
                    />
                  ))}
                </ResultGroup>
              )}
              {data!.bookings.length > 0 && (
                <ResultGroup icon={CalendarCheck2} label="Bookings">
                  {data!.bookings.map((bk) => (
                    <ResultRow
                      key={bk.id}
                      title={`${bk.customerName} · BK-${bk.bookingNumber}`}
                      subtitle={`${bk.customerPhone ?? ''} · ${bk.organization.name}`}
                      onClick={() => goToOrg(bk.organization.id)}
                    />
                  ))}
                </ResultGroup>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ icon: Icon, label, children }: { icon: typeof Building2; label: string; children: ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        <Icon className="size-3" /> {label}
      </p>
      {children}
    </div>
  );
}

function ResultRow({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start px-4 py-2 text-left text-sm hover:bg-muted"
    >
      <span className="font-medium text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground">{subtitle}</span>
    </button>
  );
}
