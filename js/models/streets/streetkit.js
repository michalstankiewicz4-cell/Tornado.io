// StreetKit — ulice, chodniki i inne trasy z przekroju prowadzonego po linii (metry, y w górę). Przekrój (profil)
// to pasy od osi na zewnątrz: jezdnia (pasy ruchu), krawężnik, chodnik, pas zieleni — albo pobocze z kruszywa przy
// drodze wiejskiej, albo sama ścieżka. Nawierzchnie z MatKit (asfalt, kostka, płyty, kruszywo, granit krawężnika),
// oznakowanie poziome z farby (linie, przerywane, przejście dla pieszych, linie zatrzymania).
//   PROFILES                         gotowe przekroje: city (ulica miejska), avenue (dwie jezdnie z pasem), village (droga
//                                    wiejska), path (ścieżka), cycle (droga dla rowerów z chodnikiem)
//   buildStreet(points, profile, { closed }) → { group, length }    ulica po linii punktów [[x, z], …] (krzywa Catmulla–Roma)
//   buildCrossing(profile, { arms, corner }) → { group }            skrzyżowanie: 3 albo 4 wloty, łuki krawężników, przejścia
//   SURFACES                         nawierzchnie (opisy MatKit)
import * as THREE from '../../../vendor/three/three.module.js';
import { makeMaterial } from '../../render/materials/matkit.js';

export const SURFACES = {
  asphalt: { label: 'Asfalt', kind: 'concrete', color: '#3b3c3e', color2: '#28292b', tile: 3, roughness: 0.92, metalness: 0, pores: 0.9, wear: 0.25, dirt: 0.25 },
  asphaltOld: { label: 'Asfalt stary (łaty)', kind: 'concrete', color: '#4a4a4a', color2: '#2c2c2d', tile: 4, roughness: 0.95, metalness: 0, pores: 0.7, wear: 0.6, dirt: 0.45 },
  // płyty chodnikowe — własny generator (kwadraty ze spoinami, odcień każdej płyty, wypukłości): style w SLABS
  slabs: { label: 'Płyty 50 × 50 szare', slab: 'p50' },
  slabs35: { label: 'Płyty 35 × 35', slab: 'p35' },
  slabs30: { label: 'Płyty 30 × 30 grafitowe', slab: 'p30' },
  slabsOld: { label: 'Płyty 50 × 50 stare (spękane)', slab: 'old' },
  slabsChecker: { label: 'Płyty 50 × 50 szachownica', slab: 'checker' },
  slabsBig: { label: 'Płyty 100 × 50 granitowe', slab: 'big' },
  slabsTactile: { label: 'Płyty z wypustkami (dla niewidomych)', slab: 'tactile' },
  trylinka: { label: 'Trylinka (sześciokąty)', slab: 'hex' },
  pavers: { label: 'Kostka brukowa', kind: 'brick', color: '#8f8b84', color2: '#5e5b56', tile: 0.6, roughness: 0.9, metalness: 0, bricks: 6, wear: 0.25, dirt: 0.35 },
  redPavers: { label: 'Kostka czerwona (rowery)', kind: 'brick', color: '#8a4a3c', color2: '#5a3027', tile: 0.6, roughness: 0.9, metalness: 0, bricks: 6, wear: 0.2, dirt: 0.3 },
  gravel: { label: 'Kruszywo', kind: 'rock', color: '#8a8072', color2: '#5c554b', tile: 2, roughness: 0.97, metalness: 0, cracks: 0.05, grains: 1, dirt: 0.3 },
  curb: { label: 'Krawężnik granitowy', kind: 'rock', color: '#9a978f', color2: '#6a6862', tile: 1, roughness: 0.8, metalness: 0, cracks: 0.1, grains: 0.8, dirt: 0.2 },
  grass: { label: 'Trawnik', kind: 'rock', color: '#4f6a34', color2: '#36502a', tile: 2, roughness: 1, metalness: 0, cracks: 0, grains: 0.6, dirt: 0.15 },
  sod: { label: 'Darń na skarpie', kind: 'rock', color: '#5b6a38', color2: '#4a4430', tile: 3, roughness: 1, metalness: 0, cracks: 0.05, grains: 0.9, dirt: 0.5 },
};
// przekroje: pasy od osi na zewnątrz (symetrycznie po obu stronach), wysokości nad jezdnią
//   lanes — liczba pasów ruchu łącznie, laneW — szerokość pasa; strips — co jest za jezdnią po każdej stronie
export const PROFILES = {
  city: { label: 'Ulica miejska', lanes: 2, laneW: 3.25, road: 'asphalt', marks: { center: 'dashed', edge: false },
    strips: [{ k: 'curb', w: 0.15, h: 0.14 }, { k: 'sidewalk', w: 2.5, h: 0.14, s: 'slabs' }, { k: 'verge', w: 1.5, h: 0.14, s: 'grass' }] },
  avenue: { label: 'Aleja (dwie jezdnie)', lanes: 2, laneW: 3.5, road: 'asphalt', median: 3, marks: { center: 'dashed', edge: true },
    strips: [{ k: 'curb', w: 0.15, h: 0.14 }, { k: 'sidewalk', w: 2, h: 0.14, s: 'pavers' }, { k: 'cycle', w: 2, h: 0.14, s: 'redPavers' }, { k: 'sidewalk', w: 2.5, h: 0.14, s: 'slabsBig' }] },
  village: { label: 'Droga wiejska', lanes: 2, laneW: 2.9, road: 'asphaltOld', marks: { center: false, edge: false },
    strips: [{ k: 'shoulder', w: 1.0, h: -0.02, s: 'gravel' }, { k: 'verge', w: 1.2, h: -0.15, s: 'grass' }] },
  path: { label: 'Ścieżka', lanes: 1, laneW: 1.8, road: 'gravel', marks: { center: false, edge: false }, strips: [{ k: 'edge', w: 0.08, h: 0.06, s: 'curb' }] },
  cycle: { label: 'Droga dla rowerów i chodnik', lanes: 1, laneW: 2.2, road: 'redPavers', marks: { center: 'dashed', edge: false },
    strips: [{ k: 'curb', w: 0.1, h: 0.03 }, { k: 'sidewalk', w: 2.0, h: 0.03, s: 'pavers' }] },
};

