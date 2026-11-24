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
  slabs: { label: 'Płyty chodnikowe', kind: 'brick', color: '#a7a49c', color2: '#7d7a73', tile: 1, roughness: 0.88, metalness: 0, bricks: 2, wear: 0.2, dirt: 0.3 },
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
    strips: [{ k: 'curb', w: 0.15, h: 0.14 }, { k: 'sidewalk', w: 2, h: 0.14, s: 'pavers' }, { k: 'cycle', w: 2, h: 0.14, s: 'redPavers' }, { k: 'sidewalk', w: 2.5, h: 0.14, s: 'slabs' }] },
  village: { label: 'Droga wiejska', lanes: 2, laneW: 2.9, road: 'asphaltOld', marks: { center: false, edge: false },
    strips: [{ k: 'shoulder', w: 1.0, h: -0.02, s: 'gravel' }, { k: 'verge', w: 1.2, h: -0.15, s: 'grass' }] },
  path: { label: 'Ścieżka', lanes: 1, laneW: 1.8, road: 'gravel', marks: { center: false, edge: false }, strips: [{ k: 'edge', w: 0.08, h: 0.06, s: 'curb' }] },
  cycle: { label: 'Droga dla rowerów i chodnik', lanes: 1, laneW: 2.2, road: 'redPavers', marks: { center: 'dashed', edge: false },
    strips: [{ k: 'curb', w: 0.1, h: 0.03 }, { k: 'sidewalk', w: 2.0, h: 0.03, s: 'pavers' }] },
};

const matCache = new Map();
export function surface(id) {
  if (!matCache.has(id)) { const d = SURFACES[id]; const m = makeMaterial(d, { res: 512 }).material; m.userData.tile = d.tile; matCache.set(id, m); }
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
