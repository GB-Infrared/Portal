/* How the portal writes numbers and times, in one place - so "—" for a missing
   value, ungrouped digits, and the 12- and 24-hour clocks read the same on
   every screen. */

export const DASH = '—';

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const pad = (n: number) => String(n).padStart(2, '0');

/** A figure to d places, or a dash when there is none. Ungrouped digits: no
 *  thousands separator, so the number reads as one solid run. */
export function fx(v: number | null | undefined, d = 1): string {
  return v === null || v === undefined || !Number.isFinite(v) ? DASH : v.toFixed(d);
}

export function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 12:10 PM, or 12:10:03 PM with seconds */
export function time12(d: Date | null, withSeconds = false): string {
  if (!d) return DASH;
  const h = d.getHours(), ap = h < 12 ? 'AM' : 'PM';
  return (h % 12 || 12) + ':' + pad(d.getMinutes()) + (withSeconds ? ':' + pad(d.getSeconds()) : '') + ' ' + ap;
}

/** "6AM" - an hour on a chart axis */
export function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  return (hh % 12 || 12) + (hh < 12 ? 'AM' : 'PM');
}

/** 27.07.2026 23:57:43 - the date first, the clock in 24 hours: a log is read by
 *  scanning for the row where the day changes, and a 12-hour clock hides that. */
export function dt24(d: Date | null): string {
  if (!d) return DASH;
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

/** 27 Jul 2026 */
export function dayMonYear(d: Date | null): string {
  return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : DASH;
}

/** YYYY-MM-DD in local time */
export function isoDay(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function parseIsoDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

export const daysInMonth = (y: number, m1: number) => new Date(y, m1, 0).getDate();