// style płyt: rozmiar płyty [szer., dł.] m, spoina m, barwy (losowo na płytę), co ile płyt kafelek tekstury, dodatki
export const SLABS = {
  p50: { size: [0.5, 0.5], joint: 0.006, colors: ['#a9a69f', '#a29f98', '#aeaba3', '#9d9a93'], n: [4, 4], wear: 0.25 },
  p35: { size: [0.35, 0.35], joint: 0.005, colors: ['#b3afa6', '#aaa69d', '#b8b4ab'], n: [6, 6], wear: 0.2 },
  p30: { size: [0.3, 0.3], joint: 0.004, colors: ['#5c5d60', '#55565a', '#626366'], n: [6, 6], wear: 0.15 },
  old: { size: [0.5, 0.5], joint: 0.012, colors: ['#9b968c', '#8f8a80', '#a39e94', '#878279'], n: [4, 4], wear: 0.7, cracks: 0.3, tilt: 0.5, moss: 0.4 },
  checker: { size: [0.5, 0.5], joint: 0.006, colors: ['#aaa79f', '#5e5f62'], n: [4, 4], wear: 0.2, checker: true },
  big: { size: [1.0, 0.5], joint: 0.004, colors: ['#8d8c88', '#868580', '#94938e'], n: [2, 4], wear: 0.1, speckle: 0.9, bond: 0.5 },
  tactile: { size: [0.3, 0.3], joint: 0.005, colors: ['#d8b23a', '#d2ac35'], n: [6, 6], wear: 0.25, dots: true },
  hex: { size: [0.3, 0.26], joint: 0.008, colors: ['#9d998f', '#948f86', '#a5a196'], n: [6, 8], wear: 0.35, hex: true, holes: true },
};
function rngS(seed) { let x = seed >>> 0 || 1; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
// tekstura płyt (barwa + mapa wysokości do bumpMap) na kafelek n[0] × n[1] płyt; kafelek ma tile = n · rozmiar m
function slabMaterial(id) {
  const D = SLABS[id], R = 512, r = rngS(id.length * 7919 + 13);
  const W = D.hex ? D.size[0] * D.n[0] : D.size[0] * D.n[0], H = D.size[1] * D.n[1], px = R / W;   // pikseli na metr (kafelek kwadratowy w pikselach)
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const A = cv(R, Math.round(H * px)), B = cv(R, Math.round(H * px)), a = A.getContext('2d'), b = B.getContext('2d');
  a.fillStyle = '#3d3b37'; a.fillRect(0, 0, A.width, A.height); b.fillStyle = '#000'; b.fillRect(0, 0, B.width, B.height);   // spoiny: ciemne i niskie
  const J = Math.max(1, D.joint * px);
  const shade = (k) => { const c = D.colors[Math.floor(r() * D.colors.length)]; return k == null ? c : D.colors[k % D.colors.length]; };
  function slab(path, i, j, cx, cy) {
    const col = D.checker ? shade((i + j) % 2) : shade();
    a.save(); path(); a.clip();
    a.fillStyle = col; a.fillRect(0, 0, A.width, A.height);
    // ziarno i plamy na płycie, zużycie (jaśniejsze środki, ciemne brzegi)
    for (let k = 0; k < 140 * (D.speckle ? 3 : 1); k++) { a.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${(D.speckle ? 0.12 : 0.05) * r()})`; const s = 1 + r() * (D.speckle ? 1.5 : 3); a.fillRect(cx + (r() - 0.5) * px * D.size[0], cy + (r() - 0.5) * px * D.size[1], s, s); }
    if (D.wear) { const g = a.createRadialGradient(cx, cy, 0, cx, cy, px * D.size[0] * 0.8); g.addColorStop(0, `rgba(255,255,255,${0.06 * D.wear})`); g.addColorStop(1, `rgba(0,0,0,${0.12 * D.wear})`); a.fillStyle = g; a.fillRect(0, 0, A.width, A.height); }
    if (D.moss && r() < D.moss) { a.fillStyle = 'rgba(70,90,40,0.35)'; a.fillRect(cx - px * D.size[0] / 2, cy - px * D.size[1] / 2 + r() * px * 0.4, px * D.size[0], 3); }
    a.restore();
    // wysokość: płyta wyżej niż spoina; stare płyty przekrzywione (gradient), pęknięcia — rysy w dół
    b.save(); path(); b.clip();
    const lv = 0.75 + (D.tilt ? (r() - 0.5) * 0.4 * D.tilt : 0) * 1;
    if (D.tilt) { const g = b.createLinearGradient(cx - px * 0.25, cy - px * 0.25, cx + px * 0.25, cy + px * 0.25); const v0 = Math.round(255 * Math.min(1, lv + 0.1 * (r() - 0.5))), v1 = Math.round(255 * Math.min(1, lv + 0.15 * (r() - 0.5))); g.addColorStop(0, `rgb(${v0},${v0},${v0})`); g.addColorStop(1, `rgb(${v1},${v1},${v1})`); b.fillStyle = g; }
    else b.fillStyle = `rgb(${Math.round(255 * lv)},${Math.round(255 * lv)},${Math.round(255 * lv)})`;
    b.fillRect(0, 0, B.width, B.height);
    if (D.dots) for (let u = 0; u < 5; u++) for (let v = 0; v < 5; v++) {   // wypustki: 5 × 5 kopułek na płycie 30 × 30
      const x = cx + (u - 2) * px * D.size[0] / 5.5, y = cy + (v - 2) * px * D.size[1] / 5.5, rr = px * 0.012;
      const g = b.createRadialGradient(x, y, 0, x, y, rr * 1.4); g.addColorStop(0, '#fff'); g.addColorStop(1, `rgba(255,255,255,0)`); b.fillStyle = g; b.fillRect(x - rr * 2, y - rr * 2, rr * 4, rr * 4);
      a.fillStyle = 'rgba(255,255,255,0.12)'; a.beginPath(); a.arc(x, y, rr, 0, 7); a.fill();
    }
    if (D.cracks && r() < D.cracks) {
      let x = cx + (r() - 0.5) * px * D.size[0], y = cy - px * D.size[1] / 2; b.strokeStyle = '#000'; a.strokeStyle = 'rgba(30,28,25,0.7)'; b.lineWidth = 1.5; a.lineWidth = 0.8;
      b.beginPath(); a.beginPath(); b.moveTo(x, y); a.moveTo(x, y);
      const ang = (r() - 0.5) * 1.6, steps = 3 + Math.floor(r() * 4);   // pęknięcie w losowym kierunku, krótsze lub przez całą płytę
      for (let k = 0; k < steps; k++) { x += Math.sin(ang) * px * D.size[1] / 6 + (r() - 0.5) * px * 0.06; y += Math.cos(ang) * px * D.size[1] / 6; b.lineTo(x, y); a.lineTo(x, y); }
      b.stroke(); a.stroke();
    }
    if (D.holes) { a.fillStyle = 'rgba(40,50,30,0.9)'; a.beginPath(); a.arc(cx, cy, px * 0.035, 0, 7); a.fill(); b.fillStyle = '#000'; b.beginPath(); b.arc(cx, cy, px * 0.035, 0, 7); b.fill(); }
    b.restore();
  }
  const sw = D.size[0] * px, sh = D.size[1] * px;
  if (D.hex) {
    // trylinka: sześciokąty w rzędach przesuniętych o pół (kafelek zawija się)
    const rad = sw / Math.sqrt(3) * 1.0, dy = rad * 1.5;
    for (let j = -1; j <= Math.ceil(A.height / dy) + 1; j++) for (let i = -1; i <= Math.ceil(A.width / sw) + 1; i++) {
      const cx = i * sw + (j % 2 ? sw / 2 : 0), cy = j * dy;
      slab(() => { a.beginPath(); b.beginPath(); for (let k = 0; k < 6; k++) { const t = Math.PI / 6 + k * Math.PI / 3, x = cx + Math.cos(t) * (rad - J / 2), y = cy + Math.sin(t) * (rad - J / 2); if (k) { a.lineTo(x, y); b.lineTo(x, y); } else { a.moveTo(x, y); b.moveTo(x, y); } } a.closePath(); b.closePath(); }, i, j, cx, cy);
    }
  } else {
    for (let j = 0; j < D.n[1]; j++) for (let i = -1; i <= D.n[0]; i++) {
      const off = D.bond ? (j % 2) * sw * D.bond : 0, x = i * sw + off, y = j * sh;
      slab(() => { for (const c of [a, b]) { c.beginPath(); c.rect(x + J / 2, y + J / 2, sw - J, sh - J); } }, i, j, x + sw / 2, y + sh / 2);
    }
  }
  const map = new THREE.CanvasTexture(A), bump = new THREE.CanvasTexture(B);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  const m = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.5, roughness: D.speckle ? 0.6 : 0.9, metalness: 0 });
  // kafelek: W m szerokości; uv wstęgi = metry / tile — tekstura nie jest kwadratowa, więc skala v osobno
  m.userData.tile = W; m.userData.tileV = H;
  if (map.image.height !== map.image.width) { map.repeat.set(1, W / H); bump.repeat.set(1, W / H); }
  return m;
}
const matCache = new Map();
export function surface(id) {
  if (!matCache.has(id)) {
    const d = SURFACES[id];
    const m = d.slab ? slabMaterial(d.slab) : makeMaterial(d, { res: 512 }).material;
    if (!d.slab) m.userData.tile = d.tile;
    matCache.set(id, m);
  }
  return matCache.get(id);
}
const paint = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

// próbki linii: punkty co ~step m, z kierunkiem i normalną (w lewo) w płaszczyźnie xz
// punkty [x, z] albo [x, z, y] — trzecia liczba to wysokość trasy (wiadukty, zjazdy); normalna zawsze pozioma
function sample(points, step = 0.5, closed = false) {
  const c = new THREE.CatmullRomCurve3(points.map(([x, z, y = 0]) => new THREE.Vector3(x, y, z)), closed, 'centripetal');
  const L = c.getLength(), n = Math.max(2, Math.ceil(L / step)), out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, p = c.getPointAt(u), t = c.getTangentAt(u), h = Math.hypot(t.x, t.z) || 1;
    out.push({ p, t, nx: -t.z / h, nz: t.x / h, s: u * L });
  }
  return { pts: out, L };
}
// wstęga między odsunięciami a…b (m, w lewo od osi) na wysokości y; tile — metry na kafelek tekstury
function ribbon(S, a, b, y, tile, side = 0) {
  const P = [], N = [], U = [], I = [];
  S.pts.forEach((q, i) => {
    for (const o of [a, b]) { P.push(q.p.x + q.nx * o, q.p.y + y, q.p.z + q.nz * o); N.push(0, 1, 0); U.push(o / tile, q.s / tile); }
    if (i) { const k = i * 2; I.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  if (a > b) for (let i = 0; i < I.length; i += 3) [I[i + 1], I[i + 2]] = [I[i + 2], I[i + 1]];
  return geo(P, N, U, I);
}
// pionowa ściana wzdłuż linii (lico krawężnika) od y0 do y1 przy odsunięciu o, zwrócona na stronę dir (+1 w lewo);
// lico widać tylko z tej strony (normalna i kolejność wierzchołków zgodne)
function wall(S, o, y0, y1, dir, tile) {
  const P = [], N = [], U = [], I = [];
  S.pts.forEach((q, i) => {
    for (const y of [y0, y1]) { P.push(q.p.x + q.nx * o, q.p.y + y, q.p.z + q.nz * o); N.push(q.nx * dir, 0, q.nz * dir); U.push(q.s / tile, y / tile); }
    if (i) { const k = i * 2; if (dir > 0) I.push(k - 2, k, k - 1, k - 1, k, k + 1); else I.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  return geo(P, N, U, I);
}
function geo(P, N, U, I) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeBoundingSphere();
  return g;
}
// wstęga skośna: od (odsunięcie a, wysokość ya) do (b, yb) względem linii trasy — skarpy nasypu, spód pomostu
function slope(S, a, ya, b, yb, tile, flip = false, ground = null) {
  const P = [], N = [], U = [], I = [];
  S.pts.forEach((q, i) => {
    const pa = [q.p.x + q.nx * a, q.p.y + ya, q.p.z + q.nz * a], pb = [q.p.x + q.nx * b, ground != null ? ground : q.p.y + yb, q.p.z + q.nz * b];
    P.push(...pa, ...pb); N.push(0, 1, 0, 0, 1, 0); U.push(0, q.s / tile, Math.hypot(b - a, (pb[1] - pa[1])) / tile, q.s / tile);
    if (i) { const k = i * 2; if (flip) I.push(k - 2, k, k - 1, k - 1, k, k + 1); else I.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  const g = geo(P, N, U, I); g.computeVertexNormals(); return g;
}
const mesh = (g, m, shadow = true) => { const x = new THREE.Mesh(g, m); x.receiveShadow = true; x.castShadow = shadow; return x; };

// linie: ciągła albo przerywana (3 m kreska, 6 m przerwy — jak na polskich drogach poza miastem; w mieście 3/3)
function line(S, o, w, kind, y = 0.004) {
  if (kind === 'solid') return [ribbon(S, o - w / 2, o + w / 2, y, 1)];
  const parts = [], dash = 3, gap = kind === 'dashed' ? 3 : 6;
  let seg = [];
  for (const q of S.pts) { const on = (q.s % (dash + gap)) < dash; if (on) seg.push(q); else if (seg.length > 1) { parts.push(ribbon({ pts: seg }, o - w / 2, o + w / 2, y, 1)); seg = []; } else seg = []; }
  if (seg.length > 1) parts.push(ribbon({ pts: seg }, o - w / 2, o + w / 2, y, 1));
  return parts;
}

/** Ulica po linii: jezdnia, oznakowanie, krawężniki, chodniki, zieleń — po obu stronach. */
export function buildStreet(points, profile = PROFILES.city, { closed = false, marks = true } = {}) {
  const pr = typeof profile === 'string' ? PROFILES[profile] : profile, S = sample(points, 0.5, closed), g = new THREE.Group();
  const med = pr.median || 0, half = pr.lanes * pr.laneW / 2 + med / 2;
  g.name = 'ulica: ' + pr.label;
  const road = pr.noRoad ? null : surface(pr.road);
  if (pr.noRoad) { /* sam chodnik (bok skrzyżowania T) */ } else if (med) {
    // dwie jezdnie i pas dzielący (trawnik z krawężnikami)
    for (const sd of [-1, 1]) g.add(mesh(ribbon(S, sd * med / 2, sd * half, 0, road.userData.tile), road, false));
    g.add(mesh(ribbon(S, -med / 2 + 0.15, med / 2 - 0.15, 0.14, 2), surface(pr.medianS || 'grass'), false));
    for (const sd of [-1, 1]) { const o = sd * (med / 2 - 0.075); g.add(mesh(ribbon(S, o - 0.075, o + 0.075, 0.14, 1), surface('curb'))); g.add(mesh(wall(S, sd * med / 2, 0, 0.14, sd, 1), surface('curb'))); g.add(mesh(wall(S, sd * (med / 2 - 0.15), 0.1, 0.14, -sd, 1), surface('curb'))); }
  } else g.add(mesh(ribbon(S, -half, half, 0, road.userData.tile), road, false));
  if (marks && pr.marks) {
    const lines = [];
    if (pr.marks.center && !med && pr.lanes > 1) lines.push(...line(S, 0, 0.12, pr.marks.center));
    if (pr.marks.center && med) for (const sd of [-1, 1]) for (let l = 1; l < pr.lanes / 2; l++) lines.push(...line(S, sd * (med / 2 + l * pr.laneW), 0.12, pr.marks.center));
    if (pr.marks.center && pr.lanes === 1) lines.push(...line(S, 0, 0.1, pr.marks.center));
    if (pr.marks.edge) for (const sd of [-1, 1]) lines.push(...line(S, sd * (half - 0.3), 0.12, 'solid'));
    for (const l of lines) g.add(mesh(l, paint, false));
  }
  // pasy za jezdnią po obu stronach
  for (const sd of pr.side ? [pr.side] : [-1, 1]) {
    let o = half, yPrev = 0;
    for (const st of pr.strips) {
      const a = sd * o, b = sd * (o + st.w), m = st.k === 'curb' ? surface('curb') : surface(st.s);
      g.add(mesh(ribbon(S, a, b, st.h, m.userData.tile || 1), m, st.k === 'curb' || st.k === 'edge'));
      if (Math.abs(st.h - yPrev) > 0.005) g.add(mesh(wall(S, a, Math.min(st.h, yPrev) - 0.03, Math.max(st.h, yPrev), st.h > yPrev ? -sd : sd, 1), m.userData.tile ? m : surface('curb')));
      yPrev = st.h; o += st.w;
    }
    // zewnętrzny brzeg ostatniego pasa w dół do gruntu
    if (yPrev > 0.005) g.add(mesh(wall(S, sd * o, 0, yPrev, sd, 1), surface('curb')));
  }
  return { group: g, length: S.L, width: 2 * (half + pr.strips.reduce((s, x) => s + x.w, 0)) };
}

// wycinek pierścienia w płaszczyźnie xz (środek cx, cz; promienie r0…r1; kąty a0→a1, kąt = atan2(z, x)) na wysokości y
function ringXZ(cx, cz, r0, r1, a0, a1, y, tile, seg = 20) {
  const P = [], N = [], U = [], I = [];
  for (let i = 0; i <= seg; i++) {
    const t = a0 + (a1 - a0) * i / seg;
    for (const r of [r0, r1]) { const x = cx + Math.cos(t) * r, z = cz + Math.sin(t) * r; P.push(x, y, z); N.push(0, 1, 0); U.push(x / tile, z / tile); }
    if (i) { const k = i * 2; if (a1 > a0) I.push(k - 2, k, k - 1, k - 1, k, k + 1); else I.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  return geo(P, N, U, I);
}
// pionowa ściana po łuku (lico krawężnika), normalna na zewnątrz łuku (out = +1) albo do środka (−1)
function arcWall(cx, cz, r, a0, a1, y0, y1, out, seg = 20) {
  const P = [], N = [], U = [], I = [];
  for (let i = 0; i <= seg; i++) {
    const t = a0 + (a1 - a0) * i / seg, c = Math.cos(t), sn = Math.sin(t);
    for (const y of [y0, y1]) { P.push(cx + c * r, y, cz + sn * r); N.push(c * out, 0, sn * out); U.push(t * r, y); }
    if (i) { const k = i * 2; const flip = (a1 > a0) !== (out > 0); if (flip) I.push(k - 2, k, k - 1, k - 1, k, k + 1); else I.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  return geo(P, N, U, I);
}

/** Skrzyżowanie: 3 albo 4 wloty ulic o tym samym przekroju, łuki krawężników i chodników na narożach, przejścia
 *  dla pieszych (zebra) i linie zatrzymania. arm — długość wlotu, corner — promień łuku krawężnika. */
export function buildCrossing(profile = PROFILES.city, { arms = 4, arm = 30, corner = 6 } = {}) {
  const pr = typeof profile === 'string' ? PROFILES[profile] : profile, g = new THREE.Group(); g.name = 'skrzyżowanie';
  const half = pr.lanes * pr.laneW / 2 + (pr.median || 0) / 2, R0 = half + corner;
  const ALL = [[1, 0], [0, 1], [-1, 0], [0, -1]], has = (i) => i % 4 < arms;
  // wloty: zwykłe ulice od brzegu skrzyżowania na zewnątrz, z przejściem dla pieszych i linią zatrzymania
  for (let i = 0; i < arms; i++) {
    const [dx, dz] = ALL[i], nx = -dz, nz = dx;
    g.add(buildStreet([[dx * R0, dz * R0], [dx * (R0 + arm), dz * (R0 + arm)]], pr).group);
    const zw = 4, z0 = R0 + 0.6, rot = Math.atan2(dx, dz);
    for (let o = -half + 0.5; o <= half - 0.4; o += 1) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, zw).rotateX(-Math.PI / 2), paint);
      r.position.set(dx * (z0 + zw / 2) + nx * o, 0.005, dz * (z0 + zw / 2) + nz * o); r.rotation.y = rot; r.receiveShadow = true; g.add(r);
    }
    // linia zatrzymania na pasie wjazdowym (ruch prawostronny: wjazd po prawej stronie wlotu, patrząc do środka)
    const stop = new THREE.Mesh(new THREE.PlaneGeometry(half - 0.3, 0.5).rotateX(-Math.PI / 2), paint);
    stop.position.set(dx * (z0 + zw + 1.2) + nx * (half / 2), 0.005, dz * (z0 + zw + 1.2) + nz * (half / 2)); stop.rotation.y = rot; stop.receiveShadow = true; g.add(stop);
  }
  // środek: kwadrat jezdni do początku wlotów (naroża przykryte chodnikiem)
  const road = surface(pr.road), sq = new THREE.PlaneGeometry(2 * R0, 2 * R0).rotateX(-Math.PI / 2);
  { const uv = sq.attributes.uv, p = sq.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / road.userData.tile, p.getZ(i) / road.userData.tile); }
  g.add(mesh(sq, road, false));
  for (let i = 0; i < 4; i++) {
    const a = ALL[i], b = ALL[(i + 1) % 4], sx = a[0] + b[0], sz = a[1] + b[1], cx = sx * R0, cz = sz * R0;
    if (has(i) && has(i + 1)) {
      // naroże między dwoma wlotami: pasy przekroju po łuku wokół (cx, cz), od krawężnika (r = corner) do środka
      const a0 = Math.atan2(0, -sx), a1 = Math.atan2(-sz, 0);
      let A0 = a0, A1 = a1; if (Math.abs(A1 - A0) > Math.PI) { if (A1 < A0) A1 += 2 * Math.PI; else A0 += 2 * Math.PI; }
      let r = corner, yPrev = 0;
      for (const st of pr.strips) {
        const m = st.k === 'curb' ? surface('curb') : surface(st.s), ri = Math.max(0, r - st.w);
        g.add(mesh(ringXZ(cx, cz, ri, r, A0, A1, st.h, m.userData.tile || 1), m, st.k === 'curb'));
        if (Math.abs(st.h - yPrev) > 0.005) g.add(mesh(arcWall(cx, cz, r, A0, A1, Math.min(st.h, yPrev), Math.max(st.h, yPrev), st.h > yPrev ? 1 : -1), surface('curb')));
        yPrev = st.h; r = ri; if (r <= 0) break;
      }
      const last = pr.strips[pr.strips.length - 1];
      if (r > 0) g.add(mesh(ringXZ(cx, cz, 0, r, A0, A1, last.h, 2), surface(last.s || 'grass'), false));
    } else if (has(i) !== has(i + 1)) {
      // bok bez wlotu (skrzyżowanie T): prosty chodnik wzdłuż brzegu skrzyżowania
      const e = has(i) ? b : a, n = [-e[0], -e[1]], t = [e[1], -e[0]];
      const p0 = [e[0] * half + t[0] * R0, e[1] * half + t[1] * R0], p1 = [e[0] * half - t[0] * R0, e[1] * half - t[1] * R0];
      if (has(i)) g.add(buildStreet([p1, p0], { ...pr, lanes: 0, laneW: 0, marks: null, noRoad: true, side: 1 }).group);
    }
  }
  return { group: g, size: 2 * (R0 + arm) };
}

/* ---------------- sygnalizator świetlny ---------------- */
// Sygnalizator dla pojazdów: słup ocynkowany (opcjonalnie z wysięgnikiem nad jezdnię), komora z trzema komorami
// soczewek 300 mm (czerwone u góry, żółte, zielone), daszki nad soczewkami, tarcza tła z białą obwódką. Soczewki świecą
// (emisja ponad 1 — poświata w potoku kamery); zgaszone są ciemne, z odcieniem swojej barwy.
// Cykl jak w Polsce: zielone → żółte → czerwone → czerwone z żółtym → zielone; nocą żółte migające.
//   buildTrafficLight({ arm: 0 (m wysięgnika, w −x), height: 3.2 (m do dołu komory), backplate: true }) → { group, set(stan), state }
//   przód sygnału: +z (stronę, z której nadjeżdżają pojazdy)
//   SIGNAL_STATES  red | redYellow | green | yellow | yellowBlink | off
//   signalAt(t, { green, yellow, red, redYellow }, offset) → stan w chwili t [s] (cykl z czasami faz)
export const SIGNAL_STATES = { red: 'Czerwone', redYellow: 'Czerwone z żółtym', green: 'Zielone', yellow: 'Żółte', yellowBlink: 'Żółte migające', off: 'Wyłączone' };
// dwie fazy na przemian (skrzyżowanie): czerwone = zielone + żółte + czerwone z żółtym + 2 × 2 s „wszystkie czerwone”;
// faza B przesunięta o pół cyklu (SIGNAL_TIMES.half)
export const SIGNAL_TIMES = { green: 20, yellow: 3, red: 28.5, redYellow: 1.5, half: 26.5 };
export function signalAt(t, T = SIGNAL_TIMES, offset = 0) {
  const total = T.green + T.yellow + T.red + T.redYellow;
  let x = ((t + offset) % total + total) % total;
  if ((x -= T.green) < 0) return 'green';
  if ((x -= T.yellow) < 0) return 'yellow';
  if ((x -= T.red) < 0) return 'red';
  return 'redYellow';
}
const steel = () => new THREE.MeshStandardMaterial({ color: 0x9aa0a3, roughness: 0.45, metalness: 0.85 });
const housingMat = () => new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.55, metalness: 0.2 });
const LENS = { red: 0xff2a14, yellow: 0xffb01a, green: 0x1aff8a };
export function buildTrafficLight({ arm = 0, height = 3.2, backplate = true } = {}) {
  const g = new THREE.Group(); g.name = 'sygnalizator';
  const st = steel(), hm = housingMat();
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const L = 0.3, gap = 0.04, Hh = 3 * L + 4 * gap, W = L + 2 * gap, D = 0.24;   // komora: 3 soczewki 300 mm
  const top = height + Hh + 0.15;
  // słup z podstawą (stopa) i ewentualnie wysięgnik
  add(new THREE.CylinderGeometry(0.11, 0.13, 0.35, 16), st, 0, 0.175, 0);
  add(new THREE.CylinderGeometry(0.07, 0.085, top + (arm ? 1.2 : 0), 16), st, 0, (top + (arm ? 1.2 : 0)) / 2, 0);
  let hx = 0, hy = height, hz = 0.18;                                                   // gdzie wisi komora (przód: +z)
  if (arm > 0) {
    const ay = top + 0.9;
    // wysięgnik w −x: słup stoi po prawej stronie jezdni (ruch prawostronny), wysięgnik idzie nad pasy w lewo
    const a = add(new THREE.CylinderGeometry(0.055, 0.065, arm, 12), st, -arm / 2, ay, 0); a.rotation.z = Math.PI / 2;
    const brace = add(new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(arm * 0.45, 0.8), 8), st, -arm * 0.22, ay - 0.4, 0); brace.rotation.z = -Math.atan2(arm * 0.45, 0.8);
    hx = -(arm - 0.4); hy = ay - 0.15 - Hh; hz = 0;
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), st, hx, ay - 0.08, 0);
  } else {
    add(new THREE.BoxGeometry(0.08, 0.06, 0.18), st, 0, height + Hh * 0.8, 0.09);       // uchwyty komory
    add(new THREE.BoxGeometry(0.08, 0.06, 0.18), st, 0, height + Hh * 0.2, 0.09);
  }
  const head = new THREE.Group(); head.position.set(hx, hy, hz); g.add(head);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, D), hm); hb.position.set(0, Hh / 2, 0); hb.castShadow = true; head.add(hb);
  if (backplate) {
    // tarcza tła: czarna z białą obwódką (lepiej widać sygnał pod słońce)
    const bp = new THREE.Mesh(new THREE.BoxGeometry(W + 0.26, Hh + 0.26, 0.015), new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.7 })); bp.position.set(0, Hh / 2, -D / 2 - 0.01); head.add(bp);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, Hh + 0.3, 0.01), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 })); rim.position.set(0, Hh / 2, -D / 2 - 0.02); head.add(rim);
  }
  const lenses = {};
  ['red', 'yellow', 'green'].forEach((c, i) => {
    const y = Hh - gap - L / 2 - i * (L + gap);
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(LENS[c]).multiplyScalar(0.12), roughness: 0.15, metalness: 0, emissive: LENS[c], emissiveIntensity: 0 });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(L * 0.46, 28), m); lens.position.set(0, y, D / 2 + 0.002); head.add(lens);
    const ring = new THREE.Mesh(new THREE.RingGeometry(L * 0.46, L * 0.5, 28), hm); ring.position.set(0, y, D / 2 + 0.003); head.add(ring);
    // daszek nad soczewką (pół rury)
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.52, L * 0.52, 0.2, 20, 1, true, -Math.PI / 2, Math.PI), hm);
    visor.rotation.x = Math.PI / 2; visor.position.set(0, y, D / 2 + 0.1); visor.material = hm.clone(); visor.material.side = THREE.DoubleSide; visor.castShadow = true; head.add(visor);
    lenses[c] = m;
  });
  const glow = new THREE.PointLight(0xffffff, 0, 6, 2); glow.position.set(0, Hh / 2, D / 2 + 0.4); head.add(glow);
  const on = { red: ['red'], redYellow: ['red', 'yellow'], green: ['green'], yellow: ['yellow'], yellowBlink: ['yellow'], off: [] };
  const api = {
    group: g, head, state: 'off',
    set(state, t = 0) {
      api.state = state;
      const lit = state === 'yellowBlink' && (t % 1.2) > 0.6 ? [] : on[state] || [];
      for (const c of ['red', 'yellow', 'green']) lenses[c].emissiveIntensity = lit.includes(c) ? 4.5 : 0;
      glow.intensity = lit.length ? 0.6 : 0; if (lit.length) glow.color.setHex(LENS[lit[lit.length - 1]]);
    },
  };
  api.set('red');
  return api;
}

/* ---------------- latarnie ---------------- */
// Latarnie uliczne (przód oprawy: +z — w stronę jezdni). on(true) zapala: oprawa świeci, światło pada w dół na ulicę.
//   LAMPS  modern — współczesna LED, słup ocynkowany 8 m z wysięgnikiem; double — dwa wysięgniki (aleja, pas dzielący);
//          park — stylizowana parkowa, żeliwny słup 4 m z latarnią (ciepłe światło); old — stara betonowa (PRL) 9 m
//          z oprawą sodową (pomarańczowe światło)
//   buildLamp(type) → { group, on(true | false), light }
export const LAMPS = {
  modern: { label: 'Współczesna LED', h: 8, color: 0xf2f4ff, temp: [0.95, 0.97, 1] },
  double: { label: 'Podwójna (aleja)', h: 9, color: 0xf2f4ff, temp: [0.95, 0.97, 1] },
  park: { label: 'Parkowa stylizowana', h: 4, color: 0xffd9a0, temp: [1, 0.82, 0.6] },
  old: { label: 'Stara betonowa (sodowa)', h: 9, color: 0xffa23a, temp: [1, 0.6, 0.22] },
};
export function buildLamp(type = 'modern') {
  const T = LAMPS[type] || LAMPS.modern, g = new THREE.Group(); g.name = 'latarnia: ' + T.label;
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const glass = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: T.color, emissiveIntensity: 0, roughness: 0.3 });
  const heads = [];
  if (type === 'park') {
    const iron = new THREE.MeshStandardMaterial({ color: 0x1d2420, roughness: 0.6, metalness: 0.6 });
    add(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 12), iron, 0, 0.3, 0);
    add(new THREE.CylinderGeometry(0.05, 0.07, T.h - 0.6, 12), iron, 0, 0.3 + (T.h - 0.6) / 2, 0);
    for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.075, 0.015, 6, 14).rotateX(Math.PI / 2), iron, 0, 1 + i * 1.1, 0);
    add(new THREE.CylinderGeometry(0.12, 0.08, 0.12, 6), iron, 0, T.h + 0.06, 0);
    const lan = add(new THREE.CylinderGeometry(0.2, 0.13, 0.45, 6), glass, 0, T.h + 0.35, 0); heads.push(lan);
    add(new THREE.ConeGeometry(0.28, 0.25, 6), iron, 0, T.h + 0.7, 0);
    add(new THREE.SphereGeometry(0.04, 8, 6), iron, 0, T.h + 0.86, 0);
  } else if (type === 'old') {
    const conc = new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 0.9 });
    add(new THREE.BoxGeometry(0.22, T.h, 0.18).translate(0, 0, 0), conc, 0, T.h / 2, 0);
    const arm = add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), steel(), 0, T.h - 0.1, 0.75); arm.rotation.x = Math.PI / 2 - 0.15;
    const hous = add(new THREE.BoxGeometry(0.3, 0.14, 0.6), new THREE.MeshStandardMaterial({ color: 0x6d7378, roughness: 0.6, metalness: 0.3 }), 0, T.h, 1.5);
    const gl = add(new THREE.BoxGeometry(0.26, 0.04, 0.5), glass, 0, T.h - 0.08, 1.5); heads.push(gl); hous.rotation.x = 0.15; gl.rotation.x = 0.15;
  } else {
    const st = steel();
    add(new THREE.CylinderGeometry(0.1, 0.13, 0.5, 12), st, 0, 0.25, 0);
    add(new THREE.CylinderGeometry(0.055, 0.09, T.h, 12), st, 0, T.h / 2, 0);
    const sides = type === 'double' ? [1, -1] : [1];
    for (const sd of sides) {
      const arm = add(new THREE.CylinderGeometry(0.035, 0.04, 1.8, 10), st, 0, T.h + 0.15, sd * 0.85); arm.rotation.x = Math.PI / 2 - sd * 0.12;
      const hous = add(new THREE.BoxGeometry(0.28, 0.08, 0.62), new THREE.MeshStandardMaterial({ color: 0x5b6166, roughness: 0.4, metalness: 0.6 }), 0, T.h + 0.28, sd * 1.75);
      const gl = add(new THREE.BoxGeometry(0.24, 0.02, 0.5), glass, 0, T.h + 0.23, sd * 1.75); heads.push(gl);
      hous.rotation.x = -sd * 0.08; gl.rotation.x = -sd * 0.08;
    }
  }
  // światło w dół spod oprawy (jedno na latarnię; cienie wyłączone — dziesiątki latarni)
  const p = heads[0].position, light = new THREE.SpotLight(T.color, 0, T.h * 3.2, 1.05, 0.6, 2);
  light.position.set(type === 'double' ? 0 : p.x, p.y - 0.05, type === 'double' ? 0 : p.z); light.target.position.set(light.position.x, 0, light.position.z + (type === 'park' || type === 'double' ? 0 : 0.6));
  g.add(light, light.target);
  return {
    group: g, light,
    on(v = true) { glass.emissiveIntensity = v ? (type === 'old' ? 2.4 : 2) : 0; light.intensity = v ? T.h * T.h * (type === 'park' ? 0.9 : type === 'double' ? 2 : 1.3) : 0; },
  };
}

/* ---------------- znaki drogowe ---------------- */
// Polskie znaki drogowe (rozporządzenie o znakach i sygnałach): ostrzegawcze A (trójkąt, żółte tło, czerwona obwódka),
// zakazu B (koło z czerwoną obwódką), nakazu C (niebieskie koło), informacyjne D (niebieski prostokąt). Tarcza
// rysowana na płótnie, z białym odblaskowym brzegiem; tył szary; słupek ocynkowany Ø 60 mm. Wymiary jak znaki średnie.
//   SIGNS   id → { code, label }
//   buildSign(id, { height, tab }) → { group }   (przód: +z; tab 'T-29' — tabliczka „osoba na wózku” pod znakiem)
export const SIGNS = {
  'A-7': { code: 'A-7', label: 'Ustąp pierwszeństwa' }, 'A-16': { code: 'A-16', label: 'Przejście dla pieszych (ostrzegawczy)' },
  'A-17': { code: 'A-17', label: 'Dzieci' }, 'B-1': { code: 'B-1', label: 'Zakaz ruchu w obu kierunkach' }, 'B-2': { code: 'B-2', label: 'Zakaz wjazdu' },
  'B-20': { code: 'B-20', label: 'Stop' }, 'B-33': { code: 'B-33', label: 'Ograniczenie prędkości 50' }, 'B-36': { code: 'B-36', label: 'Zakaz zatrzymywania się' },
  'C-12': { code: 'C-12', label: 'Ruch okrężny' }, 'C-13': { code: 'C-13', label: 'Droga dla rowerów' }, 'D-1': { code: 'D-1', label: 'Droga z pierwszeństwem' },
  'D-6': { code: 'D-6', label: 'Przejście dla pieszych' }, 'D-18': { code: 'D-18', label: 'Parking' },
};
const RED = '#c8102e', YEL = '#f6b800', BLU = '#0050a0';
function pedestrian(c, x, y, s, col) {   // pieszy (piktogram)
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = s * 0.13;
  c.beginPath(); c.arc(x + s * 0.05, y - s * 0.42, s * 0.1, 0, 7); c.fill();
  c.beginPath(); c.moveTo(x + s * 0.02, y - s * 0.28); c.lineTo(x - s * 0.04, y + s * 0.05); c.lineTo(x - s * 0.2, y + s * 0.4); c.moveTo(x - s * 0.04, y + s * 0.05); c.lineTo(x + s * 0.16, y + s * 0.4);
  c.moveTo(x + s * 0.0, y - s * 0.22); c.lineTo(x - s * 0.2, y - s * 0.02); c.moveTo(x + s * 0.0, y - s * 0.22); c.lineTo(x + s * 0.2, y - s * 0.05); c.stroke();
}
function bicycle(c, x, y, s, col) {
  c.strokeStyle = col; c.lineWidth = s * 0.07;
  for (const dx of [-0.28, 0.28]) { c.beginPath(); c.arc(x + dx * s, y + s * 0.12, s * 0.2, 0, 7); c.stroke(); }
  c.beginPath(); c.moveTo(x - s * 0.28, y + s * 0.12); c.lineTo(x - s * 0.05, y - s * 0.15); c.lineTo(x + s * 0.2, y - s * 0.15); c.lineTo(x + s * 0.28, y + s * 0.12); c.moveTo(x - s * 0.05, y - s * 0.15); c.lineTo(x + s * 0.02, y + s * 0.12); c.lineTo(x + s * 0.2, y - s * 0.15); c.stroke();
}
function signFace(id) {
  const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d'), m = N / 2;
  const tri = (up) => { c.beginPath(); if (up) { c.moveTo(m, 30); c.lineTo(N - 20, N - 60); c.lineTo(20, N - 60); } else { c.moveTo(20, 60); c.lineTo(N - 20, 60); c.lineTo(m, N - 30); } c.closePath(); };
  const circ = (r) => { c.beginPath(); c.arc(m, m, r, 0, 7); };
  let shape = 'circle';
  if (id.startsWith('A-')) {
    shape = id === 'A-7' ? 'triDown' : 'tri';
    c.lineJoin = 'round';
    tri(id !== 'A-7'); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 28; c.strokeStyle = '#fff'; c.stroke();
    tri(id !== 'A-7'); c.lineWidth = 44; c.strokeStyle = RED; c.save(); c.clip(); c.stroke(); c.restore();
    c.save(); tri(id !== 'A-7'); c.clip(); c.beginPath(); c.fillStyle = YEL; c.globalCompositeOperation = 'source-over';
    // żółte wnętrze (wewnątrz czerwonej obwódki)
    c.translate(m, id === 'A-7' ? m - 40 : m + 40); c.scale(0.74, 0.74); c.translate(-m, -(id === 'A-7' ? m - 40 : m + 40)); tri(id !== 'A-7'); c.fill(); c.restore();
    if (id === 'A-16') pedestrian(c, m, m + 70, 200, '#111');
    if (id === 'A-17') { pedestrian(c, m - 45, m + 85, 150, '#111'); pedestrian(c, m + 50, m + 95, 120, '#111'); }
  } else if (id.startsWith('B-')) {
    if (id === 'B-20') {
      shape = 'oct';
      c.beginPath(); for (let k = 0; k < 8; k++) { const t = Math.PI / 8 + k * Math.PI / 4; c.lineTo(m + Math.cos(t) * 245, m + Math.sin(t) * 245); } c.closePath(); c.fillStyle = '#fff'; c.fill();
      c.beginPath(); for (let k = 0; k < 8; k++) { const t = Math.PI / 8 + k * Math.PI / 4; c.lineTo(m + Math.cos(t) * 225, m + Math.sin(t) * 225); } c.closePath(); c.fillStyle = RED; c.fill();
      c.fillStyle = '#fff'; c.font = 'bold 150px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('STOP', m, m + 8);
    } else {
      circ(250); c.fillStyle = '#fff'; c.fill();
      circ(232); c.fillStyle = id === 'B-36' ? BLU : id === 'B-2' ? RED : '#fff'; c.fill();
      circ(232); c.lineWidth = 50; c.strokeStyle = RED; c.save(); c.clip(); c.stroke(); c.restore();
      if (id === 'B-2') { c.fillStyle = '#fff'; c.fillRect(m - 150, m - 36, 300, 72); }
      if (id === 'B-33') { c.fillStyle = '#111'; c.font = 'bold 220px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('50', m, m + 12); }
      if (id === 'B-36') { c.save(); circ(205); c.clip(); c.strokeStyle = RED; c.lineWidth = 46; c.beginPath(); c.moveTo(m - 170, m - 170); c.lineTo(m + 170, m + 170); c.moveTo(m + 170, m - 170); c.lineTo(m - 170, m + 170); c.stroke(); c.restore(); }
    }
  } else if (id.startsWith('C-')) {
    circ(250); c.fillStyle = '#fff'; c.fill(); circ(236); c.fillStyle = BLU; c.fill();
    if (id === 'C-13') bicycle(c, m, m, 330, '#fff');
    if (id === 'C-12') { c.strokeStyle = '#fff'; c.lineWidth = 40; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(m, m, 120, k * 2.094 + 0.3, k * 2.094 + 1.6); c.stroke(); const t = k * 2.094 + 1.6; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(m + Math.cos(t) * 165, m + Math.sin(t) * 165); c.lineTo(m + Math.cos(t) * 75, m + Math.sin(t) * 75); c.lineTo(m + Math.cos(t + 0.45) * 120, m + Math.sin(t + 0.45) * 120); c.fill(); } }
  } else if (id === 'D-1') {
    shape = 'diamond';
    const d = (r) => { c.beginPath(); c.moveTo(m, m - r); c.lineTo(m + r, m); c.lineTo(m, m + r); c.lineTo(m - r, m); c.closePath(); };
    d(250); c.fillStyle = '#fff'; c.fill(); d(225); c.fillStyle = '#111'; c.fill(); d(205); c.fillStyle = '#fff'; c.fill(); d(150); c.fillStyle = YEL; c.fill();
  } else {
    shape = 'square';
    c.fillStyle = '#fff'; c.fillRect(0, 0, N, N); c.fillStyle = BLU; c.fillRect(16, 16, N - 32, N - 32);
    if (id === 'D-6') { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(m, 70); c.lineTo(N - 60, N - 80); c.lineTo(60, N - 80); c.closePath(); c.fill(); pedestrian(c, m, m + 70, 210, '#111'); for (let k = 0; k < 5; k++) { c.fillStyle = '#111'; c.fillRect(120 + k * 58, N - 120, 32, 22); } }
    if (id === 'D-18') { c.fillStyle = '#fff'; c.font = 'bold 380px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', m, m + 20); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, shape };
}
const signCache = new Map();
// tabliczka T-29 (osoba na wózku) pod znakiem: biała z czarną obwódką
let t29 = null;
function plateT29() {
  if (!t29) t29 = canvasTex(256, 160, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#111'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20); wheelchair(c, w / 2, h / 2 + 4, 120, '#1f5fa8'); }, false);
  return t29;
}
export function buildSign(id = 'B-20', { height = 2.2, tab = null } = {}) {
  const g = new THREE.Group(); g.name = 'znak ' + id;
  if (!signCache.has(id)) signCache.set(id, signFace(id));
  const { tex, shape } = signCache.get(id);
  const size = shape === 'tri' || shape === 'triDown' ? 0.9 : shape === 'diamond' ? 0.85 : 0.6;   // znaki średnie
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, height + size * 0.5, 10), steel());
  post.position.y = (height + size * 0.5) / 2; post.castShadow = true; g.add(post);
  // tarcza: kształt znaku wycięty z kwadratu (przezroczystość z obrazu) + szary tył
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.45, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06 }));
  plate.position.set(0, height + size * 0.15, 0.04); plate.castShadow = true; g.add(plate);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: 0.5, metalness: 0.6, alphaMap: alphaOf(id, tex), transparent: true, alphaTest: 0.5 }));
  back.rotation.y = Math.PI; back.position.set(0, height + size * 0.15, 0.035); g.add(back);
  for (const dy of [-0.18, 0.18]) { const cl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.05), steel()); cl.position.set(0, height + size * 0.15 + dy * size, 0.015); g.add(cl); }
  if (tab === 'T-29') {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), new THREE.MeshStandardMaterial({ map: plateT29(), roughness: 0.45, emissive: 0xffffff, emissiveMap: plateT29(), emissiveIntensity: 0.06 }));
    pl.position.set(0, height + size * 0.15 - size / 2 - 0.17, 0.04); g.add(pl);
    const bk = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: 0.5, metalness: 0.6 })); bk.rotation.y = Math.PI; bk.position.copy(pl.position).setZ(0.035); g.add(bk);
  }
  return { group: g, size };
}
// maska kształtu tarczy (biały — tarcza) z kanału alfa obrazu znaku
const alphaCache = new Map();
function alphaOf(id, tex) {
  if (alphaCache.has(id)) return alphaCache.get(id);
  const src = tex.image, cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  c.drawImage(src, 0, 0, 128, 128); const d = c.getImageData(0, 0, 128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const a = d.data[i + 3]; d.data[i] = d.data[i + 1] = d.data[i + 2] = a; d.data[i + 3] = 255; }
  c.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(cv); alphaCache.set(id, t); return t;
}

// punkty co `every` m wzdłuż linii, odsunięte o `offset` m w lewo (ujemne — w prawo), z kątem obrotu do osi trasy
// (przód obiektu +z patrzy na oś) → [{ x, z, rot }]
export function alongStreet(points, every = 30, offset = 8, start = every / 2) {
  const S = sample(points, 0.5), out = [];
  for (let d = start; d < S.L; d += every) {
    const q = S.pts.reduce((b, p) => (Math.abs(p.s - d) < Math.abs(b.s - d) ? p : b), S.pts[0]);
    const x = q.p.x + q.nx * offset, z = q.p.z + q.nz * offset;
    out.push({ x, z, rot: Math.atan2(-q.nx * Math.sign(offset), -q.nz * Math.sign(offset)) });
  }
  return out;
}

/* ---------------- wiadukty ---------------- */
// Wiadukt: trasa z wysokością ([x, z, y]) na pomoście — płyta pomostu (spód i boki z betonu), bariery betonowe
// z poręczą stalową po obu stronach, a pod spodem: nasyp ze skarpami (tam, gdzie pomost jest nisko) albo filary
// z oczepem (dwa słupy Ø 1,2 m i belka pod pomostem) co `pierEvery` m tam, gdzie jest wysoko. avoid(x, z) — gdzie nie
// stawiać filarów (np. jezdnia pod wiaduktem).
//   VIADUCT_PROFILE   przekrój pomostu: dwa pasy 3,5 m, krawężnik, wąski chodnik
//   buildViaduct(points3, profile, { pierEvery, deck, fillBelow, avoid, rail }) → { group, length, width, barrierTop, barrierAt }
//   rail: false — bez poręczy (np. gdy na barierze stoi ekran); barrierTop — wysokość korony bariery nad trasą,
//   barrierAt — odsunięcie środka bariery od osi
export const VIADUCT_PROFILE = { label: 'Pomost wiaduktu', lanes: 2, laneW: 3.5, road: 'asphalt', marks: { center: 'solid', edge: true },
  strips: [{ k: 'curb', w: 0.15, h: 0.18 }, { k: 'sidewalk', w: 1.3, h: 0.18, s: 'slabs' }] };
const concrete = () => surface('concrete');
SURFACES.concrete = SURFACES.concrete || { label: 'Beton', kind: 'concrete', color: '#a9a69c', color2: '#8a877e', tile: 3, roughness: 0.9, metalness: 0, pores: 0.5, wear: 0.15, dirt: 0.35 };
export function buildViaduct(points, profile = VIADUCT_PROFILE, { pierEvery = 24, deck = 1.3, fillBelow = 5, avoid = null, rail = true } = {}) {
  const pr = typeof profile === 'string' ? PROFILES[profile] : profile;
  const st = buildStreet(points, pr), g = st.group, S = sample(points, 0.5);
  g.name = 'wiadukt';
  const half = st.width / 2, top = pr.strips.length ? pr.strips[pr.strips.length - 1].h : 0, B = 0.42, BH = 0.95;
  const con = concrete(), grass = surface('sod').clone(); grass.side = THREE.DoubleSide;   // skarpy (darń z ziemią) widać z obu stron
  // bariery betonowe na brzegach pomostu (wewnętrzne lico, góra, zewnętrzne lico do spodu płyty) i poręcz
  for (const sd of [-1, 1]) {
    const o0 = sd * half, o1 = sd * (half + B);
    g.add(mesh(wall(S, o0, top, top + BH, -sd, 1), con));
    g.add(mesh(ribbon(S, o0, o1, top + BH, con.userData.tile || 3), con));
    g.add(mesh(wall(S, o1, -deck, top + BH, sd, 1), con));
    if (rail) g.add(mesh(ribbon(S, sd * (half + B * 0.35), sd * (half + B * 0.65), top + BH + 0.25, 1), steel()));
    if (rail) for (let d = 0; d < S.L; d += 2) { const q = S.pts[Math.min(S.pts.length - 1, Math.round(d / 0.5))]; const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), steel()); post.position.set(q.p.x + q.nx * sd * (half + B / 2), q.p.y + top + BH + 0.12, q.p.z + q.nz * sd * (half + B / 2)); g.add(post); }
  }
  // spód płyty pomostu
  g.add(mesh(slope(S, half + B, -deck, -(half + B), -deck, 3, true), con));
  // pod spodem: nasyp (nisko) albo filary (wysoko); przejście — ściana przyczółka
  const fill = S.pts.map((q) => q.p.y < fillBelow);
  let run = [];
  const flush = () => {
    if (run.length > 1) {
      // skarpa: od brzegu pomostu do gruntu, odsunięcie z wysokością (nachylenie 1 : 1,5) — liczone na każdą próbkę
      for (const sd of [-1, 1]) {
        const P = [], N = [], U = [], I = [];
        run.forEach((q, i) => {
          const h = Math.max(0, q.p.y - deck), a = sd * (half + B), b = sd * (half + B + h * 1.5 + 0.3);
          P.push(q.p.x + q.nx * a, q.p.y - deck, q.p.z + q.nz * a, q.p.x + q.nx * b, 0, q.p.z + q.nz * b); N.push(0, 1, 0, 0, 1, 0); U.push(0, q.s / 2, (h * 1.8) / 2, q.s / 2);
          if (i) { const k = i * 2; if (sd > 0) I.push(k - 2, k, k - 1, k - 1, k, k + 1); else I.push(k - 2, k - 1, k, k - 1, k + 1, k); }
        });
        const sg = geo(P, N, U, I); sg.computeVertexNormals(); g.add(mesh(sg, grass, false));
      }
    }
    run = [];
  };
  S.pts.forEach((q, i) => { if (fill[i] && q.p.y > deck * 0.3) run.push(q); else flush(); });
  flush();
  // ściany przyczółków tam, gdzie nasyp przechodzi w filary
  for (let i = 1; i < S.pts.length; i++) if (fill[i] !== fill[i - 1]) {
    const q = S.pts[i], h = Math.max(0.1, q.p.y - deck), w = 2 * (half + B) + h * 3;
    const ab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.8), con); ab.position.set(q.p.x, h / 2, q.p.z); ab.rotation.y = Math.atan2(q.t.x, q.t.z); ab.castShadow = ab.receiveShadow = true; g.add(ab);
  }
  // filary z oczepem
  for (let d = pierEvery / 2; d < S.L; d += pierEvery) {
    const q = S.pts[Math.min(S.pts.length - 1, Math.round(d / 0.5))]; if (q.p.y < fillBelow) continue;
    if (avoid && avoid(q.p.x, q.p.z)) continue;
    const h = q.p.y - deck, rot = Math.atan2(q.t.x, q.t.z), off = half - 1.4;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2 * half, 1.0, 1.6), con); cap.position.set(q.p.x, h - 0.5, q.p.z); cap.rotation.y = rot; cap.castShadow = cap.receiveShadow = true; g.add(cap);
    for (const sd of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.65, h - 1, 20), con); c.position.set(q.p.x + q.nx * sd * off, (h - 1) / 2, q.p.z + q.nz * sd * off); c.castShadow = c.receiveShadow = true; g.add(c); }
  }
  return { group: g, length: S.L, width: 2 * (half + B), barrierTop: top + BH, barrierAt: half + B / 2 };
}

/* ---------------- słupki, barierki, ekrany dźwiękochłonne ---------------- */
// Wszystko wzdłuż linii trasy (punkty jak w buildStreet, także [x, z, y]), przy odsunięciu `offset` m od osi (dodatnie —
// w lewo), na wysokości `y` nad trasą (np. wysokość chodnika).
//   BOLLARDS  steel — stalowy słupek blokujący Ø 114 mm, 1 m, z białymi pasami odblaskowymi; warsaw — żeliwny grafitowy
//             z pierścieniem i głowicą kulistą; concrete — betonowy walec Ø 0,6 m; delineator — słupek prowadzący U-1a
//             (biały, czarna opaska z odblaskiem) przy drogach poza miastem; chain — żeliwne słupki połączone stalowym
//             łańcuchem (ogniwa 6 cm, zwis 12 cm)
//   buildBollards(points, type, { offset, every, y, start }) → { group, count }
//   RAILS     u12a — barierka ochronna dla pieszych U-12a (rury Ø 60 w czerwono-białe pasy, 1,1 m); city — miejska
//             grafitowa z prętami pionowymi (1 m); guardrail — bariera energochłonna stalowa (prowadnica falista na
//             słupkach co 2 m, przekładki dystansowe) — prowadnica od strony jezdni
//   buildRail(points, type, { offset, y }) → { group, length }
//   NOISE     metal — kasety pochłaniające (aluminium, perforowane lico); glass — przezroczyste płyty PMMA z pionowymi
//             pasami przeciw ptakom; mixed — dół z kaset, góra przezroczysta. Słupy HEB 200 co 4 m, cokół betonowy 0,5 m
//   buildNoiseWall(points, type, { offset, height, y, plinth }) → { group, length }   plinth 0 — bez cokołu (na barierze)
export const BOLLARDS = {
  steel: { label: 'Stalowy blokujący', every: 1.5 }, warsaw: { label: 'Żeliwny grafitowy', every: 1.5 },
  chain: { label: 'Żeliwne z łańcuchem', every: 2 }, concrete: { label: 'Betonowy walec', every: 2 }, delineator: { label: 'Prowadzący U-1a', every: 25 },
};
export const RAILS = { u12a: { label: 'Ochronna U-12a (czerwono-biała)' }, city: { label: 'Miejska grafitowa' }, guardrail: { label: 'Bariera energochłonna (stalowa)' } };
export const NOISE = { metal: { label: 'Kasety pochłaniające' }, glass: { label: 'Przezroczysty (PMMA)' }, mixed: { label: 'Kasety z przeszkleniem u góry' } };

const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
// stanowiska co `every` m: macierze (lokalne +x wzdłuż trasy, +z w lewo od osi)
function stations(S, offset, every, start = every / 2, y = 0) {
  const out = [], step = S.L / (S.pts.length - 1);
  for (let d = start; d <= S.L + 1e-6; d += every) {
    const q = S.pts[Math.min(S.pts.length - 1, Math.round(d / step))];
    out.push(new THREE.Matrix4().compose(new THREE.Vector3(q.p.x + q.nx * offset, q.p.y + y, q.p.z + q.nz * offset), new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(-q.t.z, q.t.x)), ONE));
  }
  return out;
}
function inst(g, m, M, shadow = true) {
  const o = new THREE.InstancedMesh(g, m, Math.max(1, M.length)); o.count = M.length;
  M.forEach((x, i) => o.setMatrixAt(i, x)); o.castShadow = shadow; o.receiveShadow = true; o.computeBoundingSphere(); return o;
}
// rura wzdłuż linii przy odsunięciu, na wysokości y
function tubeAlong(S, offset, y, r, m) {
  const pts = S.pts.filter((_, i) => i % 4 === 0 || i === S.pts.length - 1).map((q) => new THREE.Vector3(q.p.x + q.nx * offset, q.p.y + y, q.p.z + q.nz * offset));
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(2, pts.length * 2), r, 8), m);
}
// przekrój [[dn, dy], …] przeciągnięty po linii; dn liczone w stronę `side` (±1 w odsunięciach)
// tile — metry na kafelek tekstury (wtedy v liczone po długości przekroju), bez — v od 0 do 1
function sweep(S, prof, offset, y, side, tile = 0) {
  const P = [], N = [], U = [], I = [], m = prof.length, len = [0];
  for (let j = 1; j < m; j++) len.push(len[j - 1] + Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]));
  S.pts.forEach((q, i) => {
    prof.forEach(([dn, dy], j) => { const o = offset + side * dn; P.push(q.p.x + q.nx * o, q.p.y + y + dy, q.p.z + q.nz * o); N.push(0, 1, 0); U.push(tile ? q.s / tile : q.s, tile ? len[j] / tile : j / (m - 1)); });
    if (i) for (let j = 0; j < m - 1; j++) { const a = (i - 1) * m + j, b = i * m + j; I.push(a, b, a + 1, a + 1, b, b + 1); }
  });
  const g = geo(P, N, U, I); g.computeVertexNormals(); return g;
}
const canvasTex = (w, h, draw, repeat = true) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
};
const kitMats = new Map();
function kitMat(id, make) { if (!kitMats.has(id)) kitMats.set(id, make()); return kitMats.get(id); }

/** Słupki wzdłuż linii. */
export function buildBollards(points, type = 'steel', { offset = 0, every, y = 0, start } = {}) {
  const T = BOLLARDS[type] || BOLLARDS.steel, S = sample(points, 0.5), g = new THREE.Group(); g.name = 'słupki: ' + T.label;
  every = every || T.every;
  const M = stations(S, offset, every, start ?? every / 2, y);
  const white = kitMat('refl', () => new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.08 }));
  if (type === 'warsaw' || type === 'chain') {
    const iron = kitMat('iron', () => new THREE.MeshStandardMaterial({ color: 0x2b2f31, roughness: 0.55, metalness: 0.55 }));
    g.add(inst(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 16).translate(0, 0.06, 0), iron, M));
    g.add(inst(new THREE.CylinderGeometry(0.065, 0.08, 0.86, 16).translate(0, 0.55, 0), iron, M));
    g.add(inst(new THREE.TorusGeometry(0.072, 0.014, 6, 16).rotateX(Math.PI / 2).translate(0, 0.84, 0), iron, M));
    g.add(inst(new THREE.SphereGeometry(0.075, 16, 10).translate(0, 1.0, 0), iron, M));
    if (type === 'chain') g.add(chainBetween(M, 0.74, 0.12));
  } else if (type === 'concrete') {
    const con = surface('concrete');
    g.add(inst(new THREE.CylinderGeometry(0.3, 0.3, 0.54, 24).translate(0, 0.27, 0), con, M));
    g.add(inst(new THREE.CylinderGeometry(0.25, 0.3, 0.06, 24).translate(0, 0.57, 0), con, M));
  } else if (type === 'delineator') {
    // U-1a: biały profil trapezowy 1 m nad ziemią, czarna opaska z odblaskiem od strony nadjeżdżających
    const pl = kitMat('delin', () => new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 }));
    const blk = kitMat('black', () => new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 }));
    const red = kitMat('reflRed', () => new THREE.MeshStandardMaterial({ color: 0xd8261a, roughness: 0.3, emissive: 0xff2010, emissiveIntensity: 0.25 }));
    const sh = new THREE.Shape([new THREE.Vector2(-0.06, -0.05), new THREE.Vector2(0.06, -0.05), new THREE.Vector2(0.035, 0.05), new THREE.Vector2(-0.035, 0.05)]);
    const body = (h0, h1) => new THREE.ExtrudeGeometry(sh, { depth: h1 - h0, bevelEnabled: false }).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(0, h0, 0);
    g.add(inst(body(0, 0.72), pl, M)); g.add(inst(body(0.72, 0.97), blk, M)); g.add(inst(body(0.97, 1.0), pl, M));
    g.add(inst(new THREE.BoxGeometry(0.008, 0.18, 0.04).translate(-0.061, 0.845, 0), red, M, false));
  } else {
    const st = kitMat('bollardSteel', () => new THREE.MeshStandardMaterial({ color: 0x8e9498, roughness: 0.4, metalness: 0.8 }));
    g.add(inst(new THREE.CylinderGeometry(0.057, 0.057, 0.98, 16).translate(0, 0.49, 0), st, M));
    g.add(inst(new THREE.CylinderGeometry(0.05, 0.057, 0.02, 16).translate(0, 0.99, 0), st, M));
    for (const h of [0.78, 0.9]) g.add(inst(new THREE.CylinderGeometry(0.0585, 0.0585, 0.05, 16).translate(0, h, 0), white, M, false));
  }
  return { group: g, count: M.length };
}

// łańcuch między kolejnymi słupkami: ogniwa wzdłuż zwisającej krzywej (parabola), co drugie obrócone o 90°
function chainBetween(M, h, sag) {
  const L = 0.06, out = [], a = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3(), d = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
  for (let i = 1; i < M.length; i++) {
    a.setFromMatrixPosition(M[i - 1]); b.setFromMatrixPosition(M[i]); a.y += h; b.y += h;
    const span = a.distanceTo(b), n = Math.max(2, Math.round(span / (L * 0.78)));
    const at = (u, v) => v.lerpVectors(a, b, u).setY(v.y - 4 * sag * u * (1 - u));
    for (let k = 0; k < n; k++) {
      at((k + 0.5) / n, p); at((k + 1) / n, d); d.sub(at(k / n, new THREE.Vector3())).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(X, d);
      if (k % 2) q.multiply(new THREE.Quaternion().setFromAxisAngle(X, Math.PI / 2));
      out.push(new THREE.Matrix4().compose(p.clone(), q, ONE));
    }
  }
  const link = new THREE.TorusGeometry(0.016, 0.0045, 5, 10).scale(1.55, 1, 1);
  return inst(link, kitMat('chain', () => new THREE.MeshStandardMaterial({ color: 0x8f9598, roughness: 0.35, metalness: 0.9 })), out, false);
}

/** Barierka albo bariera wzdłuż linii. */
export function buildRail(points, type = 'u12a', { offset = 0, y = 0 } = {}) {
  const S = sample(points, 0.5), g = new THREE.Group(); g.name = 'barierka: ' + (RAILS[type] || RAILS.u12a).label;
  const away = Math.sign(offset) || 1;   // na zewnątrz od osi; jezdnia po stronie −away
  if (type === 'guardrail') {
    const zn = kitMat('galv', () => new THREE.MeshStandardMaterial({ color: 0xb4b9bb, roughness: 0.38, metalness: 0.9, side: THREE.DoubleSide }));
    // prowadnica falista (profil A, wys. 0,31 m) — środek na 0,6 m, fale w stronę jezdni
    const W = [[0, -0.155], [0.02, -0.12], [0.085, -0.08], [0.06, -0.03], [0.02, 0], [0.06, 0.03], [0.085, 0.08], [0.02, 0.12], [0, 0.155]];
    g.add(mesh(sweep(S, W, offset, y + 0.6, -away), zn));
    const M = stations(S, offset + away * 0.2, 2, 1, y);
    g.add(inst(new THREE.BoxGeometry(0.1, 0.85, 0.1).translate(0, 0.425, 0), zn, M));                       // słupki sigma
    g.add(inst(new THREE.BoxGeometry(0.08, 0.3, 0.18).translate(0, 0.6, -away * 0.1), zn, M));              // przekładki
    return { group: g, length: S.L };
  }
  if (type === 'city') {
    const gr = kitMat('graphite', () => new THREE.MeshStandardMaterial({ color: 0x33383b, roughness: 0.5, metalness: 0.6 }));
    g.add(tubeAlong(S, offset, y + 1.0, 0.025, gr));
    g.add(tubeAlong(S, offset, y + 0.12, 0.015, gr));
    g.add(inst(new THREE.BoxGeometry(0.06, 1.0, 0.06).translate(0, 0.5, 0), gr, stations(S, offset, 2, 0, y)));
    g.add(inst(new THREE.CylinderGeometry(0.009, 0.009, 0.88, 6).translate(0, 0.56, 0), gr, stations(S, offset, 0.125, 0.0625, y), false));
    return { group: g, length: S.L };
  }
  // U-12a: rury w pasy czerwono-białe (po 0,5 m), słupki białe co 2 m, stopki
  const stripes = canvasTex(64, 8, (c, w, h) => { c.fillStyle = '#c8102e'; c.fillRect(0, 0, w / 2, h); c.fillStyle = '#f2f2ee'; c.fillRect(w / 2, 0, w / 2, h); }).clone();
  stripes.needsUpdate = true; stripes.repeat.set(Math.max(1, Math.round(S.L)), 1);
  const rm = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.4, metalness: 0.3 });
  const wm = kitMat('railWhite', () => new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.45, metalness: 0.3 }));
  g.add(tubeAlong(S, offset, y + 1.1, 0.03, rm), tubeAlong(S, offset, y + 0.55, 0.03, rm));
  const M = stations(S, offset, 2, 0, y);
  g.add(inst(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 10).translate(0, 0.55, 0), wm, M));
  g.add(inst(new THREE.BoxGeometry(0.14, 0.01, 0.14).translate(0, 0.005, 0), wm, M));
  return { group: g, length: S.L };
}

// kasety ekranu: tekstura na 4 × 4 m (pas 0,5 m, ciemna spoina, perforacja lica)
function cassetteTex() {
  return canvasTex(256, 256, (c, w, h) => {
    const band = h / 8;
    for (let i = 0; i < 8; i++) {
      const y0 = i * band, gr = c.createLinearGradient(0, y0, 0, y0 + band);
      gr.addColorStop(0, '#6f8a68'); gr.addColorStop(0.5, '#5d7757'); gr.addColorStop(1, '#465c42');
      c.fillStyle = gr; c.fillRect(0, y0, w, band);
      c.fillStyle = 'rgba(15,20,15,0.35)';
      for (let y = y0 + 5; y < y0 + band - 4; y += 3) for (let x = (y % 2) + 1; x < w; x += 3) c.fillRect(x, y, 1, 1);
      c.fillStyle = '#26301f'; c.fillRect(0, y0 + band - 2, w, 2);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, y0, w, 1);
    }
  });
}
function glassTex() {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = 'rgba(190,215,220,0.16)'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(20,24,26,0.85)'; for (let x = 0; x < w; x += 6.4) c.fillRect(Math.round(x), 0, 1, h);   // pasy co 10 cm
    c.fillStyle = 'rgba(120,130,135,0.9)'; c.fillRect(0, 0, w, 2); c.fillRect(0, h - 2, w, 2);               // ramka płyty
  });
}

/** Ekran dźwiękochłonny wzdłuż linii. */
export function buildNoiseWall(points, type = 'metal', { offset = 0, height = 4, y = 0, plinth = 0.5 } = {}) {
  const S = sample(points, 0.5), g = new THREE.Group(); g.name = 'ekran: ' + (NOISE[type] || NOISE.metal).label;
  const con = surface('concrete'), P0 = plinth, T = 0.12, H = Math.max(P0 + 0.5, height);
  // cokół betonowy 0,3 m
  if (P0 > 0) g.add(mesh(wall(S, offset - 0.15, y, y + P0, -1, 2), con), mesh(wall(S, offset + 0.15, y, y + P0, 1, 2), con), mesh(ribbon(S, offset - 0.15, offset + 0.15, y + P0, 2), con));
  const cas = kitMat('cassette', () => new THREE.MeshStandardMaterial({ map: cassetteTex(), roughness: 0.55, metalness: 0.35 }));
  const gl = kitMat('pmma', () => new THREE.MeshStandardMaterial({ map: glassTex(), transparent: true, depthWrite: false, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide }));
  const alu = kitMat('alu', () => new THREE.MeshStandardMaterial({ color: 0x9da3a6, roughness: 0.4, metalness: 0.8 }));
  const split = type === 'glass' ? P0 : type === 'mixed' ? Math.min(H, P0 + 2) : H;
  if (split > P0) {
    g.add(mesh(wall(S, offset - T / 2, y + P0, y + split, -1, 4), cas), mesh(wall(S, offset + T / 2, y + P0, y + split, 1, 4), cas));
    g.add(mesh(ribbon(S, offset - T / 2, offset + T / 2, y + split, 1), alu));
  }
  if (split < H) {
    const pane = mesh(wall(S, offset, y + split, y + H, 1, 4), gl, false); pane.renderOrder = 2; g.add(pane);
    g.add(mesh(ribbon(S, offset - 0.03, offset + 0.03, y + H, 1), alu));
  }
  // słupy HEB 200 co 4 m (pomalowane jak kasety)
  const post = kitMat('hebPaint', () => new THREE.MeshStandardMaterial({ color: 0x3f4d3c, roughness: 0.5, metalness: 0.5 }));
  g.add(inst(new THREE.BoxGeometry(0.2, H + 0.05, 0.2).translate(0, (H + 0.05) / 2, 0), post, stations(S, offset, 4, 0, y)));
  return { group: g, length: S.L };
}

/* ---------------- słupki pikietażowe ---------------- */
// Pikietaż drogi: słupek hektometrowy co 100 m (biały, 12 × 12 cm, 0,6 m nad ziemią, czarna cyfra hektometra 1–9
// na ścianach zwróconych wzdłuż drogi) i kilometrowy na pełnym kilometrze (większy, z numerem kilometra).
//   buildMilepost(km, hm) → { group }                     hm 0 — słupek kilometrowy
//   buildMileposts(points, { offset, y, start, every }) → { group, count }   start — pikietaż (m) na początku linii
const postTexCache = new Map();
function postFace(text, w, h) {
  const k = text + w + h; if (postTexCache.has(k)) return postTexCache.get(k);
  const t = canvasTex(w, h, (c) => {
    c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `bold ${Math.round(Math.min(w / (text.length * 0.62), h * 0.42))}px Arial, sans-serif`; c.fillText(text, w / 2, h * 0.36);
  }, false);
  postTexCache.set(k, t); return t;
}
export function buildMilepost(km = 0, hm = 1) {
  const g = new THREE.Group(); g.name = hm ? `słupek hektometrowy ${km}+${hm}00` : `słupek kilometrowy ${km}`;
  const big = !hm, W = big ? 0.22 : 0.12, H = big ? 0.9 : 0.6, D = big ? 0.14 : 0.12;
  const white = kitMat('postWhite', () => new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.8 }));
  const face = new THREE.MeshStandardMaterial({ map: postFace(String(big ? km : hm), big ? 64 : 48, big ? 256 : 240), roughness: 0.8 });
  // lico z numerem wzdłuż drogi (lokalne ±x); 0,2 m w gruncie
  const box = new THREE.Mesh(new THREE.BoxGeometry(D, H + 0.2, W).translate(0, (H - 0.2) / 2, 0), [face, face, white, white, white, white]);
  box.castShadow = box.receiveShadow = true; g.add(box);
  if (big) { const cap = new THREE.Mesh(new THREE.BoxGeometry(D + 0.01, 0.12, W + 0.01).translate(0, H - 0.06, 0), kitMat('postRed', () => new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.6 }))); g.add(cap); }
  return { group: g };
}
export function buildMileposts(points, { offset = 0, y = 0, start = 0, every = 100 } = {}) {
  const S = sample(points, 0.5), g = new THREE.Group(); g.name = 'pikietaż'; const step = S.L / (S.pts.length - 1);
  let n = 0;
  for (let c = Math.ceil(start / every) * every; c <= start + S.L; c += every) {
    const q = S.pts[Math.min(S.pts.length - 1, Math.round((c - start) / step))];
    const km = Math.floor(c / 1000), hm = Math.round((c % 1000) / 100), p = buildMilepost(km, hm % 10);
    p.group.position.set(q.p.x + q.nx * offset, q.p.y + y, q.p.z + q.nz * offset); p.group.rotation.y = Math.atan2(-q.t.z, q.t.x);
    g.add(p.group); n++;
  }
  return { group: g, count: n };
}

/* ---------------- miejsca parkingowe ---------------- */
// Pas postojowy wzdłuż jezdni (w przekroju: pas { k: 'parking', w: PARKING[type].depth, h: 0 } przed krawężnikiem)
// i jego oznakowanie: linie P-18 (białe, 12 cm) wyznaczające stanowiska; miejsca dla osób z niepełnosprawnością —
// niebieska powierzchnia z białym obrysem i symbolem P-24 (wózek), przy nich znak D-18 z tabliczką T-29.
// Wymiary jak w przepisach: równoległe 2,5 × 6,0 m (dla niepełnosprawnych tej samej wielkości), skośne 60° i prostopadłe 2,5 × 5,0 m (dla niepełnosprawnych 3,6 × 5,0).
//   PARKING  parallel | angled | perpendicular → { label, depth (szerokość pasa), angle, w, l, wD }
//   buildParking(points, type, { inner, side, disabled, margin }) → { group, stalls: [{ s, o, rot, disabled }] }
//     inner — odsunięcie wewnętrznej krawędzi pasa (brzeg jezdni), side ±1, disabled — ile pierwszych miejsc dla
//     niepełnosprawnych; stalls — środki stanowisk (do ustawiania aut i znaków)
export const PARKING = {
  parallel: { label: 'Równoległe', depth: 2.5, angle: 0, w: 6.0, wD: 6.0 },
  angled: { label: 'Skośne 60°', depth: 5.6, angle: 60, w: 2.5, wD: 3.6, l: 5.0 },
  perpendicular: { label: 'Prostopadłe', depth: 5.0, angle: 90, w: 2.5, wD: 3.6, l: 5.0 },
};
export function wheelchair(c, x, y, s, col) {   // symbol osoby na wózku (P-24, T-29); środek x, y, rozmiar s
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.arc(x - s * 0.1, y - s * 0.4, s * 0.085, 0, 7); c.fill();                                  // głowa
  c.lineWidth = s * 0.1;
  c.beginPath(); c.moveTo(x - s * 0.12, y - s * 0.26); c.lineTo(x - s * 0.12, y + s * 0.02); c.lineTo(x + s * 0.16, y + s * 0.02);
  c.lineTo(x + s * 0.24, y + s * 0.3); c.lineTo(x + s * 0.34, y + s * 0.3); c.stroke();                         // tułów, udo, łydka, stopa
  c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(x - s * 0.12, y - s * 0.14); c.lineTo(x + s * 0.1, y - s * 0.14); c.stroke();   // ręka
  c.lineWidth = s * 0.075; c.beginPath(); c.arc(x - s * 0.08, y + s * 0.18, s * 0.26, -0.45, Math.PI * 2 - 2.0); c.stroke();     // koło (otwarte u góry)
}
const stallTex = new Map();
function disabledTex(wm, dm) {   // wm — szerokość stanowiska (u), dm — głębokość (v, od jezdni do krawężnika)
  const k = wm + 'x' + dm; if (stallTex.has(k)) return stallTex.get(k);
  const px = 64, W = Math.round(wm * px), H = Math.round(dm * px);
  const t = canvasTex(W, H, (c) => {
    c.fillStyle = '#1f5fa8'; c.fillRect(0, 0, W, H);
    const s = Math.min(W, H) * 0.62; wheelchair(c, W / 2, H / 2, s, '#f2f2ee');
  }, false);
  stallTex.set(k, t); return t;
}
const parkPaint = paint;
export function buildParking(points, type = 'perpendicular', { inner = 3.25, side = 1, disabled = 0, margin = 3 } = {}) {
  const T = PARKING[type] || PARKING.perpendicular, S = sample(points, 0.5), g = new THREE.Group(); g.name = 'parking: ' + T.label;
  const step = S.L / (S.pts.length - 1), oIn = side * inner, oOut = side * (inner + T.depth);
  // punkt trasy w (s, o): s wzdłuż linii (m), o odsunięcie od osi (m, w lewo dodatnie)
  const at = (s, o, y) => {
    const f = Math.max(0, Math.min(S.pts.length - 1, s / step)), i = Math.min(S.pts.length - 2, Math.floor(f)), u = f - i, a = S.pts[i], b = S.pts[i + 1];
    const x = a.p.x + (b.p.x - a.p.x) * u, z = a.p.z + (b.p.z - a.p.z) * u, nx = a.nx + (b.nx - a.nx) * u, nz = a.nz + (b.nz - a.nz) * u;
    return [x + nx * o, a.p.y + (b.p.y - a.p.y) * u + y, z + nz * o];
  };
  const quads = { P: [], N: [], U: [], I: [] };
  // czworokąt na nawierzchni; kolejność wierzchołków dobrana tak, żeby lico patrzyło w górę (strona i kierunek dowolne)
  const quad = (Q, corners, uv, y) => {
    const k = Q.P.length / 3, p = corners.map(([s, o]) => at(s, o, y));
    p.forEach((v, j) => { Q.P.push(...v); Q.N.push(0, 1, 0); Q.U.push(...uv[j]); });
    const up = (p[1][2] - p[0][2]) * (p[2][0] - p[0][0]) - (p[1][0] - p[0][0]) * (p[2][2] - p[0][2]) > 0;
    if (up) Q.I.push(k, k + 1, k + 2, k, k + 2, k + 3); else Q.I.push(k, k + 2, k + 1, k, k + 3, k + 2);
  };
  const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
  // pas linii między dwoma punktami (s, o), szerokość 12 cm
  const lineSO = (s0, o0, s1, o1, w = 0.12) => {
    const ds = s1 - s0, dO = o1 - o0, L = Math.hypot(ds, dO) || 1, ps = -dO / L * w / 2, po = ds / L * w / 2;
    quad(quads, [[s0 + ps, o0 + po], [s1 + ps, o1 + po], [s1 - ps, o1 - po], [s0 - ps, o0 - po]], UV, 0.005);
  };
  const stalls = [], blue = [];
  // skos w kierunku jazdy: ruch prawostronny — po stronie −1 jedzie się w +s, po stronie +1 w −s
  const th = T.angle * Math.PI / 180, kOff = T.angle && T.angle < 90 ? -side * T.depth / Math.tan(th) : 0;
  let s = margin + Math.max(0, -kOff), n = 0;
  while (true) {
    const dis = n < disabled, W = dis ? T.wD : T.w, along = T.angle ? W / Math.sin(th) : W;
    if (s + along + Math.max(0, kOff) > S.L - margin) break;
    const c = [[s, oIn], [s + along, oIn], [s + along + kOff, oOut], [s + kOff, oOut]];
    if (n === 0) lineSO(c[0][0], c[0][1], c[3][0], c[3][1]);
    lineSO(c[1][0], c[1][1], c[2][0], c[2][1]);
    if (dis) { lineSO(c[0][0], c[0][1], c[1][0], c[1][1]); lineSO(c[3][0], c[3][1], c[2][0], c[2][1]); blue.push({ c, W, D: T.angle ? T.depth / Math.sin(th) : T.depth }); }
    const mid = at(s + along / 2 + kOff / 2, (oIn + oOut) / 2, 0), q = S.pts[Math.min(S.pts.length - 1, Math.round((s + along / 2) / step))];
    stalls.push({ x: mid[0], y: mid[1], z: mid[2], rot: Math.atan2(-q.t.z, q.t.x) + side * (Math.PI / 2 - (T.angle ? th : 0)) * (T.angle ? 1 : 0), disabled: dis, s: s + along / 2 });
    s += along; n++;
  }
  // linia krawędzi pasa postojowego przy równoległym (oddziela od pasa ruchu)
  if (!T.angle && n) lineSO(margin, oIn, s, oIn);
  const UVd = side > 0 ? UV : [[1, 0], [0, 0], [0, 1], [1, 1]];   // symbol czytelny (nie lustrzany) z jezdni po obu stronach
  g.add(mesh(geo(quads.P, quads.N, quads.U, quads.I), parkPaint, false));
  // niebieskie stanowiska z symbolem P-24 (wózek przodem do jezdni: v od jezdni do krawężnika)
  for (const b of blue) {
    const Q = { P: [], N: [], U: [], I: [] };
    quad(Q, b.c, UVd, 0.003);
    const m = new THREE.MeshStandardMaterial({ map: disabledTex(T.angle ? b.W : b.W, T.angle ? 5 : T.depth), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    g.add(mesh(geo(Q.P, Q.N, Q.U, Q.I), m, false));
  }
  return { group: g, stalls, count: n };
}

/* ---------------- tunele ---------------- */
// Tunel drogowy po linii trasy (od portalu do portalu): obudowa łukowa (ściany pionowe i sklepienie półkoliste,
// beton), jasne okładziny ścian do 3 m, oprawy oświetleniowe w dwóch rzędach pod sklepieniem, a na obu końcach
// portal — betonowa ściana czołowa z otworem w kształcie przekroju, jej korona idzie za terenem `ground(x, z)`.
// Rodzaj `box` — tunel prostokątny dwukierunkowy (jak płytkie tunele miejskie): strop płaski 5,2 m, dwie nawy,
// pośrodku na wysepce rząd słupów 0,8 × 0,8 m co 6 m; w portalu dwa otwory rozdzielone filarem.
//   TUNNEL_PROFILE      przekrój drogi w tunelu łukowym: dwa pasy 3,5 m, opaski 0,5 m, chodniki służbowe 1 m
//   TUNNEL_BOX_PROFILE  przekrój w tunelu z podporami: 2 × 2 pasy 3,5 m, wysepka 1,2 m pośrodku
//   buildTunnel(points, profile, { type, ground, wall, lights }) → { group, length, half, top, arch }
//     half — połowa szerokości w świetle, top — wysokość sklepienia, arch — przekrój [[dn, dy], …] (do wycięcia terenu)
export const TUNNEL_PROFILE = { label: 'Droga w tunelu', lanes: 2, laneW: 3.5, road: 'asphalt', marks: { center: 'solid', edge: true },
  strips: [{ k: 'shoulder', w: 0.5, h: 0, s: 'asphalt' }, { k: 'curb', w: 0.15, h: 0.2 }, { k: 'sidewalk', w: 1.0, h: 0.2, s: 'concrete' }] };
export const TUNNEL_BOX_PROFILE = { label: 'Droga w tunelu z podporami', lanes: 4, laneW: 3.5, road: 'asphalt', median: 1.2, medianS: 'concrete', marks: { center: 'dashed', edge: true },
  strips: [{ k: 'shoulder', w: 0.5, h: 0, s: 'asphalt' }, { k: 'curb', w: 0.15, h: 0.2 }, { k: 'sidewalk', w: 1.0, h: 0.2, s: 'concrete' }] };
export function tunnelArch(half, wall = 2.6, seg = 24) {
  const A = [[half, 0], [half, wall]];
  for (let k = 1; k < seg; k++) { const a = k / seg * Math.PI; A.push([half * Math.cos(a), wall + half * Math.sin(a)]); }
  A.push([-half, wall], [-half, 0]);
  return A;
}
export function buildTunnel(points, profile = TUNNEL_PROFILE, { type = 'arch', ground = null, wall = 2.6, lights = true } = {}) {
  const pr = typeof profile === 'string' ? PROFILES[profile] : profile, S = sample(points, 0.5), g = new THREE.Group(); g.name = 'tunel';
  const box = type === 'box', med = pr.median || 0, BH = 5.2;
  const half = pr.lanes * pr.laneW / 2 + med / 2 + pr.strips.reduce((a, x) => a + x.w, 0);
  const arch = box ? [[half, 0], [half, BH], [-half, BH], [-half, 0]] : tunnelArch(half, wall), top = box ? BH : wall + half;
  // obudowa (od środka) i okładziny ścian
  const lin = kitMat('lining', () => { const m = surface('concrete').clone(); m.side = THREE.DoubleSide; return m; });
  g.add(mesh(sweep(S, arch, 0, 0, 1, 3), lin));
  const clad = kitMat('cladding', () => new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#d9dcd8'; c.fillRect(0, 0, w, h); c.fillStyle = '#9aa09c'; c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h); }), roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  for (const sd of [-1, 1]) g.add(mesh(sweep(S, [[half - 0.01, 0.2], [half - 0.01, 3.0]], 0, 0, sd, 1.2), clad, false));
  // oprawy: dwa rzędy co 8 m pod sklepieniem (świecą zawsze)
  // podpory pośrodku (na wysepce, co 6 m)
  if (box) g.add(inst(new THREE.BoxGeometry(0.8, BH - 0.14, 0.8).translate(0, (BH - 0.14) / 2 + 0.14, 0), lin, stations(S, 0, 6, 3)));
  if (lights && box) {
    const lamp = kitMat('tunnelLamp', () => new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xfff1d6, emissiveIntensity: 2.2, roughness: 0.4 }));
    for (const sd of [-1, 1]) g.add(inst(new THREE.BoxGeometry(1.4, 0.1, 0.3), lamp, stations(S, sd * (med / 2 + pr.laneW), 8, 4, BH - 0.06), false));
  } else if (lights) {
    const lamp = kitMat('tunnelLamp', () => new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xfff1d6, emissiveIntensity: 2.2, roughness: 0.4 }));
    const a = 0.62 * Math.PI / 2;   // kąt na sklepieniu
    for (const sd of [-1, 1]) g.add(inst(new THREE.BoxGeometry(1.4, 0.1, 0.3), lamp, stations(S, sd * half * Math.cos(a) * 0.98, 8, 4, wall + half * Math.sin(a) * 0.98), false));
  }
  // portale: ściana czołowa z otworem przekroju, korona nad terenem (co najmniej 1,5 m nad sklepieniem)
  const con = surface('concrete'), D = 1.2, W = half + 14;
  for (const end of [0, 1]) {
    const q = S.pts[end ? S.pts.length - 1 : 0], dir = end ? 1 : -1;   // na zewnątrz tunelu
    const outer = [];
    for (let u = -W; u <= W + 1e-6; u += 1) {
      const x = q.p.x + q.nx * u, z = q.p.z + q.nz * u, gy = ground ? ground(x, z) : 0;
      outer.push(new THREE.Vector2(u, Math.max(Math.abs(u) <= half + 1 ? top + 1.5 : 0.3, gy + 0.4)));
    }
    const sh = new THREE.Shape([new THREE.Vector2(-W, -0.5), new THREE.Vector2(W, -0.5), ...outer.reverse()]);
    // otwór: przekrój tunelu; w tunelu z podporami dwa otwory i filar 1,2 m pośrodku
    const rect = (a, b) => new THREE.Path([new THREE.Vector2(a, 0), new THREE.Vector2(a, BH), new THREE.Vector2(b, BH), new THREE.Vector2(b, 0)]);
    if (box) sh.holes.push(rect(-half, -0.6), rect(0.6, half)); else sh.holes.push(new THREE.Path(arch.map(([dn, dy]) => new THREE.Vector2(dn, dy))));
    const eg = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false });
    // lokalnie: x — w lewo od osi (normalna), y — w górę, z — wzdłuż trasy na zewnątrz
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(q.nx, 0, q.nz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(q.t.x * dir, 0, q.t.z * dir).normalize());
    m.setPosition(q.p.x - q.t.x * dir * (D - 0.3), q.p.y, q.p.z - q.t.z * dir * (D - 0.3)); eg.applyMatrix4(m);
    const pw = mesh(eg, con); g.add(pw);
  }
  return { group: g, length: S.L, half, top, arch };
}

/* ---------------- kładki dla pieszych ---------------- */
// Kładka nad ulicą (lokalnie: pomost wzdłuż z, ulica wzdłuż x, środek nad osią ulicy): pomost stalowy (dźwigary
// skrzynkowe, płyta, nawierzchnia antypoślizgowa) na wysokości `height` (domyślnie 5 m — skrajnia 4,6 m), na końcach
// spoczniki na słupach, z nich schody betonowe (stopnie 15 × 30 cm, spocznik w połowie wysokości) w stronę +x,
// balustrady szklane 1,1 m z pochwytem, przy schodach pochwyty stalowe. lift: true — przy każdym spoczniku (od −x)
// winda w przeszklonym szybie ze stalową ramą, kabina na dole, drzwi od strony spocznika i od ulicy.
//   buildFootbridge({ span, height, width, lift }) → { group, length }
export function buildFootbridge({ span = 18, height = 5, width = 3, lift = false } = {}) {
  const g = new THREE.Group(); g.name = lift ? 'kładka ze schodami i windą' : 'kładka ze schodami';
  const con = surface('concrete');
  const paintM = kitMat('bridgeSteel', () => new THREE.MeshStandardMaterial({ color: 0x5d6f80, roughness: 0.45, metalness: 0.6 }));
  const deckM = kitMat('deckTop', () => new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: 0.95 }));
  const glass = kitMat('rail glass', () => new THREE.MeshStandardMaterial({ color: 0xbfd8dc, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  const st = steel();
  const box = (w, h, d, m, x, y, z, shadow = true) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; g.add(o); return o; };
  const rod = (a, b, r, m) => { const d = new THREE.Vector3().subVectors(b, a), o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), m); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); o.castShadow = true; g.add(o); return o; };
  const H = height, W = width, half = span / 2, P = 3.2;   // P — bok spocznika
  // balustrada szklana wzdłuż odcinka (a → b) na wysokości y
  const glassRail = (a, b, y) => {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length(), mid = a.clone().addScaledVector(d, 0.5);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.0), glass); pane.position.set(mid.x, y + 0.55, mid.z); pane.rotation.y = Math.atan2(-d.z, d.x); pane.renderOrder = 2; g.add(pane);
    rod(new THREE.Vector3(a.x, y + 1.1, a.z), new THREE.Vector3(b.x, y + 1.1, b.z), 0.03, st);
    for (let s = 0; s <= L + 1e-6; s += Math.max(1, L / Math.ceil(L / 1.5))) { const p = a.clone().addScaledVector(d, s / L); rod(new THREE.Vector3(p.x, y, p.z), new THREE.Vector3(p.x, y + 1.1, p.z), 0.025, st); }
  };
  // pomost: dwa dźwigary skrzynkowe po bokach, płyta, nawierzchnia
  for (const sx of [-1, 1]) box(0.3, 0.9, span, paintM, sx * (W / 2 - 0.15), H - 0.45, 0);
  box(W, 0.25, span, paintM, 0, H - 0.2, 0); box(W - 0.6, 0.02, span, deckM, 0, H - 0.06, 0, false);
  for (const sx of [-1, 1]) glassRail(new THREE.Vector3(sx * (W / 2 - 0.15), 0, -half), new THREE.Vector3(sx * (W / 2 - 0.15), 0, half), H);
  // spoczniki na końcach (płyta na czterech słupach)
  const rise = 0.15, run = 0.3, SW = 2.0;
  for (const sz of [-1, 1]) {
    const zc = sz * (half + P / 2);
    box(P, 0.35, P, con, 0, H - 0.175 - 0.05, zc); box(P - 0.1, 0.02, P - 0.1, deckM, 0, H - 0.04, zc, false);
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) box(0.4, H - 0.4, 0.4, con, cx * (P / 2 - 0.3), (H - 0.4) / 2, zc + cz * (P / 2 - 0.3));
    // balustrady spocznika: od strony z poza pomostem i od −x (bez windy)
    const zo = zc + sz * P / 2;
    glassRail(new THREE.Vector3(-P / 2, 0, zo), new THREE.Vector3(P / 2, 0, zo), H);
    if (!lift) glassRail(new THREE.Vector3(-P / 2, 0, zc - P / 2), new THREE.Vector3(-P / 2, 0, zc + P / 2), H);
    // schody w stronę +x: dwa biegi i spocznik pośredni; stopnie zębate na płycie biegowej
    const steps = Math.round(H / rise), n1 = Math.ceil(steps / 2), n2 = steps - n1, zs = zc + sz * (P / 2 - SW / 2);
    const M = [];
    const flight = (x0, y0, n) => {
      for (let k = 0; k < n; k++) M.push(new THREE.Matrix4().makeTranslation(x0 + run * (k + 0.5), y0 - (k + 1) * rise - 0.15 + rise / 2 + 0.075, zs));
      // płyta biegowa (spód skośny)
      const L = Math.hypot(n * run, n * rise), slab = new THREE.Mesh(new THREE.BoxGeometry(L, 0.2, SW), con);
      slab.position.set(x0 + n * run / 2, y0 - n * rise / 2 - 0.3, zs); slab.rotation.z = -Math.atan2(rise, run); slab.castShadow = slab.receiveShadow = true; g.add(slab);
      // pochwyty po obu stronach
      for (const e of [-1, 1]) {
        const zz = zs + e * (SW / 2 - 0.05);
        rod(new THREE.Vector3(x0, y0 + 0.9, zz), new THREE.Vector3(x0 + n * run, y0 - n * rise + 0.9, zz), 0.025, st);
        for (let k = 0; k <= n; k += 4) rod(new THREE.Vector3(x0 + k * run, y0 - k * rise, zz), new THREE.Vector3(x0 + k * run, y0 - k * rise + 0.9, zz), 0.02, st);
      }
      return [x0 + n * run, y0 - n * rise];
    };
    const [x1, y1] = flight(P / 2, H, n1);
    const LL = 1.5; box(LL, 0.3, SW, con, x1 + LL / 2, y1 - 0.15, zs); box(0.4, y1 - 0.3, 0.4, con, x1 + LL / 2, (y1 - 0.3) / 2, zs);
    flight(x1 + LL, y1, n2);
    g.add(inst(new THREE.BoxGeometry(run, 0.3, SW), con, M));
    // winda: szyb przeszklony od −x spocznika, kabina na dole
    if (lift) {
      const S = 2.4, xs = -P / 2 - S / 2, top = H + 3.0;
      for (const cx of [-1, 1]) for (const cz of [-1, 1]) box(0.14, top, 0.14, paintM, xs + cx * (S / 2 - 0.07), top / 2, zc + cz * (S / 2 - 0.07));
      for (let y = 0.1; y <= top; y += 2.5) for (const [w, d, ox, oz] of [[S, 0.1, 0, S / 2 - 0.05], [S, 0.1, 0, -(S / 2 - 0.05)], [0.1, S, S / 2 - 0.05, 0], [0.1, S, -(S / 2 - 0.05), 0]]) box(w, 0.1, d, paintM, xs + ox, y, zc + oz, false);
      box(S + 0.2, 0.3, S + 0.2, paintM, xs, top + 0.15, zc);
      for (const [w, ox, oz, ry] of [[S, 0, S / 2 - 0.05, 0], [S, 0, -(S / 2 - 0.05), 0], [S, -(S / 2 - 0.05), 0, Math.PI / 2], [S, S / 2 - 0.05, 0, Math.PI / 2]]) {
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.14, top - 0.2), glass); pane.position.set(xs + ox, top / 2, zc + oz); pane.rotation.y = ry; pane.renderOrder = 2; g.add(pane);
      }
      box(S + 0.4, 0.2, S + 0.4, con, xs, 0.1, zc);
      // kabina (na dole) z drzwiami; drzwi szybu na górze od strony spocznika (+x) i na dole od −x
      box(1.5, 2.2, 1.6, kitMat('cabin', () => new THREE.MeshStandardMaterial({ color: 0xa9b0b5, roughness: 0.3, metalness: 0.8 })), xs, 0.2 + 1.1, zc);
      const doorM = kitMat('liftDoor', () => new THREE.MeshStandardMaterial({ color: 0x8c949a, roughness: 0.25, metalness: 0.9 }));
      box(0.06, 2.1, 1.0, doorM, xs + S / 2 - 0.02, H + 1.05, zc); box(0.06, 2.1, 1.0, doorM, xs - S / 2 + 0.02, 0.2 + 1.05, zc);
      // przejście z szybu na spocznik
      box(0.6, 0.3, 1.4, con, -P / 2 - 0.3 + 0.3, H - 0.2, zc);
    }
  }
  return { group: g, length: span };
}
