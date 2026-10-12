/* A real file, not a toast, so an export can actually be checked.

   A leading BOM: without it Excel reads the file in the system codepage and
   any non-ASCII in a device name comes out as mojibake. Cells are quoted only
   when they need it. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const q = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = rows.map(r => r.map(q).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
