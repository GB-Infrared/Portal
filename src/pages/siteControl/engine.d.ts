export interface GlobeSite {
  siteId: string; id: string; addr: string; lat: number; lng: number;
  ac: number; dc: number | null; dev: number; down: number; warn: number; crit: number;
  kw: number | null; eToday: number | null; peak: number | null; state: string | null;
}
export interface GlobePortfolio { hours: number[]; kw: (number | null)[]; cap: number; revenue: number | null; co2: number | null }
export function startGlobe(opts: {
  root: HTMLElement; sites: GlobeSite[]; portfolio: () => GlobePortfolio | null; operator: string; onOpen: (siteId: string) => void;
}): { stop: () => void; refresh: () => void };
