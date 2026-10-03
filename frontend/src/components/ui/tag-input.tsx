import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A list of short values as removable chips. Enter, comma or Tab (and paste
 * of a comma/newline list) adds; Backspace on an empty box removes the last.
 * `validate` returns an error message to reject a value.
 */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  max = 30,
  maxLength = 60,
  validate,
  inputMode,
  className,
}: {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  validate?: (v: string) => string | null;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  className?: string;
}) {
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const add = (raw: string) => {
    const items = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) return true;
    const next = [...value];
    for (const item of items) {
      const problem = validate?.(item) ?? null;
      if (problem) {
        setError(problem);
        return false;
      }
      if (next.length >= max) {
        setError(`Up to ${max}`);
        return false;
      }
      if (!next.some((v) => v.toLowerCase() === item.toLowerCase())) next.push(item.slice(0, maxLength));
    }
    onChange(next);
    setError(null);
    return true;
  };

  return (
    <div className={className}>
      <div
        className={cn(
          'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-sm',
          'focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15',
          error && 'border-destructive',
        )}
      >
        {value.map((v) => (
          <span key={v} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary">
            <span className="truncate">{v}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="rounded-full p-0.5 hover:bg-primary/15"
              aria-label={`Remove ${v}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && draft.trim())) && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (add(draft)) setDraft('');
            } else if (e.key === 'Backspace' && !draft && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim() && add(draft)) setDraft('');
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (/[,\n]/.test(text)) {
              e.preventDefault();
              add(text);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
