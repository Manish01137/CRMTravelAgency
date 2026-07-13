import type { BillCategory, BillStatus, BookingStatus, InvoiceStatus, TaskType } from '@/types';

export interface StatusStyle {
  label: string;
  pill: string;
  dot: string;
  solid: string;
}

export const BOOKING_STATUS_STYLES: Record<BookingStatus, StatusStyle> = {
  PENDING: {
    label: 'Pending',
    pill: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    solid: 'text-white bg-amber-500 hover:bg-amber-600',
  },
  CONFIRMED: {
    label: 'Confirmed',
    pill: 'bg-blue-50 text-blue-700 ring-blue-200',
    dot: 'bg-blue-500',
    solid: 'text-white bg-blue-500 hover:bg-blue-600',
  },
  ONGOING: {
    label: 'Ongoing',
    pill: 'bg-violet-50 text-violet-700 ring-violet-200',
    dot: 'bg-violet-500',
    solid: 'text-white bg-violet-500 hover:bg-violet-600',
  },
  COMPLETED: {
    label: 'Completed',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
    solid: 'text-white bg-emerald-600 hover:bg-emerald-700',
  },
  CANCELLED: {
    label: 'Cancelled',
    pill: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
    solid: 'text-white bg-slate-500 hover:bg-slate-600',
  },
};

export const BOOKING_STATUSES = (Object.keys(BOOKING_STATUS_STYLES) as BookingStatus[]).map(
  (value) => ({ value, label: BOOKING_STATUS_STYLES[value].label }),
);

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, StatusStyle> = {
  DRAFT: {
    label: 'Draft',
    pill: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
    solid: 'text-white bg-slate-500 hover:bg-slate-600',
  },
  SENT: {
    label: 'Sent',
    pill: 'bg-blue-50 text-blue-700 ring-blue-200',
    dot: 'bg-blue-500',
    solid: 'text-white bg-blue-500 hover:bg-blue-600',
  },
  PAID: {
    label: 'Paid',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
    solid: 'text-white bg-emerald-600 hover:bg-emerald-700',
  },
  OVERDUE: {
    label: 'Overdue',
    pill: 'bg-red-50 text-red-600 ring-red-200',
    dot: 'bg-red-500',
    solid: 'text-white bg-red-500 hover:bg-red-600',
  },
  CANCELLED: {
    label: 'Cancelled',
    pill: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
    solid: 'text-white bg-slate-500 hover:bg-slate-600',
  },
};

export const INVOICE_STATUSES = (Object.keys(INVOICE_STATUS_STYLES) as InvoiceStatus[]).map(
  (value) => ({ value, label: INVOICE_STATUS_STYLES[value].label }),
);

export const TASK_TYPE_META: Record<TaskType, { label: string; pill: string }> = {
  FOLLOW_UP: { label: 'Follow-up', pill: 'bg-violet-50 text-violet-700 ring-violet-200' },
  CALL: { label: 'Call', pill: 'bg-blue-50 text-blue-700 ring-blue-200' },
  MEETING: { label: 'Meeting', pill: 'bg-amber-50 text-amber-700 ring-amber-200' },
  OTHER: { label: 'Other', pill: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

export const TASK_TYPES = (Object.keys(TASK_TYPE_META) as TaskType[]).map((value) => ({
  value,
  label: TASK_TYPE_META[value].label,
}));

export const BILL_CATEGORY_META: Record<BillCategory, { label: string; pill: string }> = {
  HOTEL: { label: 'Hotel', pill: 'bg-violet-50 text-violet-700 ring-violet-200' },
  FLIGHT: { label: 'Flight', pill: 'bg-sky-50 text-sky-700 ring-sky-200' },
  TRANSPORT: { label: 'Transport', pill: 'bg-amber-50 text-amber-700 ring-amber-200' },
  ACTIVITY: { label: 'Activity', pill: 'bg-pink-50 text-pink-700 ring-pink-200' },
  VISA: { label: 'Visa', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  FOOD: { label: 'Food', pill: 'bg-orange-50 text-orange-700 ring-orange-200' },
  OTHER: { label: 'Other', pill: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

export const BILL_CATEGORIES = (Object.keys(BILL_CATEGORY_META) as BillCategory[]).map((value) => ({
  value,
  label: BILL_CATEGORY_META[value].label,
}));

export const BILL_STATUS_META: Record<BillStatus, { label: string; pill: string }> = {
  UNPAID: { label: 'Unpaid', pill: 'bg-amber-50 text-amber-700 ring-amber-200' },
  PAID: { label: 'Paid', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

export function bookingRef(n: number): string {
  return `BK-${String(n).padStart(4, '0')}`;
}

export function invoiceRef(n: number): string {
  return `INV-${String(n).padStart(4, '0')}`;
}
