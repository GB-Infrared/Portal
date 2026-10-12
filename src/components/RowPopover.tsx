import { useEffect, useRef, type RefObject } from 'react';

/* THE ROW, IN FULL. Hover a row and the whole of it is lifted out beside the
   pointer, so a table wider than the screen does not have to be read in two
   swipes. Labels are taken from the table's OWN header each time it opens -
   including a two-deck device/variable header, where a column is named by both
   decks - so a table that re-renders its columns can never mislabel a value.

   Rendered inside the page (not on <body>) so the page's stylesheet, which is
   scoped to its wrapper, still reaches it. */

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
      if (cells.length < 2) return false;             /* the "nothing here" row */
      const labels = headerLabels(table);
      let body = '';
      cells.forEach((td, i) => {
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
      let x = e.clientX + 20, y = e.clientY + 18;
      if (x + w > window.innerWidth - 10) x = e.clientX - w - 20;
      if (y + h > window.innerHeight - 10) y = Math.max(10, e.clientY - h - 14);
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
