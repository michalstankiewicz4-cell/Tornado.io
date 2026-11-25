// Teren gry: łagodne pagórki, wioska na płaskim w środku, polna droga wzdłuż osi x, pola (zaorane i zboże) za wioską.
// Trawa z tekstury (js/world/ground.js), kolory wierzchołków barwią drogę i pola.
// createTerrain({ size, seg }) → { mesh, heightAt(x, z), onRoad(x, z), size }
import { touchAttr } from '../render/partial-upload.js';
import * as THREE from '../../vendor/three/three.module.js';
import { grassMaterial } from '../world/ground.js';
import { makeMaterial } from '../render/materials/matkit.js';

// wysokość terenu w osobnym, czystym module (czyta ją też wątek fizyki odłamków — js/game/physics-env.js)
import { sm, CITY, cityK, heightAt } from './height.js';
export { CITY, heightAt };
export const ROAD_W = 5.5;
// droga: lekko wije się wokół z = 0
export const roadZ = (x) => 2.5 * Math.sin(x * 0.012);
export const onRoad = (x, z) => x < CITY.x0 + 5 && Math.abs(z - roadZ(x)) < ROAD_W / 2;   // droga kończy się na placu miasta

export function createTerrain({ size = 1320, seg = 380, tile = 3, cx = 290 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2).translate(cx, 0, 0);
  const p = geo.attributes.position, uv = geo.attributes.uv, col = new Float32Array(p.count * 3), fuel = new Float32Array(p.count);
  const n = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.07 + Math.sin(z * 0.05) * 2) * Math.sin(z * 0.061 + Math.sin(x * 0.04) * 1.7);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, heightAt(x, z)); uv.setXY(i, x / tile, z / tile);
    let r = 1, g = 1, b = 1, f = 1;   // f — paliwo trawy (pożary): trawa 1, zboże 1,4, zaorane 0,15, droga i plac 0
    const v = 0.88 + 0.2 * n(x, z); r *= v; g *= v; b *= v;
    // pola: pasy zaorane i zboże za wioską (wschód i zachód)
    const fx = Math.abs(x) - 150;
    const ck = cityK(x, z, 6);
    if (fx > 0 && Math.abs(z) < 120 && ck < 0.01) {
      const strip = Math.floor((z + 200) / 30) % 3, rowk = 0.92 + 0.08 * Math.sin(z * 3.1);
      if (strip === 0) { r *= 1.55 * rowk; g *= 0.95 * rowk; b *= 0.75 * rowk; f = 0.15; }       // zaorane
      else if (strip === 1) { r *= 1.75; g *= 1.45; b *= 0.6; f = 1.4; }                         // zboże
    }
    // plac i chodniki w mieście (szary beton zamiast trawy)
    if (ck > 0) f *= 1 - ck;
    if (ck > 0) { const g0 = 0.95 + 0.1 * Math.sin(x * 0.9) * Math.sin(z * 0.9); r = r * (1 - ck) + 1.75 * g0 * ck; g = g * (1 - ck) + 1.45 * g0 * ck; b = b * (1 - ck) + 1.6 * g0 * ck; }
    // droga gruntowa z poboczem
    const dz = Math.abs(z - roadZ(x)), k = 1 - sm(ROAD_W / 2 - 0.6, ROAD_W / 2 + 0.8, dz);
    if (k > 0 && x > cx - size / 2 + 10 && x < CITY.x0 + 5) { f *= 1 - k; r = r * (1 - k) + 1.55 * k; g = g * (1 - k) + 1.25 * k; b = b * (1 - k) + 1.0 * k; }
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b; fuel[i] = f;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, grassMaterial({ tile })); mesh.receiveShadow = true; mesh.name = 'teren';
  // siatka pożarów trawy = wierzchołki terenu (n × n, krok step); spalone ciemnieją (setBurnt), barwy wyjściowe w base
  const nG = seg + 1, step = size / seg, base = col.slice(), cattr = geo.attributes.color;
  const grid = { n: nG, step, x0: cx - size / 2, z0: -size / 2, fuel,
    index: (x, z) => { const i = Math.round((x - grid.x0) / step), j = Math.round((z - grid.z0) / step); return i < 0 || j < 0 || i >= nG || j >= nG ? -1 : j * nG + i; },
    pos: (k) => [grid.x0 + (k % nG) * step, grid.z0 + Math.floor(k / nG) * step],
    // k 0…1: 0 — trawa, 1 — wypalona ziemia (prawie czarna)
    // na kartę idą tylko zmienione wierzchołki (3 liczby barwy), nie cała siatka terenu
    setBurnt(k, a) { const m = 1 - 0.85 * a; cattr.array[k * 3] = base[k * 3] * m * 0.9; cattr.array[k * 3 + 1] = base[k * 3 + 1] * m * 0.85; cattr.array[k * 3 + 2] = base[k * 3 + 2] * m * 0.8; touchAttr(cattr, k * 3, 3); },
    flush() {},
  };
  return { mesh, heightAt, onRoad, size, grid };
}

// nawierzchnia placu miejskiego: płyty betonowe (MatKit) na płaskim terenie miasta
export function cityPaving() {
  const W = CITY.x1 - CITY.x0, D = CITY.z1 - CITY.z0, tile = 4;
  const geo = new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2).translate((CITY.x0 + CITY.x1) / 2, heightAt((CITY.x0 + CITY.x1) / 2, 0) + 0.08, (CITY.z0 + CITY.z1) / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / tile, p.getZ(i) / tile);
  const { material } = makeMaterial({ kind: 'concrete', color: '#8e8b84', color2: '#6f6d67', tile, roughness: 0.85, metalness: 0, pores: 0.4, wear: 0.15, dirt: 0.3, label: 'Płyty chodnikowe' }, { res: 512 });
  const m = new THREE.Mesh(geo, material); m.receiveShadow = true; m.name = 'plac';
  return m;
}
