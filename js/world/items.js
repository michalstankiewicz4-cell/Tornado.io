// Przedmioty do jedzenia i rzucania: śmieci z JunkKit (js/models/junkyard/items/ — z laboratorium przedmiotów
// GameLaboratory: puszki, opony, beczki, gazety, kartony, garnek) i kamienie z RockKit. Prawdziwe wymiary i masy.
// Modele budowane raz na rodzaj i wariant, potem klonowane (wspólna geometria i materiały).
//   ITEMS                              { id: { name, mass, variants } }
//   loadItems() → Promise              buduje modele (JunkKit potrzebuje tekstur z MatKit)
//   makeItem(id, { variant, seed }) → { obj, m, pts, r, A, size, name }   do world.addObject
import * as THREE from '../../vendor/three/three.module.js';
import * as can from '../models/junkyard/items/can.js';
import * as canCrushed from '../models/junkyard/items/can-crushed.js';
import * as pot from '../models/junkyard/items/pot.js';
import * as newspapers from '../models/junkyard/items/newspapers.js';
import * as box from '../models/junkyard/items/box.js';
import * as barrel from '../models/junkyard/items/barrel.js';
import * as tireCar from '../models/junkyard/items/tire-car.js';
import * as tireBike from '../models/junkyard/items/tire-bike.js';
import * as tireTractor from '../models/junkyard/items/tire-tractor.js';
import { applyTextures } from '../models/junkyard/textures.js';
import { rockGeometry, rockMaterial, rockInfo } from '../models/rocks/rockkit.js';

const JUNK = { can, 'can-crushed': canCrushed, pot, newspapers, box, barrel, 'tire-car': tireCar, 'tire-bike': tireBike, 'tire-tractor': tireTractor };
export const ITEMS = {
  can: { name: 'Puszka', pl: true }, 'can-crushed': { name: 'Puszka zgnieciona' }, pot: { name: 'Garnek' }, newspapers: { name: 'Gazety' },
  box: { name: 'Karton' }, barrel: { name: 'Beczka' }, 'tire-car': { name: 'Opona samochodowa' }, 'tire-bike': { name: 'Opona rowerowa' },
  'tire-tractor': { name: 'Opona traktorowa' }, pebble: { name: 'Kamień' }, rock: { name: 'Głaz' }, boulder: { name: 'Duży głaz' },
};
for (const [id, m] of Object.entries(JUNK)) { ITEMS[id].mass = m.info.mass; ITEMS[id].variants = m.info.variants || 1; }
const ROCKS = { pebble: { size: 0.28, shape: 'pebble' }, rock: { size: 0.7, shape: 'boulder' }, boulder: { size: 1.4, shape: 'boulder' } };
const ROCK_KINDS = ['granite', 'limestone', 'sandstone', 'basalt'];

