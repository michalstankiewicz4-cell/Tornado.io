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
function sample(points, step = 0.5, closed = false) {
  const c = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed, 'centripetal');
  const L = c.getLength(), n = Math.max(2, Math.ceil(L / step)), out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, p = c.getPointAt(u), t = c.getTangentAt(u);
    out.push({ p, t, nx: -t.z, nz: t.x, s: u * L });
  }
  return { pts: out, L };
}
// wstęga między odsunięciami a…b (m, w lewo od osi) na wysokości y; tile — metry na kafelek tekstury
function ribbon(S, a, b, y, tile, side = 0) {
  const P = [], N = [], U = [], I = [];
  S.pts.forEach((q, i) => {
    for (const o of [a, b]) { P.push(q.p.x + q.nx * o, y, q.p.z + q.nz * o); N.push(0, 1, 0); U.push(o / tile, q.s / tile); }
    if (i) { const k = i * 2; I.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  if (a > b) for (let i = 0; i < I.length; i += 3) [I[i + 1], I[i + 2]] = [I[i + 2], I[i + 1]];
  return geo(P, N, U, I);
}
// pionowa ściana wzdłuż linii (lico krawężnika) od y0 do y1 przy odsunięciu o, zwrócona na stronę dir (+1 w lewo)
function wall(S, o, y0, y1, dir, tile) {
  const P = [], N = [], U = [], I = [];
  S.pts.forEach((q, i) => {
    for (const y of [y0, y1]) { P.push(q.p.x + q.nx * o, y, q.p.z + q.nz * o); N.push(-q.nx * dir, 0, -q.nz * dir); U.push(q.s / tile, y / tile); }
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
    g.add(mesh(ribbon(S, -med / 2 + 0.15, med / 2 - 0.15, 0.14, 2), surface('grass'), false));
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
      if (Math.abs(st.h - yPrev) > 0.005) g.add(mesh(wall(S, a, Math.min(st.h, yPrev), Math.max(st.h, yPrev), st.h > yPrev ? sd : -sd, 1), m.userData.tile ? m : surface('curb')));
      yPrev = st.h; o += st.w;
    }
    // zewnętrzny brzeg ostatniego pasa w dół do gruntu
    if (yPrev > 0.005) g.add(mesh(wall(S, sd * o, 0, yPrev, -sd, 1), surface('curb')));
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
