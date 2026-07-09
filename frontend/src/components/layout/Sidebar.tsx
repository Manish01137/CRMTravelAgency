import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, SETTINGS_ITEMS, type NavItem } from './nav';
import { useAuth } from '@/context/AuthContext';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const { isAdmin } = useAuth();
  const visible = items.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="space-y-1">
      {visible.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <item.icon className="size-[18px] shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function BrandMark() {
  const { organization } = useAuth();
  const primary = organization?.brandPrimaryColor || '#4F46E5';

  return (
    <div className="flex min-w-0 items-center gap-3">
      {organization?.logoUrl ? (
        <img
          src={organization.logoUrl}
          alt=""
          className="h-9 w-9 rounded-lg object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: primary }}
        >
          {initials(organization?.name ?? 'CRM')}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold text-foreground">
          {organization?.name ?? 'Voyage CRM'}
        </p>
        <p className="truncate text-xs text-muted-foreground">Travel CRM</p>
      </div>
    </div>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-1">
        <BrandMark />
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto scrollbar-thin">
        <NavLinks items={NAV_ITEMS} onNavigate={onNavigate} />
        <div>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            Settings
          </p>
          <NavLinks items={SETTINGS_ITEMS} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
