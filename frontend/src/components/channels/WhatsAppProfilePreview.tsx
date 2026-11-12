import { Clock3, Globe, LayoutGrid, Mail, MapPin, Phone, Share2, Store, Tag } from 'lucide-react';
import { initials } from '@/lib/format';

/**
 * How the Business Profile looks to a customer inside WhatsApp (dark theme,
 * like the phone app) — updates live while the form is edited.
 */
export function WhatsAppProfilePreview({
  name,
  phone,
  photoUrl,
  about,
  description,
  category,
  address,
  email,
  websites,
  catalogVisible,
}: {
  name: string;
  phone: string | null;
  photoUrl: string | null;
  about: string;
  description: string;
  category: string;
  address: string;
  email: string;
  websites: string[];
  catalogVisible: boolean;
}) {
  const row = (icon: React.ReactNode, text: React.ReactNode, link = false) => (
    <div className="flex gap-4 px-5 py-3">
      <span className="mt-0.5 shrink-0 text-[#8696a0]">{icon}</span>
      <span className={link ? 'min-w-0 break-words text-[14px] text-[#25d366]' : 'min-w-0 whitespace-pre-line break-words text-[14px] text-[#e9edef]'}>{text}</span>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-[28px] border-[6px] border-[#1f2c34] bg-[#111b21] shadow-xl">
      <div className="max-h-[620px] overflow-y-auto pb-4">
        <div className="h-24 bg-gradient-to-br from-[#1f2c34] to-[#0b141a]" />
        <div className="-mt-12 flex flex-col items-center px-5 text-center">
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border-4 border-[#111b21] bg-white">
            {photoUrl ? <img src={photoUrl} alt="" className="size-full object-cover" /> : <span className="text-2xl font-semibold text-[#54656f]">{initials(name)}</span>}
          </div>
          <p className="mt-3 text-[20px] font-medium text-[#e9edef]">{name || 'Your business'}</p>
          {phone && <p className="text-[14px] text-[#8696a0]">{phone}</p>}
          {about && <p className="mt-1 text-[13px] text-[#8696a0]">{about}</p>}
          <div className="mt-4 flex gap-3">
            {[
              { icon: <Phone className="size-4" />, label: 'Voice' },
              ...(catalogVisible ? [{ icon: <Store className="size-4" />, label: 'Catalogue' }] : []),
              { icon: <Share2 className="size-4" />, label: 'Share' },
            ].map((b) => (
              <span key={b.label} className="flex w-[74px] flex-col items-center gap-1.5 rounded-2xl bg-[#202c33] py-2.5 text-[12px] text-[#e9edef]">
                <span className="text-[#25d366]">{b.icon}</span>
                {b.label}
              </span>
            ))}
          </div>
        </div>
        {catalogVisible && (
          <div className="mt-4 px-5">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] text-[#8696a0]">
              <LayoutGrid className="size-3.5" /> Products — from your catalogue
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="aspect-square rounded-lg bg-[#202c33]" />
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 divide-y divide-[#222d34] border-t border-[#222d34]">
          {row(<Clock3 className="size-4" />, <span className="text-[#8696a0]">Business hours — set in the WhatsApp Business app</span>)}
          {category && row(<Tag className="size-4" />, category)}
          {description && row(<Store className="size-4" />, description)}
          {address && row(<MapPin className="size-4" />, address, true)}
          {email && row(<Mail className="size-4" />, email, true)}
          {websites.filter(Boolean).map((w) => (
            <div key={w}>{row(<Globe className="size-4" />, w, true)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
