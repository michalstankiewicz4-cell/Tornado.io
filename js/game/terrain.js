// Teren gry: łagodne pagórki, wioska na płaskim w środku, polna droga wzdłuż osi x, pola (zaorane i zboże) za wioską.
// Trawa z tekstury (js/world/ground.js), kolory wierzchołków barwią drogę i pola.
// createTerrain({ size, seg }) → { mesh, heightAt(x, z), onRoad(x, z), size }
import * as THREE from '../../vendor/three/three.module.js';
import { grassMaterial } from '../world/ground.js';

const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const ROAD_W = 5.5;
// dzielnica miejska na wschodzie: płaska, wybetonowana (wieżowce i Pałac Kultury)
export const CITY = { x0: 215, x1: 470, z0: -110, z1: 110 };
const cityK = (x, z, m = 30) => sm(-m, 0, Math.min(x - CITY.x0, CITY.x1 - x, z - CITY.z0, CITY.z1 - z));
export function heightAt(x, z) {
  const base = 3.2 * Math.sin(x * 0.0085 + 0.7) * Math.cos(z * 0.0072 - 0.4) + 1.7 * Math.sin(x * 0.019 + z * 0.013 + 2) + 0.6 * Math.sin(x * 0.05 - z * 0.041);
  const d = Math.hypot(x / 1.7, z / 1.1);
  const flat = Math.max(1 - sm(80, 170, d), cityK(x, z));
  return (base + 0.25 * Math.sin(x * 0.11) * Math.sin(z * 0.09) * sm(40, 90, d)) * (1 - flat) + 0.6;
}
// droga: lekko wije się wokół z = 0
export const roadZ = (x) => 2.5 * Math.sin(x * 0.012);
export const onRoad = (x, z) => x < CITY.x0 + 5 && Math.abs(z - roadZ(x)) < ROAD_W / 2;   // droga kończy się na placu miasta

export function createTerrain({ size = 1000, seg = 330, tile = 3, cx = 80 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2).translate(cx, 0, 0);
  const p = geo.attributes.position, uv = geo.attributes.uv, col = new Float32Array(p.count * 3);
  const n = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.07 + Math.sin(z * 0.05) * 2) * Math.sin(z * 0.061 + Math.sin(x * 0.04) * 1.7);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, heightAt(x, z)); uv.setXY(i, x / tile, z / tile);
    let r = 1, g = 1, b = 1;
    const v = 0.88 + 0.2 * n(x, z); r *= v; g *= v; b *= v;
    // pola: pasy zaorane i zboże za wioską (wschód i zachód)
    const fx = Math.abs(x) - 150;
    const ck = cityK(x, z, 6);
    if (fx > 0 && Math.abs(z) < 120 && ck < 0.01) {
      const strip = Math.floor((z + 200) / 30) % 3, rowk = 0.92 + 0.08 * Math.sin(z * 3.1);
      if (strip === 0) { r *= 1.55 * rowk; g *= 0.95 * rowk; b *= 0.75 * rowk; }       // zaorane
      else if (strip === 1) { r *= 1.75; g *= 1.45; b *= 0.6; }                         // zboże
    }
    // plac i chodniki w mieście (szary beton zamiast trawy)
    if (ck > 0) { const g0 = 0.95 + 0.1 * Math.sin(x * 0.9) * Math.sin(z * 0.9); r = r * (1 - ck) + 1.75 * g0 * ck; g = g * (1 - ck) + 1.45 * g0 * ck; b = b * (1 - ck) + 1.6 * g0 * ck; }
    // droga gruntowa z poboczem
    const dz = Math.abs(z - roadZ(x)), k = 1 - sm(ROAD_W / 2 - 0.6, ROAD_W / 2 + 0.8, dz);
    if (k > 0 && x > cx - size / 2 + 10 && x < CITY.x0 + 5) { r = r * (1 - k) + 1.55 * k; g = g * (1 - k) + 1.25 * k; b = b * (1 - k) + 1.0 * k; }
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, grassMaterial({ tile })); mesh.receiveShadow = true; mesh.name = 'teren';
  return { mesh, heightAt, onRoad, size };
}
