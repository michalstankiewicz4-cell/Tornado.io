// Wysokość terenu gry (czysta matematyka, bez Three.js) — używa jej teren (js/game/terrain.js) i wątek fizyki
// odłamków (js/game/physics-env.js).
export const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// dzielnica miejska na wschodzie: płaska, wybetonowana (wieżowce i Pałac Kultury)
export const CITY = { x0: 190, x1: 850, z0: -335, z1: 325 };
export const cityK = (x, z, m = 30) => sm(-m, 0, Math.min(x - CITY.x0, CITY.x1 - x, z - CITY.z0, CITY.z1 - z));
export function heightAt(x, z) {
  const base = 3.2 * Math.sin(x * 0.0085 + 0.7) * Math.cos(z * 0.0072 - 0.4) + 1.7 * Math.sin(x * 0.019 + z * 0.013 + 2) + 0.6 * Math.sin(x * 0.05 - z * 0.041);
  const d = Math.hypot(x / 1.7, z / 1.1);
  const flat = Math.max(1 - sm(80, 170, d), cityK(x, z));
  return (base + 0.25 * Math.sin(x * 0.11) * Math.sin(z * 0.09) * sm(40, 90, d)) * (1 - flat) + 0.6;
}
