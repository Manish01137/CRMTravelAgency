import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu } from 'lucide-react';
import { BrandMark, SidebarContent } from './Sidebar';
import { UserMenu } from './UserMenu';

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card md:flex">
        <div className="flex-1 overflow-hidden">
          <SidebarContent />
        </div>
        <div className="border-t border-border p-3">
          <UserMenu />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/85 px-4 backdrop-blur md:hidden">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-overlay-in md:hidden" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85%] flex-col border-r border-border bg-card shadow-pop data-[state=open]:animate-slide-in-left focus:outline-none md:hidden">
              <Dialog.Title className="sr-only">Navigation</Dialog.Title>
              <Dialog.Description className="sr-only">Main menu</Dialog.Description>
              <div className="flex-1 overflow-hidden">
                <SidebarContent onNavigate={() => setOpen(false)} />
              </div>
              <div className="border-t border-border p-3">
                <UserMenu />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <div className="min-w-0 flex-1">
          <BrandMark />
        </div>
        <UserMenu variant="compact" />
      </header>

      {/* Main content */}
      <div className="md:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
