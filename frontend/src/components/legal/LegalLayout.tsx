import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Plane } from 'lucide-react';

/** Shared chrome for standalone legal pages (Privacy Policy, Terms of Service) — a
 * lightweight version of the landing page's header/footer, without the marketing nav. */
export function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-[4.25rem] max-w-3xl items-center px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Plane className="size-5" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-foreground">Joinetra</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updatedAt}</p>

        <div className="prose-legal mt-10 space-y-8 text-[15px] leading-relaxed text-foreground/90">{children}</div>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-3xl px-4 text-sm text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Joinetra. All rights reserved. ·{' '}
          <Link to="/" className="underline-offset-2 hover:underline">
            Back to home
          </Link>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold tracking-tight text-foreground">{heading}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
