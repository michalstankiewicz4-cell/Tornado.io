// Teren gry: łagodne pagórki, wioska na płaskim w środku, polna droga wzdłuż osi x, pola (zaorane i zboże) za wioską.
// Trawa z tekstury (js/world/ground.js), kolory wierzchołków barwią drogę i pola.
// createTerrain({ size, seg }) → { mesh, heightAt(x, z), onRoad(x, z), size }
import * as THREE from '../../vendor/three/three.module.js';
import { grassMaterial } from '../world/ground.js';

const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const ROAD_W = 5.5;
export function heightAt(x, z) {
  const base = 3.2 * Math.sin(x * 0.0085 + 0.7) * Math.cos(z * 0.0072 - 0.4) + 1.7 * Math.sin(x * 0.019 + z * 0.013 + 2) + 0.6 * Math.sin(x * 0.05 - z * 0.041);
  const d = Math.hypot(x / 1.7, z / 1.1);
  return base * sm(80, 170, d) + 0.25 * Math.sin(x * 0.11) * Math.sin(z * 0.09) * sm(40, 90, d) + 0.6;
}
// droga: lekko wije się wokół z = 0
export const roadZ = (x) => 2.5 * Math.sin(x * 0.012);
export const onRoad = (x, z) => Math.abs(z - roadZ(x)) < ROAD_W / 2;

export function createTerrain({ size = 680, seg = 280, tile = 3 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv, col = new Float32Array(p.count * 3);
  const n = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.07 + Math.sin(z * 0.05) * 2) * Math.sin(z * 0.061 + Math.sin(x * 0.04) * 1.7);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, heightAt(x, z)); uv.setXY(i, x / tile, z / tile);
    let r = 1, g = 1, b = 1;
    const v = 0.88 + 0.2 * n(x, z); r *= v; g *= v; b *= v;
    // pola: pasy zaorane i zboże za wioską (wschód i zachód)
    const fx = Math.abs(x) - 150;
    if (fx > 0 && Math.abs(z) < 120) {
      const strip = Math.floor((z + 200) / 30) % 3, rowk = 0.92 + 0.08 * Math.sin(z * 3.1);
      if (strip === 0) { r *= 1.55 * rowk; g *= 0.95 * rowk; b *= 0.75 * rowk; }       // zaorane
      else if (strip === 1) { r *= 1.75; g *= 1.45; b *= 0.6; }                         // zboże
    }
    // droga gruntowa z poboczem
    const dz = Math.abs(z - roadZ(x)), k = 1 - sm(ROAD_W / 2 - 0.6, ROAD_W / 2 + 0.8, dz);
    if (k > 0 && Math.abs(x) < size / 2 - 10) { r = r * (1 - k) + 1.55 * k; g = g * (1 - k) + 1.25 * k; b = b * (1 - k) + 1.0 * k; }
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, grassMaterial({ tile })); mesh.receiveShadow = true; mesh.name = 'teren';
  return { mesh, heightAt, onRoad, size };
}
