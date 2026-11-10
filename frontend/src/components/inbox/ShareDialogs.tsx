import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, Search, UserRound } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LocationCard, mapsLink, type SharedLocation } from './RichCards';

/** Send a map pin: paste a Google Maps link (or "lat, lng"), name it, send. */
export function LocationDialog({ open, onOpenChange, onSend }: { open: boolean; onOpenChange: (o: boolean) => void; onSend: (l: SharedLocation) => void }) {
  const [link, setLink] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);

  const reset = () => {
    setLink('');
    setName('');
    setAddress('');
    setPoint(null);
  };
  const resolve = useMutation({
    mutationFn: () => api.post<{ latitude: number; longitude: number; name: string | null }>('/inbox/location/resolve', { link }),
    onSuccess: (r) => {
      setPoint({ latitude: r.latitude, longitude: r.longitude });
      if (r.name && !name) setName(r.name);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not read that location'),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-[#ea4335]" /> Send a location
          </DialogTitle>
          <DialogDescription>Open the place in Google Maps, tap Share → Copy link, and paste it here.</DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim()) resolve.mutate();
          }}
        >
          <Input autoFocus value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://maps.app.goo.gl/…  or  32.2396, 77.1887" />
          <Button type="submit" variant="outline" disabled={!link.trim() || resolve.isPending}>
            {resolve.isPending ? <Spinner className="size-4" /> : <Search className="size-4" />} Find
          </Button>
        </form>
        {point && (
          <>
            <div className="grid gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Hotel Snow View)" maxLength={200} />
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" maxLength={300} />
            </div>
            <div className="flex justify-center rounded-xl bg-[#efeae2] p-3">
              <div className="rounded-[7.5px] bg-[#d9fdd3] p-1 shadow-sm">
                <LocationCard location={{ ...point, name: [name, address].filter(Boolean).join(', ') || null, url: mapsLink(point.latitude, point.longitude) }} tone="wa" />
              </div>
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!point}
            onClick={() => {
              if (!point) return;
              onSend({ ...point, name: name.trim() || undefined, address: address.trim() || undefined });
              onOpenChange(false);
              reset();
            }}
          >
            Send location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Send a contact card (driver, guide, hotel desk…). */
export function ContactDialog({
  open,
  onOpenChange,
  onSend,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSend: (c: { name: string; phone: string; email?: string }) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const phoneOk = /^\+?[\d\s()-]{6,20}$/.test(phone.trim());
  const reset = () => {
    setName('');
    setPhone('');
    setEmail('');
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-5 text-[#00a884]" /> Send a contact
          </DialogTitle>
          <DialogDescription>The customer gets a contact card they can save, call or message.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !phoneOk) return;
            onSend({ name: name.trim(), phone: phone.trim(), ...(email.trim() && { email: email.trim() }) });
            onOpenChange(false);
            reset();
          }}
        >
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Ramesh — Driver)" maxLength={120} />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone with country code, e.g. +91 98765 43210" inputMode="tel" />
          {phone && !phoneOk && <p className="-mt-2 text-xs text-destructive">Enter a valid phone number</p>}
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !phoneOk}>
              Send contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
