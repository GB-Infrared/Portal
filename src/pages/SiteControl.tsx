import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api/portal';
import type { PortfolioToday, Site } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useSite } from '../auth/SiteContext';
import { Failed, Waiting } from '../components/DataState';
import { useApi } from '../hooks/useApi';
import { toDate } from '../lib/format';
import { startGlobe, type GlobePortfolio, type GlobeSite } from './siteControl/engine';
import '../styles/pages/plants.css';

const REFRESH_MS = 5 * 60 * 1000;

function toGlobe(s: Site): GlobeSite {
  return {
    siteId: s.id, id: s.name, addr: s.address ?? '', lat: s.lat as number, lng: s.lng as number,
    ac: s.acCapacityKw ?? 0, dc: s.dcCapacityKw, dev: s.deviceCount ?? 0, down: s.downCount ?? 0,
    warn: s.warnCount ?? 0, crit: s.critCount ?? 0, kw: s.powerKw, eToday: s.energyTodayKwh,
    peak: s.peakKwToday, state: s.state,
  };
}
const hourOf = (iso: string) => { const d = toDate(iso); return d ? d.getHours() + d.getMinutes() / 60 : NaN; };

export default function SiteControl() {
  const nav = useNavigate();
  const { user, signOut } = useAuth();
  const { setSiteId } = useSite();
  const root = useRef<HTMLDivElement>(null);
  const engine = useRef<{ stop: () => void; refresh: () => void } | null>(null);
  const plants = useRef<GlobeSite[]>([]);
  const portfolio = useRef<GlobePortfolio | null>(null);

  const sites = useApi(s => api.getSites({ signal: s }), [], REFRESH_MS);
  const pf = useApi(s => api.getPortfolioToday({ signal: s }), [], REFRESH_MS);

  useEffect(() => {
    document.documentElement.classList.add('void');
    document.title = 'ENEROPS OS · Site Overview';
    return () => { document.documentElement.classList.remove('void'); document.title = 'ENEROPS OS'; };
  }, []);

  const located = useMemo(() => (sites.data ?? []).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng)), [sites.data]);
  const idsKey = located.map(s => s.id).join('|');

  const setPortfolio = (p: PortfolioToday | null, list: Site[]) => {
    if (!p) { portfolio.current = null; return; }
    const cap = list.reduce((t, s) => t + (s.acCapacityKw ?? 0), 0);
    const hours: number[] = [], kw: (number | null)[] = [];
    p.times.forEach((t, i) => { const h = hourOf(t); if (Number.isFinite(h)) { hours.push(h); kw.push(p.kw[i] ?? null); } });
    portfolio.current = { hours, kw, cap: Math.max(cap, ...kw.map(v => v ?? 0), 1), revenue: p.revenue, co2: p.co2AvoidedKg };
  };

  useEffect(() => {
    const el = root.current;
    if (!located.length || !el) return;
    plants.current = located.map(toGlobe);
    setPortfolio(pf.data, located);
    engine.current = startGlobe({
      root: el,
      sites: plants.current,
      portfolio: () => portfolio.current,
      operator: (user?.email || '').split('@')[0] || 'operator',
      onOpen: id => { setSiteId(id); nav('/home'); },
    });
    return () => {
      engine.current?.stop(); engine.current = null;
      el.querySelectorAll('#rows .rrow, #flist .frow').forEach(n => n.remove());
      const card = el.querySelector('#card'); if (card) { card.innerHTML = ''; card.className = 'card'; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    if (!engine.current) return;
    for (const s of located) {
      const p = plants.current.find(x => x.siteId === s.id);
      if (p) Object.assign(p, toGlobe(s));
    }
    setPortfolio(pf.data, located);
    engine.current.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites.data, pf.data]);

  const exit = async () => { await signOut(); nav('/login'); };

  return (
    <div className="pg-plants" ref={root}>
      <div className="rays" />
      <div className="vignette" />
      <div className="iris" />
      <div className="grain" />
      <div className="corner tl" /><div className="corner br" />

      <header className="hud">
        <div className="mark">
          <img src="/logo/logo-mark.png" alt="EnerOps Data Systems Pvt Ltd" />
          <span><span className="word">ENEROPS OS</span><span className="sub">Site Control</span></span>
        </div>
        <div className="right">
          <div className="cell"><span className="k">Operator</span><span className="v" id="who">—</span></div>
          <div className="cell lc"><span className="k">Local</span><span className="v" id="clk">—</span></div>
          <button className="out" type="button" onClick={exit}>Exit</button>
        </div>
      </header>

      <section className="theatre" id="theatre" aria-label="Portfolio globe. Sites are shown at their real locations on a satellite image of the Earth.">
        <canvas id="earth" aria-hidden="true" />
        <canvas id="atlas" aria-hidden="true" />
        <div className="zoom" role="group" aria-label="Zoom">
          <button className="zbtn" id="zoomOut" type="button" aria-label="Zoom out">−</button>
          <button className="zbtn" id="zoomIn" type="button" aria-label="Zoom in">+</button>
        </div>
      </section>

      <aside className="rail" id="rail" aria-label="Sites in this portfolio">
        <div className="rh"><b>Fleet</b><i id="r-n">—</i></div>
        <div className="rows" id="rows">
          {!sites.data && (sites.error
            ? <Failed error={sites.error} what="your sites" onRetry={sites.reload} />
            : <Waiting what="Loading sites" />)}
          {sites.data && !located.length && (
            <div className="dstate"><span className="t">No sites to place</span>
              <span className="s">{sites.data.length ? 'None of your sites has coordinates yet.' : 'This account has no sites.'}</span></div>
          )}
        </div>
      </aside>

      <div className="card" id="card" aria-live="polite" aria-label="Site detail" />

      <aside className="sumx" id="sumx" aria-label="Portfolio total">
        <div className="xh"><b>Portfolio · <span id="x-n">0</span> sites</b><span className="live" aria-hidden="true" /></div>
        <div className="big"><b id="x-kw">—</b><i id="x-u">kW</i></div>
        <div className="of"><em id="x-pc">—</em> of <em id="x-ac">—</em> nameplate</div>
        <svg className="curve" id="x-curve" viewBox="0 0 262 64" preserveAspectRatio="none" aria-hidden="true" />
        <div className="tt"><span>05:30</span><em id="x-now">—</em><span>18:30</span></div>
        <div className="xg">
          <div className="c"><i>DEVICES</i><b id="x-dev">—</b></div>
          <div className="c"><i>DAILY ENERGY</i><b className="gd" id="x-e">—</b></div>
          <div className="c"><i>REVENUE</i><b className="gd" id="x-rev">—</b></div>
          <div className="c"><i>CO₂ AVOIDED</i><b className="em" id="x-co2">—</b></div>
        </div>
      </aside>

      <div className="fallback"><div className="flist" id="flist" /></div>
    </div>
  );
}
