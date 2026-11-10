import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A light emoji picker (no extra library): the emojis people actually use in
 * travel chats, in a few tabs. Closes on Esc or a click outside it.
 */
const GROUPS: { label: string; icon: string; emojis: string }[] = [
  {
    label: 'Smileys',
    icon: '😀',
    emojis:
      '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😋 😛 😜 🤪 😝 🤗 🤩 🥳 😎 🤓 🧐 🤔 🤭 🤫 😏 😶 😐 😑 😬 🙄 😯 😮 😲 🥱 😴 😪 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤒 🤕 🤢 🤧 😷 🥴 😵 🤐',
  },
  {
    label: 'Gestures',
    icon: '👍',
    emojis:
      '👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 👋 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🙋 🙆 🙅 🤷 🤦 💁 🙇 👨‍👩‍👧 👨‍👩‍👧‍👦 👫 💑 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵',
  },
  {
    label: 'Travel',
    icon: '✈️',
    emojis:
      '✈️ 🛫 🛬 🧳 🎒 🛂 🎫 🚗 🚕 🚙 🚌 🚐 🚆 🚄 🚢 ⛴️ 🚤 🚁 🏍️ 🛺 🏨 🏖️ 🏝️ 🏔️ ⛰️ 🏕️ 🏞️ 🗺️ 🧭 🌍 🌏 🌎 🗽 🕌 🛕 ⛩️ 🏰 🏯 🗼 🌅 🌄 🌇 🌊 ☀️ 🌤️ ⛅ 🌧️ ❄️ ☃️ 🌈 🎢 🎡 📸 🏄 🏊 🧗 🚴 🥾 ⛺',
  },
  {
    label: 'Food',
    icon: '🍕',
    emojis: '🍳 🥐 🥞 ☕ 🍵 🧃 🥤 🍹 🍸 🍷 🍺 🥂 🍕 🍔 🍟 🌮 🥗 🍛 🍜 🍝 🍣 🍱 🥟 🍗 🍖 🍰 🎂 🧁 🍦 🍫 🍩 🍪 🍎 🍌 🍉 🍇 🍓 🥭 🍍 🥥',
  },
  {
    label: 'Symbols',
    icon: '❤️',
    emojis:
      '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❣️ 💕 💖 💯 ✅ ☑️ ❌ ⭐ 🌟 ✨ 🔥 🎉 🎊 🎁 🎈 💐 🌹 🌸 📍 📌 📞 📅 🗓️ ⏰ ⏳ 💰 💵 💳 🧾 📄 📎 🔔 📣 ⚠️ ❓ ❗ ➡️ ⬅️ 🔝 🆗 🆕',
  },
];

export function EmojiPicker({ onPick, onClose, className }: { onPick: (emoji: string) => void; onClose: () => void; className?: string }) {
  const [tab, setTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="dialog" aria-label="Emoji" className={cn('w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-card shadow-pop', className)}>
      <div className="flex border-b border-border">
        {GROUPS.map((g, i) => (
          <button
            key={g.label}
            type="button"
            title={g.label}
            aria-label={g.label}
            onClick={() => setTab(i)}
            className={cn('flex-1 py-2 text-lg transition-colors', tab === i ? 'border-b-2 border-[#00a884] bg-muted/50' : 'opacity-70 hover:bg-muted/40 hover:opacity-100')}
          >
            {g.icon}
          </button>
        ))}
      </div>
      <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{GROUPS[tab].label}</p>
      <div className="grid h-56 grid-cols-8 content-start gap-0.5 overflow-y-auto p-2">
        {GROUPS[tab].emojis.split(' ').map((e) => (
          <button
            key={e}
            type="button"
            // Keep the cursor in the message box.
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => onPick(e)}
            className="flex aspect-square items-center justify-center rounded-md text-[22px] leading-none transition-transform hover:scale-110 hover:bg-muted"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
