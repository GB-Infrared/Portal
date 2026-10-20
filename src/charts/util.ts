export function niceMax(peak: number): { max: number; step: number } {
  const p = Math.max(1, peak) * 1.08;
  const steps = [10, 20, 25, 50, 100, 150, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
  for (const s of steps) {
    const n = Math.ceil(p / s);
    if (n <= 5) return { max: s * n, step: s };
  }
  const s = Math.pow(10, Math.ceil(Math.log10(p / 5)));
  return { max: Math.ceil(p / s) * s, step: s };
}

const FINE = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
export function fineMax(peak: number): { max: number; step: number } {
  const p = (peak > 0 ? peak : 1) * 1.08;
  for (const s of FINE) {
    const n = Math.ceil(p / s);
    if (n <= 6) return { max: s * n, step: s };
  }
  const s = Math.pow(10, Math.ceil(Math.log10(p / 6)));
  return { max: Math.ceil(p / s) * s, step: s };
}

export function niceSteps(max: number, bands: number): { max: number; step: number } {
  const raw = Math.max(max, 1e-9) * 1.05 / bands;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  return { max: step * bands, step };
}

export function stepDecimals(step: number): number {
  const t = step.toFixed(6).replace(/0+$/, '');
  const dot = t.indexOf('.');
  return dot < 0 ? 0 : t.length - dot - 1;
}

export function linePath(xs: number[], ys: (number | null)[], fy: (v: number) => number): string {
  let d = '', pen = false;
  for (let i = 0; i < xs.length; i++) {
    const v = ys[i];
    if (v === null || v === undefined || !Number.isFinite(v)) { pen = false; continue; }
    d += (pen ? 'L' : 'M') + xs[i].toFixed(1) + ' ' + fy(v).toFixed(1) + ' ';
    pen = true;
  }
  return d.trim();
}

export function areaPath(xs: number[], ys: (number | null)[], fy: (v: number) => number, floorY: number): string {
  let d = '', run: number[] = [];
  const flush = () => {
    if (run.length > 1) {
      d += 'M' + xs[run[0]].toFixed(1) + ' ' + floorY.toFixed(1) + ' ';
      for (const i of run) d += 'L' + xs[i].toFixed(1) + ' ' + fy(ys[i] as number).toFixed(1) + ' ';
      d += 'L' + xs[run[run.length - 1]].toFixed(1) + ' ' + floorY.toFixed(1) + ' Z ';
    }
    run = [];
  };
  for (let i = 0; i < xs.length; i++) {
    const v = ys[i];
    if (v === null || v === undefined || !Number.isFinite(v)) flush(); else run.push(i);
  }
  flush();
  return d.trim();
}

export function hourOfDay(d: Date): number {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export const lastIndexWithValue = (ys: (number | null)[]): number => {
  for (let i = ys.length - 1; i >= 0; i--) if (ys[i] !== null && Number.isFinite(ys[i] as number)) return i;
  return -1;
};
