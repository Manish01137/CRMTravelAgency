import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Minimal RFC4180-ish CSV parser (no dependency) — handles quoted fields,
 * commas/newlines inside quotes, and escaped `""` quotes. Good enough for
 * real-world exports from Excel/Google Sheets/most CRMs.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // swallow — \n (below) ends the row
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-blank rows (common trailing newline, or blank lines mid-file).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

type FieldKey = 'name' | 'phone' | 'email' | 'destination' | 'notes' | 'travelDate' | 'travelerCount' | 'budgetAmount';

const IMPORTABLE_FIELDS: { key: FieldKey; label: string; required?: boolean; aliases: string[] }[] = [
  { key: 'name', label: 'Name', required: true, aliases: ['name', 'full name', 'lead name', 'customer name', 'customer'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'phone number', 'mobile', 'mobile number', 'contact', 'contact number', 'whatsapp', 'whatsapp number'] },
  { key: 'email', label: 'Email', aliases: ['email', 'email address', 'e-mail'] },
  { key: 'destination', label: 'Destination', aliases: ['destination', 'location', 'place', 'city'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'remark', 'remarks', 'comment', 'comments', 'message'] },
  { key: 'travelDate', label: 'Travel date', aliases: ['travel date', 'traveldate', 'date', 'departure date', 'travel_date'] },
  { key: 'travelerCount', label: 'Traveler count', aliases: ['travelers', 'traveler count', 'pax', 'no of travelers', 'number of travelers', 'travellers', 'no. of pax'] },
  { key: 'budgetAmount', label: 'Budget', aliases: ['budget', 'budget amount', 'price'] },
];

const IGNORE = '__ignore';

/** Loose match: strips punctuation/case so "Phone Number", "phone_number" and "Phone" all hit the same alias. */
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function guessMapping(headers: string[]): Record<number, FieldKey | null> {
  const used = new Set<FieldKey>();
  const mapping: Record<number, FieldKey | null> = {};
  headers.forEach((header, i) => {
    const norm = normalizeHeader(header);
    const match = IMPORTABLE_FIELDS.find((f) => !used.has(f.key) && f.aliases.some((a) => normalizeHeader(a) === norm));
    if (match) {
      used.add(match.key);
      mapping[i] = match.key;
    } else {
      mapping[i] = null;
    }
  });
  return mapping;
}

interface BulkImportResult {
  created: number;
  failed: { row: number; error: string }[];
}

export function LeadImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'map' | 'result'>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, FieldKey | null>>({});
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const reset = () => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setDataRows([]);
    setMapping({});
    setResult(null);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      toast.error('That file has no data rows — just a header, or it\'s empty');
      return;
    }
    const [headerRow, ...rows] = parsed;
    setFileName(file.name);
    setHeaders(headerRow);
    setDataRows(rows.slice(0, 500)); // matches the backend's 500-row cap per import
    setMapping(guessMapping(headerRow));
    setStep('map');
  };

  const mappedField = (key: FieldKey): number | null => {
    const entry = Object.entries(mapping).find(([, v]) => v === key);
    return entry ? Number(entry[0]) : null;
  };

  const nameColumnMapped = mappedField('name') !== null;

  /** Turns one raw CSV row into a lead-shaped object using the current column mapping. */
  const buildLeadRow = (row: string[]): Record<string, unknown> => {
    const out: Record<string, unknown> = { source: 'MANUAL' };
    for (const field of IMPORTABLE_FIELDS) {
      const colIndex = mappedField(field.key);
      if (colIndex === null) continue;
      const raw = row[colIndex]?.trim();
      if (!raw) continue;
      if (field.key === 'travelerCount' || field.key === 'budgetAmount') {
        const n = Number(raw.replace(/[^0-9.]/g, ''));
        if (Number.isFinite(n)) out[field.key] = n;
      } else {
        out[field.key] = raw;
      }
    }
    return out;
  };

  const importMutation = useMutation({
    mutationFn: () => api.post<BulkImportResult>('/leads/bulk-import', { leads: dataRows.map(buildLeadRow) }),
    onSuccess: (res) => {
      setResult(res);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Import failed — please try again'),
  });

  const previewRows = useMemo(() => dataRows.slice(0, 5), [dataRows]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4" /> Import leads from CSV
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV export from Excel, Google Sheets, or another CRM — you\'ll match its columns to lead fields next.'}
            {step === 'map' && `${fileName} — ${dataRows.length} row${dataRows.length === 1 ? '' : 's'} found. Match each column below, then review the preview.`}
            {step === 'result' && 'Import finished.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-surface transition-colors hover:border-primary/60"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="size-5" />
              </span>
              <span className="text-sm font-semibold text-foreground">Choose a CSV file</span>
              <span className="text-xs text-muted-foreground">First row must be column headers — e.g. Name, Phone, Email</span>
            </button>
          </div>
        )}

        {step === 'map' && (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Match your columns</p>
              <div className="space-y-1.5 rounded-lg border border-border p-2">
                {headers.map((header, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md p-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={header}>
                      {header || <span className="italic text-muted-foreground">(blank column)</span>}
                    </span>
                    <Select
                      value={mapping[i] ?? IGNORE}
                      onValueChange={(v) => setMapping((prev) => ({ ...prev, [i]: v === IGNORE ? null : (v as FieldKey) }))}
                    >
                      <SelectTrigger className="h-8 w-44 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IGNORE}>Ignore this column</SelectItem>
                        {IMPORTABLE_FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                            {f.required ? ' *' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {!nameColumnMapped && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="size-3.5" /> Map a column to Name — rows without one will be skipped.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Preview (first {previewRows.length} of {dataRows.length} rows)</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-left text-muted-foreground">
                    <tr>
                      {IMPORTABLE_FIELDS.filter((f) => mappedField(f.key) !== null).map((f) => (
                        <th key={f.key} className="whitespace-nowrap px-2.5 py-1.5 font-medium">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {IMPORTABLE_FIELDS.filter((f) => mappedField(f.key) !== null).map((f) => {
                          const colIndex = mappedField(f.key)!;
                          return (
                            <td key={f.key} className="max-w-[160px] truncate px-2.5 py-1.5 text-foreground">
                              {row[colIndex] || <span className="text-muted-foreground">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <CheckCircle2 className="size-4 shrink-0" /> {result.created} lead{result.created === 1 ? '' : 's'} imported successfully.
            </div>
            {result.failed.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
                  <AlertTriangle className="size-4" /> {result.failed.length} row{result.failed.length === 1 ? '' : 's'} skipped
                </p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-xs text-muted-foreground">
                  {result.failed.map((f) => (
                    <p key={f.row}>Row {f.row}: {f.error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'map' && (
            <Button onClick={() => importMutation.mutate()} disabled={!nameColumnMapped || importMutation.isPending}>
              {importMutation.isPending && <Spinner className="size-4" />} Import {dataRows.length} lead{dataRows.length === 1 ? '' : 's'}
            </Button>
          )}
          {step === 'result' && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
