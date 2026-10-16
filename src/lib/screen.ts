export const pageZoom = (): number => {
  const z = parseFloat(document.documentElement.style.getPropertyValue('--z'));
  return Number.isFinite(z) && z > 0 ? z : 1;
};

export interface CssRect { left: number; top: number; right: number; bottom: number; width: number; height: number; x: number; y: number }

export function cssRect(el: Element): CssRect {
  const r = el.getBoundingClientRect(), z = pageZoom();
  return { left: r.left / z, top: r.top / z, right: r.right / z, bottom: r.bottom / z, width: r.width / z, height: r.height / z, x: r.left / z, y: r.top / z };
}

export const cssX = (e: { clientX: number }): number => e.clientX / pageZoom();
export const cssY = (e: { clientY: number }): number => e.clientY / pageZoom();
export const viewW = (): number => window.innerWidth / pageZoom();
export const viewH = (): number => window.innerHeight / pageZoom();
