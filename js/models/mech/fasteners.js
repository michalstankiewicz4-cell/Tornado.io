// MechKit — złącza gwintowe: gwint metryczny ISO (zarys 60°, linia śrubowa prawoskrętna), śruba z łbem sześciokątnym
// (ISO 4014 / 4017, oznaczenie klasy na łbie), nakrętka ISO 4032 (gwint wewnętrzny, fazy z obu stron), podkładka ISO 7089.
// Dane wymiarów i klas własności — tutaj (METRIC, BOLT_CLASSES); fizyka dokręcania złącza — behaviors/mech/bolted-joint.js.
import * as THREE from '../../../vendor/three/three.module.js';
import { materials, STEEL_RHO } from './mechkit.js';
import { mesh } from './common.js';

const ringY = (ri, ro, h, seg = 32) => new THREE.LatheGeometry([[ri, -h / 2], [ro, -h / 2], [ro, h / 2], [ri, h / 2], [ri, -h / 2]].map(([r, y]) => new THREE.Vector2(r, y)), seg);

/* ---------------- gwint metryczny, śruba z łbem sześciokątnym, nakrętka, podkładka ---------------- */
// Dane ISO 261 / ISO 4014 / ISO 4017 / ISO 4032 / ISO 7089 (gwint zwykły): P — skok, s — rozmiar klucza, k — wysokość łba,
// m — wysokość nakrętki, As — przekrój czynny, d2 — średnica podziałowa, d3 — średnica rdzenia śruby, dh — otwór
// przejściowy (średni, ISO 273), wd / wD / wh — podkładka (otwór, średnica, grubość), dw — średnica oporowa łba / nakrętki.
export const METRIC = {
  6: { P: 0.001, s: 0.010, k: 0.004, m: 0.0052, As: 20.1e-6, d2: 0.005350, d3: 0.004773, dh: 0.0066, wd: 0.0064, wD: 0.012, wh: 0.0016, dw: 0.0089 },
  8: { P: 0.00125, s: 0.013, k: 0.0053, m: 0.0068, As: 36.6e-6, d2: 0.007188, d3: 0.006466, dh: 0.009, wd: 0.0084, wD: 0.016, wh: 0.0016, dw: 0.0116 },
  10: { P: 0.0015, s: 0.016, k: 0.0064, m: 0.0084, As: 58.0e-6, d2: 0.009026, d3: 0.008160, dh: 0.011, wd: 0.0105, wD: 0.020, wh: 0.002, dw: 0.0146 },
  12: { P: 0.00175, s: 0.018, k: 0.0075, m: 0.0108, As: 84.3e-6, d2: 0.010863, d3: 0.009853, dh: 0.0135, wd: 0.013, wD: 0.024, wh: 0.0025, dw: 0.0166 },
  16: { P: 0.002, s: 0.024, k: 0.010, m: 0.0148, As: 157e-6, d2: 0.014701, d3: 0.013546, dh: 0.0175, wd: 0.017, wD: 0.030, wh: 0.003, dw: 0.0225 },
  20: { P: 0.0025, s: 0.030, k: 0.0125, m: 0.018, As: 245e-6, d2: 0.018376, d3: 0.016933, dh: 0.022, wd: 0.021, wD: 0.037, wh: 0.003, dw: 0.0282 },
  24: { P: 0.003, s: 0.036, k: 0.015, m: 0.0215, As: 353e-6, d2: 0.022051, d3: 0.020319, dh: 0.026, wd: 0.025, wD: 0.044, wh: 0.004, dw: 0.0336 },
};
// klasy własności (ISO 898-1, ISO 3506): Rm — wytrzymałość na rozciąganie, Re — granica plastyczności (R_p0,2), Pa
export const BOLT_CLASSES = { '4.6': { Rm: 400e6, Re: 240e6 }, '5.6': { Rm: 500e6, Re: 300e6 }, '8.8': { Rm: 800e6, Re: 640e6 }, '10.9': { Rm: 1040e6, Re: 940e6 }, '12.9': { Rm: 1220e6, Re: 1100e6 }, 'A2-70': { Rm: 700e6, Re: 450e6 } };
// powłoki: ocynk galwaniczny, czernienie (śruby 10.9 / 12.9 zwykle czernione), stal nierdzewna
let FIN = null;
export function finishes() {
  if (FIN) return FIN;
  const M = materials();
  FIN = { zinc: new THREE.MeshPhysicalMaterial({ color: 0xc9cdd1, metalness: 1, roughness: 0.32, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    black: M.dark, stainless: new THREE.MeshPhysicalMaterial({ color: 0xd3d6d8, metalness: 1, roughness: 0.22 }) };
  return FIN;
}
// zarys podstawowy gwintu ISO (60°): faza t ∈ [0, 1) wzdłuż skoku → 0 wierzchołek (d/2), 1 dno (d3/2): wierzchołek P/8,
// bok 5P/16, dno P/4, bok 5P/16
function profile(t) { t -= Math.floor(t); if (t < 0.125) return 0; if (t < 0.4375) return (t - 0.125) / 0.3125; if (t < 0.6875) return 1; return 1 - (t - 0.6875) / 0.3125; }
// powierzchnia gwintu (śruby: na zewnątrz, nakrętki: do środka) wzdłuż osi y od y0 do y1; linia śrubowa prawoskrętna
// r(θ, y) = R − h·zarys(y/P − θ/2π); wybieg — przejście w gładki trzpień na długości 2P od yRun; faza końca śruby 45°
export function threadGeometry({ R, h, P, y0, y1, inner = false, yRun = null, chamfer = 0, seg = 40, perP = 10 } = {}) {
  const n = Math.max(2, Math.ceil((y1 - y0) / P * perP)), pos = [], idx = [];
  for (let j = 0; j <= n; j++) {
    const y = y0 + (y1 - y0) * j / n;
    for (let i = 0; i <= seg; i++) {
      const th = i / seg * Math.PI * 2; let depth = h * profile(y / P - th / (Math.PI * 2));
      if (yRun !== null && y > yRun) depth *= Math.max(0, 1 - (y - yRun) / (2 * P));   // wybieg gwintu pod łbem
      let r = inner ? R - h + depth : R - depth;
      if (chamfer > 0 && !inner) r = Math.min(r, R - h + (y - y0) * 1.0 + 0.0001);   // faza 45° na końcu śruby
      pos.push(Math.cos(th) * r, y, -Math.sin(th) * r);
    }
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; if (inner) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// graniastosłup sześciokątny z fazą 30° (łuki na ściankach jak w kutych łbach i nakrętkach): s — rozmiar klucza, h — wysokość,
// cTop / cBot — faza na górze / na dole, hole — promień otworu (nakrętka) albo 0
export function hexGeometry({ s, h, cTop = true, cBot = true, hole = 0, per = 12 } = {}) {
  const N = per * 6, Rc = s / 2 * 0.98, e = s / Math.sqrt(3), dc = (e - Rc) * Math.tan(Math.PI / 6);
  const rHex = (a) => { const k = ((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3); return (s / 2) / Math.cos(k - Math.PI / 6); };
  const rings = [];
  const add = (y, fromFace) => rings.push({ y, fromFace });
  if (cBot) { for (let k = 0; k <= 4; k++) add(dc * k / 4, dc * k / 4); } else add(0, Infinity);
  if (cTop) { for (let k = 4; k >= 0; k--) add(h - dc * k / 4, dc * k / 4); } else add(h, Infinity);
  const pos = [], ring = (y, ff) => { const out = []; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, r = Math.min(rHex(a), Rc + ff / Math.tan(Math.PI / 6)); out.push([Math.cos(a) * r, y, -Math.sin(a) * r]); } return out; };
  const R = rings.map((q) => ring(q.y, q.fromFace)), tri = (a, b, c) => pos.push(...a, ...b, ...c);
  for (let j = 0; j < R.length - 1; j++) for (let i = 0; i < N; i++) { const a = R[j][i], b = R[j][(i + 1) % N], c = R[j + 1][i], d = R[j + 1][(i + 1) % N]; tri(a, b, c); tri(b, d, c); }
  for (const [rr, y, up] of [[R[0], 0, false], [R[R.length - 1], h, true]]) for (let i = 0; i < N; i++) {   // czoła: pierścień od otworu do krawędzi
    const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, o = rr[i], p = rr[(i + 1) % N], hi = (a) => [Math.cos(a) * hole, y, -Math.sin(a) * hole];
    if (hole > 0) { if (up) { tri(hi(a0), o, p); tri(hi(a0), p, hi(a1)); } else { tri(hi(a0), p, o); tri(hi(a0), hi(a1), p); } }
    else if (up) tri([0, y, 0], o, p); else tri([0, y, 0], p, o);
  }
  if (hole > 0) for (let i = 0; i < N; i++) {   // ścianka otworu (normalne do osi)
    const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, q = (a, y) => [Math.cos(a) * hole, y, -Math.sin(a) * hole];
    tri(q(a0, 0), q(a0, h), q(a1, 0)); tri(q(a1, 0), q(a0, h), q(a1, h));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
// śruba z łbem sześciokątnym (ISO 4017 — gwint do łba, ISO 4014 — z częścią gładką): początek — płaszczyzna oporowa łba,
// trzpień w −y, łeb w +y; gwint b = 2d + 6 mm (ISO 4014, l ≤ 125 mm), oznaczenie na łbie
export function hexBolt({ d = 0.01, len = 0.05, cls = '8.8', finish = 'zinc', name } = {}) {
  const D = METRIC[Math.round(d * 1000)] || METRIC[10], F = finishes()[finish] || finishes().zinc, g = new THREE.Group(), P = D.P, h = (d - D.d3) / 2;
  g.name = name || `Śruba M${Math.round(d * 1000)} × ${Math.round(len * 1000)} ${cls}`;
  const b = Math.min(len, 2 * d + 0.006), plain = len - b;
  const head = mesh(hexGeometry({ s: D.s, h: D.k - 0.0004, cBot: false }), F); head.position.y = 0.0004; g.add(head);   // łeb na podtoczeniu oporowym
  const wf = mesh(new THREE.CylinderGeometry(D.dw / 2, D.dw / 2, 0.0004, 40), F); wf.position.y = 0.0002; g.add(wf);   // podtoczenie oporowe
  if (plain > 0.0005) { const sh = mesh(new THREE.CylinderGeometry(d / 2, d / 2, plain, 40, 1, true), F); sh.position.y = -plain / 2; g.add(sh); }
  const th = mesh(threadGeometry({ R: d / 2, h, P, y0: -len, y1: -plain, yRun: -plain - 2 * P, chamfer: 1 }), F); g.add(th);
  const tip = mesh(new THREE.CircleGeometry(D.d3 / 2 * 0.98, 32).rotateX(Math.PI / 2), F); tip.position.y = -len; g.add(tip);
  const mark = canvasMark(`${cls}`), lab = mesh(new THREE.PlaneGeometry(D.s * 0.62, D.s * 0.31).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: mark, transparent: true, roughness: 0.5, metalness: 0.6, color: 0x555a5e, polygonOffset: true, polygonOffsetFactor: -2 }), false); lab.position.y = D.k + 0.00005; g.add(lab);
  const vol = Math.PI * d * d / 4 * plain + D.As * b + D.s * D.s * 0.866 * D.k;
  Object.assign(g.userData, { d, len, b, plain, P, cls, finish, data: D, mass: STEEL_RHO * vol, headH: D.k });
  return g;
}
// oznaczenie wybite na łbie (klasa własności) — tekstura z płótna, tło przezroczyste
const MARKS = new Map();
function canvasMark(text) {
  if (MARKS.has(text)) return MARKS.get(text);
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(0, 0, 128, 64); x.fillStyle = 'rgba(30,32,34,0.85)'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; MARKS.set(text, t); return t;
}
// nakrętka sześciokątna ISO 4032 (faza z obu stron, gwint wewnętrzny): początek — czoło dolne, oś +y
export function hexNut({ d = 0.01, finish = 'zinc', name } = {}) {
  const D = METRIC[Math.round(d * 1000)] || METRIC[10], F = finishes()[finish] || finishes().zinc, g = new THREE.Group(), h = (d - D.d3) / 2;
  g.name = name || `Nakrętka M${Math.round(d * 1000)}`;
  const body = mesh(hexGeometry({ s: D.s, h: D.m, hole: d / 2 + 0.0004 }), F); g.add(body);   // otwór: średnica zewnętrzna gwintu z luzem (dno gwintu nakrętki)
  const thr = mesh(threadGeometry({ R: d / 2 + 0.00005, h: h * 0.9, P: D.P, y0: 0, y1: D.m, inner: true }), F); thr.userData.doctorOk = ['clash', 'seethrough']; g.add(thr);   // gwint wewnętrzny: od środka śruby; z zewnątrz widać go tylko przez otwór
  Object.assign(g.userData, { d, m: D.m, P: D.P, finish, data: D, mass: STEEL_RHO * (D.s * D.s * 0.866 - Math.PI * d * d / 4) * D.m });
  return g;
}
// podkładka płaska ISO 7089 (200 HV): początek — spód, oś +y
export function washer({ d = 0.01, finish = 'zinc', name } = {}) {
  const D = METRIC[Math.round(d * 1000)] || METRIC[10], F = finishes()[finish] || finishes().zinc, g = new THREE.Group();
  g.name = name || `Podkładka ${Math.round(d * 1000)}`;
  const w = mesh(ringY(D.wd / 2, D.wD / 2, D.wh, 48), F); w.position.y = D.wh / 2; g.add(w);
  Object.assign(g.userData, { d, h: D.wh, mass: STEEL_RHO * Math.PI / 4 * (D.wD * D.wD - D.wd * D.wd) * D.wh });
  return g;
}
