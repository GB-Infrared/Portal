import { useEffect, useRef, type RefObject } from 'react';
import { cssX, cssY, viewH, viewW } from '../lib/screen';

function headerLabels(table: HTMLTableElement): string[] {
  const head = table.tHead; if (!head) return [];
  const grid: string[][] = [];
  Array.from(head.rows).forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    Array.from(tr.cells).forEach(cell => {
      while (grid[r][c] !== undefined) c++;
      const rs = cell.rowSpan || 1, cs = cell.colSpan || 1;
      const txt = (cell.textContent || '').replace(/[▲▼]/g, '').trim();
      for (let i = 0; i < rs; i++) { grid[r + i] = grid[r + i] || []; for (let j = 0; j < cs; j++) grid[r + i][c + j] = txt; }
      c += cs;
    });
  });
  const n = grid.reduce((m, g) => Math.max(m, g.length), 0), out: string[] = [];
  for (let c = 0; c < n; c++) {
    const parts: string[] = [];
    for (let r = 0; r < grid.length; r++) { const t = (grid[r] || [])[c]; if (t && parts[parts.length - 1] !== t) parts.push(t); }
    out.push(parts.join(' · '));
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function RowPopover({ tableRef }: { tableRef: RefObject<HTMLTableElement | null> }) {
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const table = tableRef.current, el = pop.current;
    const tbody = table?.tBodies[0];
    if (!table || !tbody || !el) return;
    let row: HTMLTableRowElement | null = null;
    const hide = () => { el.classList.remove('on'); row = null; };
    const fill = (tr: HTMLTableRowElement) => {
      const cells = Array.from(tr.cells);
      if (cells.length < 2) return false;
      const labels = headerLabels(table);
      let body = '';
      cells.forEach((td, i) => {
        if (td.classList.contains('act')) return;
        const v = (td.textContent || '').trim();
        body += '<span class="rp-k">' + esc(labels[i] || 'Column ' + (i + 1)) + '</span>' +
          '<span class="rp-v' + (v === '—' || v === '' ? ' nil' : '') + '">' + esc(v || '—') + '</span>';
      });
      el.innerHTML = '<div class="rp-h">' + esc((cells[0].textContent || '').trim()) + '</div>' +
        '<div class="rp-g' + (cells.length > 9 ? ' two' : '') + '">' + body + '</div>';
      return true;
    };
    const place = (e: MouseEvent) => {
      const w = el.offsetWidth, h = el.offsetHeight;
      let x = cssX(e) + 20, y = cssY(e) + 18;
      if (x + w > viewW() - 10) x = cssX(e) - w - 20;
      if (y + h > viewH() - 10) y = Math.max(10, cssY(e) - h - 14);
      el.style.left = x + 'px'; el.style.top = y + 'px';
    };
    const move = (e: MouseEvent) => {
      const tr = (e.target as Element).closest?.('tr') as HTMLTableRowElement | null;
      if (!tr || !tbody.contains(tr) || tr.classList.contains('dh')) { hide(); return; }
      if (tr !== row) { if (!fill(tr)) { hide(); return; } row = tr; el.classList.add('on'); }
      place(e);
    };
    tbody.addEventListener('mousemove', move);
    tbody.addEventListener('mouseleave', hide);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      tbody.removeEventListener('mousemove', move);
      tbody.removeEventListener('mouseleave', hide);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [tableRef]);
  return <div className="rowpop" ref={pop} />;
}
