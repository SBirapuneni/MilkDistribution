export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- Dates ------------------------------------------------------------
// All dates are 'yyyy-MM-dd' strings in the device's local timezone. Don't
// use toISOString() for this: it's UTC, so in India anything before 5:30 AM
// — i.e. morning dispatch — would land on the previous day.

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, n: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

export function daysAgoStr(n: number): string {
  return addDays(localDateStr(), -n);
}

/** Inclusive number of days from `from` to `to`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000) + 1;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-09-27' → '27 Sep' (or '27 Sep 2026' with withYear). */
export function shortDate(date: string, withYear = false): string {
  const [y, m, d] = String(date).split('-').map(Number);
  if (!y || !m || !d) return String(date);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

// ---- Numbers ----------------------------------------------------------

const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function signed(v: number, body: string): string {
  return v < 0 ? `−${body}` : body;
}

/** Exact amount, Indian digit grouping: ₹15,69,284 or ₹52.50. Blank → '—'. */
export function money(n: number | string | '' | null | undefined): string {
  if (n === '' || n === null || n === undefined) return '—';
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const abs = Math.abs(v);
  return signed(v, `₹${Number.isInteger(abs) ? inr0.format(abs) : inr2.format(abs)}`);
}

/** Rounded to the rupee — for totals and summaries where paise are noise. */
export function moneyRound(n: number): string {
  const v = Math.round(Number(n) || 0);
  return signed(v, `₹${inr0.format(Math.abs(v))}`);
}

/** Short form for chart axes: ₹950, ₹12K, ₹1.5L, ₹2.3Cr. */
export function moneyCompact(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number, unit: string) => `₹${Number(v.toFixed(v < 10 ? 1 : 0))}${unit}`;
  let body: string;
  if (abs >= 1e7) body = fmt(abs / 1e7, 'Cr');
  else if (abs >= 1e5) body = fmt(abs / 1e5, 'L');
  else if (abs >= 1e3) body = fmt(abs / 1e3, 'K');
  else body = `₹${Math.round(abs)}`;
  return signed(n, body);
}

export function percent(fraction: number): string {
  const p = fraction * 100;
  return `${p !== 0 && Math.abs(p) < 10 ? p.toFixed(1) : Math.round(p)}%`;
}