const proto = new Map();   // id:variant → { obj, m, pts, r, A, size }
let ready = null;
export function loadItems() {
  if (ready) return ready;
  ready = (async () => {
    for (const [id, mod] of Object.entries(JUNK)) {
      for (let v = 0; v < (mod.info.variants || 1); v++) {
        const g = mod.build(1, v); g.name = id;
        proto.set(id + ':' + v, measure(g, mod.info.mass));
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    applyTextures();
    for (const [id, R] of Object.entries(ROCKS)) for (let v = 0; v < 4; v++) {
      const kind = ROCK_KINDS[v], geo = rockGeometry({ kind, shape: R.shape, size: R.size, seed: 11 + v * 7, detail: 0.75, moss: 0.25, lichen: 0.3 });
      const mesh = new THREE.Mesh(geo, rockMaterial(kind)), g = new THREE.Group(); g.add(mesh);
      // kamień leży na ziemi zagrzebany: środek bryły na środku pudełka
      geo.computeBoundingBox(); const c = geo.boundingBox.getCenter(new THREE.Vector3()); mesh.position.sub(c);
      proto.set(id + ':' + v, measure(g, rockInfo({ kind, shape: R.shape, size: R.size }, geo).mass));
    }
  })();
  return ready;
}
function measure(g, mass) {
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const bb = new THREE.Box3().setFromObject(g), s = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  g.children.forEach((ch) => ch.position.sub(c));   // środek pudełka w środku obiektu (tak się obraca)
  const pts = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) pts.push(x * s.x / 2, y * s.y / 2, z * s.z / 2);
  return { obj: g, m: mass, pts: new Float32Array(pts), r: s.length() / 2, A: Math.max(s.x * s.y, s.y * s.z, s.x * s.z), size: Math.max(s.x, s.y, s.z), half: s.clone().multiplyScalar(0.5) };
}
export function makeItem(id, { variant = 0 } = {}) {
  const n = ITEMS[id] ? (ITEMS[id].variants || 4) : 1, P = proto.get(id + ':' + (variant % n)) || proto.get(id + ':0');
  if (!P) throw new Error('nie ma przedmiotu ' + id);
  const obj = P.obj.clone(); obj.name = id;
  return { obj, m: P.m, pts: P.pts, r: P.r, A: P.A, size: P.size, half: P.half, name: ITEMS[id].name };
}

// Pula instancji: setki przedmiotów, jedno wywołanie rysowania na rodzaj×wariant×część modelu. Przedmiot w puli ma
// slot; set(matrix) stawia wszystkie części przedmiotu, free() chowa je i oddaje slot.
// createItemPool(scene) → { spawn(id, variant) → { ...dane przedmiotu, set(Matrix4), free() }, draws() }
export function createItemPool(scene) {
  const groups = new Map();
  const _m = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function group(key) {
    let G = groups.get(key); if (G) return G;
    const P = proto.get(key); if (!P) throw new Error('nie ma przedmiotu ' + key);
    P.obj.updateMatrixWorld(true);
    const parts = []; P.obj.traverse((o) => { if (o.isMesh) parts.push({ geo: o.geometry, mat: o.material, local: o.matrixWorld.clone() }); });
    G = { P, parts, cap: 0, ims: [], free: [], n: 0, top: 0 };
    grow(G, 32); groups.set(key, G);
    return G;
  }
  function grow(G, cap) {
    const old = G.ims;
    G.ims = G.parts.map((pt, i) => {
      const im = new THREE.InstancedMesh(pt.geo, pt.mat, cap); im.castShadow = G.P.size > 0.35; im.receiveShadow = true;   // drobiazgi bez cienia
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false;
      for (let k = 0; k < cap; k++) im.setMatrixAt(k, ZERO);
      if (old[i]) { im.instanceMatrix.array.set(old[i].instanceMatrix.array); scene.remove(old[i]); old[i].dispose(); }
      im.count = G.top || 0; scene.add(im); return im;
    });
    for (let k = cap - 1; k >= G.cap; k--) G.free.push(k);
    G.cap = cap;
  }
  return {
    spawn(id, variant = 0) {
      const n = ITEMS[id] ? (ITEMS[id].variants || 4) : 1, key = id + ':' + (variant % n);
      const G = group(proto.has(key) ? key : id + ':0');
      if (!G.free.length) grow(G, G.cap * 2);
      G.free.sort((a, b) => b - a);   // najniższe wolne miejsce pierwsze — rysujemy tylko do najwyższego zajętego
      const slot = G.free.pop(), P = G.P;
      if (slot + 1 > G.top) { G.top = slot + 1; for (const im of G.ims) im.count = G.top; }
      const set = (M) => { for (let i = 0; i < G.parts.length; i++) { _m.multiplyMatrices(M, G.parts[i].local); G.ims[i].setMatrixAt(slot, _m); G.ims[i].instanceMatrix.needsUpdate = true; } };
      const free = () => { for (const im of G.ims) { im.setMatrixAt(slot, ZERO); im.instanceMatrix.needsUpdate = true; } G.free.push(slot); };
      return { m: P.m, pts: P.pts, r: P.r, A: P.A, size: P.size, half: P.half, name: ITEMS[id].name, vol: P.half.x * P.half.y * P.half.z * 8 * 0.6, set, free };
    },
    draws() { let n = 0; for (const G of groups.values()) n += G.ims.length; return n; },
  };
}
