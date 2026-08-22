import type { ReactNode } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/** Dark-themed confirm dialog for the owner panel — the shared ConfirmDialog
 *  has no className passthrough and would render as a light popup inside this
 *  panel's dark theme, so this reuses the raw Dialog primitives instead, same
 *  pattern as CreateOrganizationDialog. */
export function OwnerConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/10 bg-[#15171d]">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          {description && <DialogDescription className="text-white/50">{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            className={
              destructive
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:brightness-110'
                : 'bg-gradient-to-r from-primary to-secondary text-white hover:brightness-110'
            }
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Spinner />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
