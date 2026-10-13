import { SingleSelect } from './Select';

const PER_OPTS = ['25', '50', '75', '100', '150', '200'].map(v => ({ v, t: v }));

export function TableFooter({ per, onPer, from, shown, total, onPage }: {
  per: number; onPer: (n: number) => void; from: number; shown: number; total: number; onPage: (d: -1 | 1) => void;
}) {
  return (
    <div className="tfoot">
      <span>Rows per page</span>
      <SingleSelect className="psel" head="Rows per page" title="How many rows this table shows at a time"
                    value={String(per)} options={PER_OPTS} onChange={v => onPer(Number(v))} />
      <span className="sp" />
      <span className="range">{total ? `${from + 1}–${from + shown} of ${total}` : '0–0 of 0'}</span>
      <button className="pgbtn" type="button" disabled={from <= 0} onClick={() => onPage(-1)}>&lsaquo;</button>
      <button className="pgbtn" type="button" disabled={from + shown >= total} onClick={() => onPage(1)}>&rsaquo;</button>
    </div>
  );
}
