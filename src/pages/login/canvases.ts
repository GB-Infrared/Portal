import { STAR_B64 } from '../../assets/starCatalog';

const D2R = Math.PI / 180;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function gmstDeg(when = Date.now()): number {
  const d = when / 86400000 + 2440587.5 - 2451545.0;
  return ((((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24) * 15;
}

export const CBIN = [[155, 176, 255], [192, 208, 255], [228, 233, 255], [255, 246, 237], [255, 223, 182], [255, 197, 142], [255, 159, 107]];
const ciBin = (ci: number) => ci < 0.00 ? 0 : ci < 0.20 ? 1 : ci < 0.42 ? 2 : ci < 0.68 ? 3 : ci < 0.98 ? 4 : ci < 1.40 ? 5 : 6;

export interface Star { lng: number; lat: number; mag: number; r: number; a: number; cb: number; ph: number }

let cache: Star[] | null = null;
export function stars(): Star[] {
  if (cache) return cache;
  const g0 = gmstDeg();
  const raw = atob(STAR_B64), out: Star[] = [];
  for (let i = 0; i + 5 < raw.length; i += 6) {
    const ra = ((raw.charCodeAt(i) << 8 | raw.charCodeAt(i + 1)) / 65535) * 360;
    const dec = ((raw.charCodeAt(i + 2) << 8 | raw.charCodeAt(i + 3)) / 65535) * 180 - 90;
    const mag = (raw.charCodeAt(i + 4) / 255) * 9 - 2;
    const ci = (raw.charCodeAt(i + 5) / 255) * 3 - 0.5;
    const f = Math.pow(2.512, (6.5 - mag) / 2.6) / Math.pow(2.512, 8 / 2.6);
    out.push({ lng: ((ra - g0) % 360 + 540) % 360 - 180, lat: dec, mag,
      r: 0.30 + Math.pow(f, 0.55) * 2.60, a: 0.10 + Math.pow(f, 0.62) * 0.90, cb: ciBin(ci), ph: (i * 0.7548) % 6.283 });
  }
  cache = out;
  return out;
}

export function startSky(sky: HTMLCanvasElement): () => void {
  const ox = sky.getContext('2d'); if (!ox) return () => {};
  const ST = stars();
  const ABIN = 5;
  const batches = (() => {
    const b: Record<number, { rgb: number[]; lvl: number; list: Star[] }> = {};
    ST.forEach(s => {
      const ai = Math.max(0, Math.min(ABIN - 1, Math.round((s.a - 0.26) / 0.74 * (ABIN - 1))));
      const k = s.cb * ABIN + ai;
      if (!b[k]) b[k] = { rgb: CBIN[s.cb], lvl: (ai + 1) / ABIN, list: [] };
      b[k].list.push(s);
    });
    return Object.values(b);
  })();
  const bright = ST.filter(s => s.mag < 2.6);
  const LAM = 18, PHI = 16, cosP = Math.cos(PHI * D2R), sinP = Math.sin(PHI * D2R);
  let W = 0, H = 0, CX = 0, CY = 0, SKYK = 540;
  const skyXY = (lng: number, lat: number): [number, number] | null => {
    const la = lat * D2R, dl = (lng - LAM) * D2R;
    const cl = Math.cos(la), sl = Math.sin(la), cd = Math.cos(dl);
    const x = cl * Math.sin(dl), y = cosP * sl - sinP * cl * cd, z = sinP * sl + cosP * cl * cd;
    const b = Math.acos(Math.max(-1, Math.min(1, -z)));
    if (b > 1.62) return null;
    const t = Math.hypot(x, y);
    if (t < 1e-6) return [CX, CY];
    const r = SKYK * b;
    return [CX + (x / t) * r, CY - (y / t) * r];
  };
  const buf = document.createElement('canvas'), bx = buf.getContext('2d');
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    sky.width = Math.round(W * dpr); sky.height = Math.round(H * dpr);
    sky.style.width = W + 'px'; sky.style.height = H + 'px';
    ox.setTransform(dpr, 0, 0, dpr, 0, 0);
    buf.width = sky.width; buf.height = sky.height;
    bx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    CX = W / 2; CY = H / 2; SKYK = Math.hypot(W / 2, H / 2) / (Math.PI / 2);
    if (!bx) return;
    bx.clearRect(0, 0, W, H);
    batches.forEach(bk => {
      const c = bk.rgb;
      bx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (bk.lvl * 0.92).toFixed(3) + ')';
      bx.beginPath();
      for (const s of bk.list) { const p = skyXY(s.lng, s.lat); if (!p) continue; bx.moveTo(p[0] + s.r, p[1]); bx.arc(p[0], p[1], s.r, 0, 6.283185); }
      bx.fill();
    });
  };
  const draw = (now: number) => {
    ox.clearRect(0, 0, W, H);
    const tw = reduced() ? 0 : now / 1000;
    ox.drawImage(buf, 0, 0, W, H);
    bright.forEach(st => {
      const p = skyXY(st.lng, st.lat); if (!p) return;
      const c = CBIN[st.cb], fl = reduced() ? 1 : 0.80 + 0.20 * Math.sin(tw * 1.5 + st.ph);
      const g = ox.createRadialGradient(p[0], p[1], 0, p[0], p[1], st.r * 4.6);
      g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.50 * fl).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      ox.fillStyle = g; ox.beginPath(); ox.arc(p[0], p[1], st.r * 4.6, 0, 6.283185); ox.fill();
    });
  };
  addEventListener('resize', size);
  size();
  let raf = 0, last = 0;
  const frame = (now: number) => { if (!document.hidden && now - last > 50) { last = now; draw(now); } raf = requestAnimationFrame(frame); };
  if (reduced()) draw(0); else raf = requestAnimationFrame(frame);
  return () => { removeEventListener('resize', size); cancelAnimationFrame(raf); };
}

export function startLimb(cv: HTMLCanvasElement, sunHost: HTMLElement): { fly: (t: number) => void; stop: () => void } {
  const lx = cv.getContext('2d'); if (!lx) return { fly: () => {}, stop: () => {} };
  let W = 0, H = 0, flyT = 0;
  let GROUND: CanvasGradient | null = null, AIR: CanvasGradient | null = null;
  const sunX = () => {
    const v = getComputedStyle(sunHost).getPropertyValue('--sun-x').trim(), n = parseFloat(v);
    if (!Number.isFinite(n)) return 0.78;
    return v.includes('%') ? n / 100 : n / innerWidth;
  };
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    lx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = sunX(), at = (t: number) => Math.max(0, Math.min(1, t));
    const g = lx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#010206'); g.addColorStop(at(sx - 0.62), '#02040b'); g.addColorStop(at(sx - 0.34), '#040c18');
    g.addColorStop(at(sx - 0.12), '#0a1c30'); g.addColorStop(at(sx + 0.06), '#102a44'); g.addColorStop(1, '#153650');
    GROUND = g;
    const air = lx.createLinearGradient(0, 0, W, 0);
    air.addColorStop(0, 'rgba(96,140,206,0)'); air.addColorStop(at(sx - 0.66), 'rgba(104,150,214,.10)');
    air.addColorStop(at(sx - 0.38), 'rgba(126,172,232,.34)'); air.addColorStop(at(sx - 0.14), 'rgba(164,204,248,.72)');
    air.addColorStop(at(sx + 0.04), 'rgba(214,231,255,.96)'); air.addColorStop(1, 'rgba(255,236,196,.90)');
    AIR = air;
  };
  const draw = () => {
    if (!GROUND || !AIR) return;
    lx.clearRect(0, 0, W, H);
    const R = Math.max(W * 1.85, H * 2.2) * (1 - 0.42 * flyT);
    const base = Math.max(58, Math.min(H * 0.27, 230));
    const rise = base + (H * 0.52 - base) * flyT;
    const cx = W * 0.5, cy = H - rise + R, sx = sunX();
    lx.beginPath(); lx.arc(cx, cy, R, 0, 6.283185); lx.closePath(); lx.fillStyle = GROUND; lx.fill();
    lx.save();
    lx.beginPath(); lx.arc(cx, cy, R, 0, 6.283185); lx.clip();
    const wy = H - rise * 0.35;
    const wg = lx.createRadialGradient(W * sx, wy, 0, W * sx, wy, Math.max(W * 0.30, 220));
    wg.addColorStop(0, 'rgba(255,206,140,.26)'); wg.addColorStop(0.40, 'rgba(232,166,80,.09)'); wg.addColorStop(1, 'rgba(226,160,74,0)');
    lx.fillStyle = wg; lx.fillRect(0, H - rise - 40, W, rise + 40);
    lx.restore();
    lx.lineCap = 'butt';
    for (let i = 7; i >= 1; i--) {
      lx.beginPath(); lx.arc(cx, cy, R + i * 3.6, Math.PI, 6.283185);
      lx.lineWidth = i * 5.2; lx.globalAlpha = 0.085 / Math.pow(i, 0.86); lx.strokeStyle = AIR; lx.stroke();
    }
    lx.globalAlpha = 1;
    lx.beginPath(); lx.arc(cx, cy, R + 0.6, Math.PI, 6.283185); lx.lineWidth = 1.5; lx.strokeStyle = AIR; lx.stroke();
  };
  const paint = () => { size(); draw(); };
  addEventListener('resize', paint);
  paint();
  return {
    fly: (t: number) => { t = Math.max(0, Math.min(1, t)); if (t <= flyT) return; flyT = t; draw(); },
    stop: () => removeEventListener('resize', paint),
  };
}
