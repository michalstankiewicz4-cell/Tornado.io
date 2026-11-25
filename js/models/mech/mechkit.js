// MechKit — elementy mechaniczne transmisji ruchu (prawdziwe wymiary w metrach, masy w kg). Każdy element obrotowy jest
// budowany wzdłuż lokalnej osi +x: część stała w grupie `group`, część wirująca w `group.userData.spin` (obrót
// spin.rotation.x = kąt). Element nie wie, w jakim napędzie jest — napęd (js/behaviors/mech/drive.js) podaje kąty.
//   materials()                                → wspólne materiały (MatKit: stal szlifowana, mosiądz, żeliwo, farba…)
//   gear({ z, m, w, bore, mat })               → zębatka walcowa o zarysie ewolwentowym (kąt przyporu 20°)
//   ringGear({ z, m, w, rim, mat })            → koło koronowe (uzębienie wewnętrzne)
//   sprocket({ z, p, mat })                    → koło łańcuchowe pod łańcuch rolkowy (ANSI 40: p = 12,7 mm)
//   chainLoop(c1, c2, opts) / beltLoop(…)      → droga łańcucha / pasa wokół dwóch kół (styczne + łuki) i jego model
//   pulley({ d, w, mat })                      → koło pasowe z rowkiem klinowym (SPA)
//   shaft({ len, r }) · pillowBlock({ h, r }) · jawCoupling · flangeCoupling · yoke · cross · motor · housing
import * as THREE from '../../../vendor/three/three.module.js';
import { makeMaterial, PRESETS } from '../../render/materials/matkit.js';

export const STEEL_RHO = 7850, BRASS_RHO = 8500, IRON_RHO = 7200, ALU_RHO = 2700;
const TAU = Math.PI * 2, ALPHA = 20 * Math.PI / 180;

/* ---------------- materiały ---------------- */
let MATS = null;
export function materials() {
  if (MATS) return MATS;
  const mk = (def) => makeMaterial(def, { res: 512 }).material;
  MATS = {
    steel: mk({ ...PRESETS.brushed, color: '#b4b9bd', roughness: 0.3, brushed: 0.8 }),                   // wały, sworznie
    gear: mk({ ...PRESETS.brushed, color: '#8e959b', roughness: 0.38, brushed: 0.35, wear: 0.15 }),     // stal ulepszona
    brass: mk({ ...PRESETS.copper, color: '#c09a4a', roughness: 0.32, brushed: 0.25, wear: 0.12 }),    // mosiądz / brąz
    dark: mk({ ...PRESETS.brushed, color: '#3d4043', roughness: 0.45, brushed: 0.2, wear: 0.2 }),      // stal czerniona
    iron: mk({ ...PRESETS.plate, color: '#5b6066', color2: '#3b3f44', roughness: 0.7, metalness: 0.6, panels: 1, rivets: 0, wear: 0.25 }),  // żeliwo
    alu: mk({ ...PRESETS.aluminium, roughness: 0.35 }),
    paintBlue: mk({ ...PRESETS.hull, color: '#2c5c8f', color2: '#1b3a5c', tile: 2, wear: 0.12, dirt: 0.15, rust: 0 }),   // silnik (RAL 5010)
    paintGrey: mk({ ...PRESETS.hull, color: '#5a6672', color2: '#38414a', tile: 2, wear: 0.2, dirt: 0.2, rust: 0 }),     // oprawy łożysk
    paintRed: mk({ ...PRESETS.hull, color: '#b0302a', color2: '#6b1c18', tile: 2, wear: 0.15, dirt: 0.1, rust: 0 }),     // zacisk hamulca
    bed: mk({ ...PRESETS.plate, color: '#4a5056', color2: '#2c3034', tile: 3, panels: 2, rivets: 0, wear: 0.3, dirt: 0.35 }),   // łoże maszyny
    concrete: mk({ ...PRESETS.concrete, tile: 6 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.92, metalness: 0 }),
    poly: new THREE.MeshStandardMaterial({ color: 0xd8432e, roughness: 0.55, metalness: 0 }),         // poliuretan (gwiazda sprzęgła)
    black: new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.6, metalness: 0.3 }),
    acrylic: new THREE.MeshPhysicalMaterial({ color: 0xe6f2ff, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  };
  return MATS;
}

/* ---------------- narzędzia geometrii ---------------- */
// kształt w płaszczyźnie (sx, sy) wyciągnięty wzdłuż sz → świat (x = sz, y = sx, z = sy): kąt w kształcie = kąt obrotu wokół +x
const PERM = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
function extrude(shape, w, bevel = 0.0006, curve = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: w - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: curve });
  g.translate(0, 0, -(w - 2 * bevel) / 2).applyMatrix4(PERM);
  return uvScale(g, 6);
}
function uvScale(g, s) { const uv = g.attributes.uv; if (uv) { for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s); } return g; }
export const cyl = (r, len, seg = 32, r2 = r) => uvScale(new THREE.CylinderGeometry(r2, r, len, seg).rotateZ(-Math.PI / 2), 1);   // wzdłuż +x (r na −x… r2 na +x)
const lathe = (pts, seg = 48) => uvScale(new THREE.LatheGeometry(pts.map(([r, x]) => new THREE.Vector2(r, x)), seg).rotateZ(-Math.PI / 2), 3);
const mesh = (g, m, shadow = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; return o; };
const circlePath = (r, n = 40, x = 0, y = 0) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, TAU, true); return p; };
// otwór z rowkiem na wpust (wpust b ≈ r/2, głębokość r/4)
function boreHole(r) {
  const p = new THREE.Path(), b = Math.max(0.002, r * 0.5) / 2, a = Math.asin(Math.min(0.9, b / r));
  p.moveTo(r * Math.cos(a), b); p.lineTo(r + r * 0.28, b); p.lineTo(r + r * 0.28, -b); p.lineTo(r * Math.cos(a), -b);
  p.absarc(0, 0, r, -a, -TAU + a, true);
  return p;
}
const box = (sx, sy, sz) => uvScale(new THREE.BoxGeometry(sx, sy, sz), 4);
function newPart(name, extra = {}) { const group = new THREE.Group(), spin = new THREE.Group(); group.add(spin); group.name = name; group.userData.spin = spin; Object.assign(group.userData, extra); return group; }

/* ---------------- zarys ewolwentowy ---------------- */
// punkty zarysu koła o z zębach, moduł m (wysokość głowy add·m, stopy ded·m); ząb 0 na kącie 0
export function involuteOutline(z, m, { add = 1, ded = 1.25, steps = 7, backlash = 0.04 } = {}) {
  const rp = m * z / 2, rb = rp * Math.cos(ALPHA), ra = rp + add * m, rf = rp - ded * m;
  const inv = Math.tan(ALPHA) - ALPHA, half = Math.PI / (2 * z) - backlash / z + inv;   // połowa grubości zęba na kole zasadniczym (kąt)
  const tMax = Math.sqrt(Math.max(0, (ra / rb) ** 2 - 1)), tMin = rf > rb ? Math.sqrt((rf / rb) ** 2 - 1) : 0;
  const th = (t) => t - Math.atan(t), pts = [], P = (r, a) => pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)));
  for (let i = 0; i < z; i++) {
    const c = i * TAU / z;
    P(rf, c - Math.PI / z);                                 // środek wrębu
    if (rf < rb) P(rf, c - half);                           // stopa — promieniście do koła zasadniczego
    for (let k = 0; k <= steps; k++) { const t = tMin + (tMax - tMin) * k / steps; P(rb * Math.sqrt(1 + t * t), c - half + th(t)); }
    const tipA = half - th(tMax);
    if (tipA > 0) P(ra, c);
    for (let k = steps; k >= 0; k--) { const t = tMin + (tMax - tMin) * k / steps; P(rb * Math.sqrt(1 + t * t), c + half - th(t)); }
    if (rf < rb) P(rf, c + half);
  }
  return { pts, rp, ra, rf, rb };
}

/* ---------------- zębatka ---------------- */
export function gear({ z = 20, m = 0.004, w = 0.04, bore = 0.0125, mat = 'gear', hub = true, name } = {}) {
  const M = materials(), o = involuteOutline(z, m), shape = new THREE.Shape(o.pts);
  shape.holes.push(boreHole(bore));
  const hubR = Math.max(bore * 1.9, bore + 0.012), ring = o.rf - 0.006 - 1.2 * m;
  let holes = 0;
  if (ring - hubR > 0.022) {   // otwory odciążające w tarczy
    holes = 6; const rr = (ring - hubR) * 0.36, rm = (ring + hubR) / 2;
    for (let k = 0; k < holes; k++) shape.holes.push(circlePath(rr, 32, rm * Math.cos(k * TAU / holes + Math.PI / holes), rm * Math.sin(k * TAU / holes + Math.PI / holes)));
  }
  const g = newPart(name || `Zębatka z = ${z}`), body = mesh(extrude(shape, w), M[mat]);
  g.userData.spin.add(body);
  let hubLen = 0;
  if (hub && holes) {   // piasta po obu stronach tarczy
    hubLen = w * 0.35;
    const hg = new THREE.Shape(); hg.absarc(0, 0, hubR, 0, TAU, false); hg.holes.push(boreHole(bore));
    for (const s of [-1, 1]) { const h = mesh(extrude(hg, hubLen, 0.0008), M[mat]); h.position.x = s * (w + hubLen) / 2; g.userData.spin.add(h); }
  }
  const area = Math.PI * (o.rp * o.rp - bore * bore), rho = mat === 'brass' ? BRASS_RHO : STEEL_RHO, mass = rho * area * w * (holes ? 0.78 : 1);
  Object.assign(g.userData, { z, m, rp: o.rp, ra: o.ra, w, mass, J: 0.5 * mass * (o.rp * o.rp * 0.9 + bore * bore), material: mat, hubLen });
  return g;
}
// koło koronowe: otwór o zarysie „wrębów” (głowa korony = stopa zęba koła zewnętrznego)
export function ringGear({ z = 72, m = 0.002, w = 0.03, rim = 0.012, mat = 'brass', name } = {}) {
  const M = materials(), o = involuteOutline(z, m, { add: 1.25, ded: 1, backlash: -0.04 }), shape = new THREE.Shape();
  const R = o.ra + rim; shape.absarc(0, 0, R, 0, TAU, false);
  shape.holes.push(new THREE.Path(o.pts));
  const g = newPart(name || `Koło koronowe z = ${z}`);
  g.userData.spin.add(mesh(extrude(shape, w, 0.0005, 96), M[mat]));
  const mass = BRASS_RHO * Math.PI * (R * R - o.rp * o.rp) * w;
  Object.assign(g.userData, { z, m, rp: o.rp, R, w, mass, J: 0.5 * mass * (R * R + o.rp * o.rp) });
  return g;
}

/* ---------------- koło łańcuchowe ---------------- */
// zarys z gniazdami rolek: promień gniazda 0,505·d₁ + 0,069 mm, głowa zęba do ok. D/2 + 0,3·d₁ (ISO 606)
export function sprocket({ z = 18, p = 0.0127, d1 = 0.00792, w = 0.0072, bore = 0.0125, mat = 'dark', name } = {}) {
  const M = materials(), R = p / (2 * Math.sin(Math.PI / z)), rs = 0.505 * d1 + 0.000069, ra = R + 0.3 * d1, n = z * 28, pts = [];
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n, ux = Math.cos(a), uy = Math.sin(a);
    let r = ra;
    for (let k = 0; k < z; k++) {   // przecięcie promienia z kołem gniazda — wchodzi w gniazdo
      const cx = R * Math.cos(k * TAU / z), cy = R * Math.sin(k * TAU / z), b = ux * cx + uy * cy, c = cx * cx + cy * cy - rs * rs, disc = b * b - c;
      if (disc > 0 && b > 0) { const s1 = b - Math.sqrt(disc); if (s1 < r) r = s1; }
    }
    pts.push(new THREE.Vector2(r * ux, r * uy));
  }
  const shape = new THREE.Shape(pts); shape.holes.push(boreHole(bore));
  const g = newPart(name || `Koło łańcuchowe z = ${z}`);
  g.userData.spin.add(mesh(extrude(shape, w, 0.0005), M[mat]));
  const hubR = Math.min(R - d1 - 0.004, bore * 2.2), hs = new THREE.Shape(); hs.absarc(0, 0, hubR, 0, TAU, false); hs.holes.push(boreHole(bore));
  const hub = mesh(extrude(hs, 0.022, 0.0008), M[mat]); hub.position.x = -(w + 0.022) / 2; g.userData.spin.add(hub);
  const mass = STEEL_RHO * Math.PI * R * R * w + STEEL_RHO * Math.PI * hubR * hubR * 0.022;
  Object.assign(g.userData, { z, p, R, w, mass, J: 0.5 * mass * R * R * 0.8 });
  return g;
}

/* ---------------- koło pasowe (rowek klinowy SPA) ---------------- */
export function pulley({ d = 0.16, w = 0.026, bore = 0.0125, mat = 'iron', name } = {}) {
  const M = materials(), rp = d / 2, ro = rp + 0.0028, rg = rp - 0.011, top = 0.00675, bot = 0.0033, hubR = Math.max(0.026, bore * 2), web = 0.009;
  const rimIn = rg - 0.008, hw = w / 2;
  const prof = [[bore, -hw * 1.6], [hubR, -hw * 1.6], [hubR, -web / 2], [rimIn, -web / 2], [rimIn, -hw], [ro, -hw], [ro, -top - 0.0015], [rp + 0.001, -top], [rg, -bot], [rg, bot], [rp + 0.001, top], [ro, top + 0.0015], [ro, hw], [rimIn, hw], [rimIn, web / 2], [hubR, web / 2], [hubR, hw * 1.6], [bore, hw * 1.6], [bore, -hw * 1.6]];
  const g = newPart(name || `Koło pasowe Ø ${Math.round(d * 1000)} mm`);
  g.userData.spin.add(mesh(lathe(prof, 64), M[mat]));
  // ramiona między piastą a wieńcem (koła większe)
  if (rimIn - hubR > 0.03) {
    for (let k = 0; k < 5; k++) {
      const a = k * TAU / 5, len = rimIn - hubR, s = mesh(box(web * 1.6, len, 0.012), M[mat]);
      s.position.set(0, Math.cos(a) * (hubR + len / 2), Math.sin(a) * (hubR + len / 2)); s.rotation.x = a; g.userData.spin.add(s);
    }
  }
  const mass = IRON_RHO * (Math.PI * (ro * ro - rimIn * rimIn) * w + Math.PI * (rimIn * rimIn - hubR * hubR) * web * 0.6 + Math.PI * hubR * hubR * w * 1.6);
  Object.assign(g.userData, { d, rp, w, mass, J: 0.5 * mass * (ro * ro + rimIn * rimIn) * 0.85 });
  return g;
}

/* ---------------- droga wokół dwóch kół (łańcuch, pas) ---------------- */
// koła w płaszczyźnie (y, z) przy stałym x; c = { y, z, r, k } — k: jednostek drogi na radian łuku (łańcuch: z/2π
// podziałek, pas: r metrów); odcinki proste w jednostkach `unit` (łańcuch: p, pas: 1 m). Obieg przeciwnie do ruchu
// wskazówek zegara (dodatni obrót wokół +x). → { L, at(u) → { y, z, ty, tz }, a1, U2, a2 }
export function loopPath(c1, c2, unit) {
  const dy = c2.y - c1.y, dz = c2.z - c1.z, D = Math.hypot(dy, dz), phi = Math.atan2(dz, dy), tn = Math.acos((c1.r - c2.r) / D);
  const nA = phi - tn, nB = phi + tn;   // kierunki normalnych w punktach styczności
  const a1s = nB, a1e = nA + TAU, a2s = nA, a2e = nB;   // łuk 1: daleka strona koła 1; łuk 2: daleka strona koła 2
  const P = (c, a) => [c.y + c.r * Math.cos(a), c.z + c.r * Math.sin(a)];
  const s1a = P(c1, a1e), s1b = P(c2, a2s), s2a = P(c2, a2e), s2b = P(c1, a1s);
  const span = Math.hypot(s1b[0] - s1a[0], s1b[1] - s1a[1]) / unit;
  const segs = [];
  let u = 0;
  segs.push({ kind: 'arc', c: c1, a0: a1s, u0: u, len: (a1e - a1s) * c1.k }); u += (a1e - a1s) * c1.k;
  segs.push({ kind: 'line', p0: s1a, p1: s1b, u0: u, len: span }); u += span;
  segs.push({ kind: 'arc', c: c2, a0: a2s, u0: u, len: (a2e - a2s) * c2.k }); u += (a2e - a2s) * c2.k;
  segs.push({ kind: 'line', p0: s2a, p1: s2b, u0: u, len: span }); u += span;
  const L = u;
  function at(uu) {
    uu = ((uu % L) + L) % L;
    for (const s of segs) {
      if (uu > s.u0 + s.len && s !== segs[3]) continue;
      const t = uu - s.u0;
      if (s.kind === 'arc') { const a = s.a0 + t / s.c.k; return { y: s.c.y + s.c.r * Math.cos(a), z: s.c.z + s.c.r * Math.sin(a), ty: -Math.sin(a), tz: Math.cos(a) }; }
      const f = t / s.len, ty = s.p1[0] - s.p0[0], tz = s.p1[1] - s.p0[1], l = Math.hypot(ty, tz);
      return { y: s.p0[0] + ty * f, z: s.p0[1] + tz * f, ty: ty / l, tz: tz / l };
    }
  }
  return { L, at, a1: a1s, a2: a2s, U2: segs[2].u0 };
}
// odległość osi dobrana tak, by łańcuch miał całkowitą, parzystą liczbę ogniw (kierunek dir od koła 1)
export function chainDistance(z1, z2, p, approx) {
  const R1 = p / (2 * Math.sin(Math.PI / z1)), R2 = p / (2 * Math.sin(Math.PI / z2));
  const L = (D) => loopPath({ y: 0, z: 0, r: R1, k: z1 / TAU }, { y: D, z: 0, r: R2, k: z2 / TAU }, p).L;
  let N = Math.round(L(approx)); if (N % 2) N++;
  let lo = approx * 0.7, hi = approx * 1.4;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (L(mid) < N) lo = mid; else hi = mid; }
  return { D: (lo + hi) / 2, N, R1, R2 };
}

/* ---------------- łańcuch rolkowy (ANSI 40 / 08A) ---------------- */
// ogniwa jako instancje: rolki, płytki wewnętrzne i zewnętrzne (kształt „ósemki”), sworznie; update(u) — przesunięcie
// łańcucha w podziałkach
export function chainLoop(path, N, { p = 0.0127, d1 = 0.00792, x = 0 } = {}) {
  const M = materials(), g = new THREE.Group(); g.name = `Łańcuch rolkowy 08A, ${N} ogniw`;
  const plate = (h, t) => {   // płytka: dwa półkola połączone przewężeniem
    const s = new THREE.Shape(), r = h / 2;
    s.absarc(0, 0, r, Math.PI / 2, Math.PI * 1.5, false); s.lineTo(p / 2, -r * 0.78); s.lineTo(p, -r);
    s.absarc(p, 0, r, -Math.PI / 2, Math.PI / 2, false); s.lineTo(p / 2, r * 0.78); s.lineTo(0, r);
    s.holes.push(circlePath(d1 * 0.28, 16, 0, 0), circlePath(d1 * 0.28, 16, p, 0));
    // kształt w (sx = wzdłuż ogniwa, sy = w poprzek drogi) wyciągnięty na grubość → oś x świata = grubość
    return extrude(s, t, 0.0002, 12);
  };
  const inner = plate(0.0118, 0.0015), outer = plate(0.0104, 0.0015), roller = cyl(d1 / 2, 0.0078, 16), pin = cyl(0.00198, 0.0178, 10);
  const half = Math.floor(N / 2), mk = (geo, mat, n) => { const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; g.add(im); return im; };
  const iIn = mk(inner, M.steel, half * 2), iOut = mk(outer, M.steel, half * 2), iRol = mk(roller, M.dark, N), iPin = mk(pin, M.steel, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), basis = new THREE.Matrix4();
  const OFF_IN = 0.0047, OFF_OUT = 0.0067;   // odsunięcie płytek od środka (połowa szerokości wewnętrznej + płytka)
  function update(u0) {
    const P = []; for (let k = 0; k <= N; k++) P.push(path.at(u0 + k));
    for (let k = 0; k < N; k++) {
      const a = P[k], b = P[k + 1], ty = b.y - a.y, tz = b.z - a.z, l = Math.hypot(ty, tz) || 1;
      // układ płytki: lokalne y świata = kierunek ogniwa, z = normalna drogi, x = grubość
      basis.makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, ty / l, tz / l), new THREE.Vector3(0, -tz / l, ty / l));
      q.setFromRotationMatrix(basis);
      const im = k % 2 ? iOut : iIn, off = k % 2 ? OFF_OUT : OFF_IN, j = Math.floor(k / 2) * 2;
      for (let s = 0; s < 2; s++) { pos.set(x + (s ? off : -off), a.y, a.z); m4.compose(pos, q, one); im.setMatrixAt(j + s, m4); }
      pos.set(x, a.y, a.z); m4.compose(pos, new THREE.Quaternion(), one); iRol.setMatrixAt(k, m4); iPin.setMatrixAt(k, m4);
    }
    for (const im of [iIn, iOut, iRol, iPin]) im.instanceMatrix.needsUpdate = true;
  }
  update(0);
  const mass = N * 0.0094;   // 08A: ok. 0,7 kg/m
  g.userData = { N, p, mass, update };
  return g;
}

/* ---------------- pas klinowy SPA ---------------- */
// przekrój trapezowy (13 × 10 mm) prowadzony po drodze; nadruk przesuwany teksturą (update(s) — przesunięcie w metrach)
export function beltLoop(path, { x = 0, label = 'SPA 1250 Lw' } = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 32;
  const cx = c.getContext('2d'); cx.fillStyle = '#1b1c1e'; cx.fillRect(0, 0, 512, 32);
  for (let i = 0; i < 512; i += 4) { cx.fillStyle = i % 8 ? '#1f2022' : '#18191b'; cx.fillRect(i, 0, 2, 32); }
  cx.fillStyle = '#d8d4c8'; cx.font = 'bold 15px sans-serif'; cx.fillText(label, 16, 21); cx.fillText(label, 272, 21);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0 });
  const sec = [[0.0045, -0.0066], [0.0045, 0.0066], [-0.0055, 0.0034], [-0.0055, -0.0034]];   // (normalna, oś x)
  const n = Math.ceil(path.L / 0.004), period = 0.5, pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const s = path.L * i / n, a = path.at(s), ny = a.tz, nz = -a.ty;   // normalna na zewnątrz pętli
    for (let k = 0; k <= 4; k++) { const [nn, xx] = sec[k % 4]; pos.push(x + xx, a.y + ny * nn, a.z + nz * nn); uv.push(s / period, k / 4); }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const a = i * 5 + k, b = a + 5; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = mesh(geo, mat); m.name = `Pas klinowy ${label}`;
  m.userData = { L: path.L, mass: path.L * 0.12, update: (s) => { tex.offset.x = -s / period; } };
  return m;
}

/* ---------------- wał, łożysko ---------------- */
export function shaft({ len = 1, r = 0.0125, mat = 'steel', name } = {}) {
  const M = materials(), g = newPart(name || `Wał Ø ${Math.round(r * 2000)} mm`);
  const s = mesh(cyl(r, len, 32), M[mat]); s.position.x = len / 2; g.userData.spin.add(s);
  const key = mesh(box(len * 0.92, 0.0018, r * 0.5), M.dark); key.position.set(len / 2, r - 0.0006, 0); g.userData.spin.add(key);   // rowek wpustu — widać obrót
  for (const e of [0, len]) { const ch = mesh(cyl(r * 0.86, 0.002, 32, r), M[mat]); ch.position.x = e ? len + 0.001 : -0.001; if (!e) ch.rotation.y = Math.PI; g.userData.spin.add(ch); }
  const mass = STEEL_RHO * Math.PI * r * r * len;
  Object.assign(g.userData, { len, r, mass, J: 0.5 * mass * r * r });
  return g;
}
// oprawa łożyska stojąca (UCP) na podstawie: oś na wysokości h nad podstawą
export function pillowBlock({ h = 0.12, r = 0.0125, name = 'Łożysko w oprawie stojącej UCP' } = {}) {
  const M = materials(), g = new THREE.Group(); g.name = name;
  const hc = 0.036, base = h - hc;
  const s = new THREE.Shape(); s.moveTo(-0.085, 0); s.lineTo(0.085, 0); s.lineTo(0.085, 0.016); s.lineTo(0.036, 0.019);
  s.absarc(0, hc, 0.038, -0.35, Math.PI + 0.35, false); s.lineTo(-0.085, 0.016); s.closePath();
  s.holes.push(circlePath(0.026, 40, 0, hc), circlePath(0.0065, 16, -0.064, 0.008), circlePath(0.0065, 16, 0.064, 0.008));
  // kształt (sx → z, sy → y), wyciągnięcie wzdłuż x (macierz o wyznaczniku +1)
  const SM = new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1);
  const hg = new THREE.ExtrudeGeometry(s, { depth: 0.036, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 24 });
  hg.translate(0, 0, -0.018).applyMatrix4(SM); uvScale(hg, 6);
  const hs = mesh(hg, M.paintGrey); hs.position.y = base; g.add(hs);
  const ring = mesh(cyl(0.026, 0.03, 32), M.steel); ring.position.y = h; g.add(ring);
  const nip = mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.012, 8), M.brass); nip.position.y = h + 0.044; g.add(nip);
  if (base > 0.12) {   // wysoka podpora: słupek z rury kwadratowej 60 × 60, blacha podstawy i blacha pod oprawą
    const post = mesh(box(0.06, base - 0.024, 0.06), M.paintGrey); post.position.y = base / 2; g.add(post);
    for (const [y, t] of [[0.006, 0.012], [base - 0.006, 0.012]]) { const pl = mesh(box(0.1, t, 0.2), M.iron); pl.position.y = y; g.add(pl); }
    for (const s of [-1, 1]) { const rib = mesh(box(0.006, 0.08, 0.07), M.paintGrey); rib.position.set(0, 0.052, s * 0.065); g.add(rib); }
  } else if (base > 0.002) { const ped = mesh(box(0.05, base, 0.19), M.iron); ped.position.y = base / 2; g.add(ped); }
  for (const z of [-0.064, 0.064]) { const b = mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 6), M.dark); b.position.set(0, base + 0.02, z); g.add(b); }
  return g;
}

/* ---------------- sprzęgła ---------------- */
// sprzęgło kłowe z gwiazdą z poliuretanu: dwie piasty po 3 kły, gwiazda między nimi; część a i b (obie wirują z wałami)
export function jawCoupling({ r = 0.032, bore = 0.0125 } = {}) {
  const M = materials(), mk = (side) => {
    const g = new THREE.Group(), hub = new THREE.Shape(); hub.absarc(0, 0, r, 0, TAU, false); hub.holes.push(boreHole(bore));
    const h = mesh(extrude(hub, 0.03, 0.0012), M.alu); h.position.x = side * 0.027; g.add(h);
    for (let k = 0; k < 3; k++) {
      const a0 = k * TAU / 3 + (side > 0 ? Math.PI / 3 : 0), s = new THREE.Shape();
      s.absarc(0, 0, r, a0 - 0.42, a0 + 0.42, false); s.absarc(0, 0, bore * 1.6, a0 + 0.42, a0 - 0.42, true);
      const jw = mesh(extrude(s, 0.02, 0.0008), M.alu); jw.position.x = side * 0.004; g.add(jw);
    }
    return g;
  };
  const spider = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const a0 = k * TAU / 6 + Math.PI / 6, s = new THREE.Shape();
    s.absarc(0, 0, r * 0.96, a0 - 0.16, a0 + 0.16, false); s.absarc(0, 0, bore * 1.7, a0 + 0.16, a0 - 0.16, true);
    spider.add(mesh(extrude(s, 0.017, 0.0008), M.poly));
  }
  const ring = new THREE.Shape(); ring.absarc(0, 0, bore * 2, 0, TAU, false); ring.holes.push(circlePath(bore * 1.15));
  spider.add(mesh(extrude(ring, 0.017, 0.0006), M.poly));
  return { a: mk(-1), b: mk(1), spider, mass: 0.42, J: 0.5 * 0.42 * r * r };
}
// sprzęgło kołnierzowe sztywne: dwie tarcze z piastami i 6 śrub
export function flangeCoupling({ r = 0.055, bore = 0.0125 } = {}) {
  const M = materials(), mk = (side) => {
    const g = new THREE.Group(), f = new THREE.Shape(); f.absarc(0, 0, r, 0, TAU, false); f.holes.push(boreHole(bore));
    const fl = mesh(extrude(f, 0.014, 0.001), M.iron); fl.position.x = side * 0.0075; g.add(fl);
    const hb = new THREE.Shape(); hb.absarc(0, 0, bore * 2.4, 0, TAU, false); hb.holes.push(boreHole(bore));
    const hub = mesh(extrude(hb, 0.03, 0.001), M.iron); hub.position.x = side * 0.029; g.add(hub);
    return g;
  };
  const bolts = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6, y = Math.cos(a) * r * 0.74, z = Math.sin(a) * r * 0.74;
    const b = mesh(cyl(0.004, 0.036, 10), M.steel); b.position.set(0, y, z); bolts.add(b);
    for (const s of [-1, 1]) { const hx = mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 6).rotateZ(Math.PI / 2), M.dark); hx.position.set(s * 0.018, y, z); bolts.add(hx); }
  }
  return { a: mk(-1), b: mk(1), bolts, mass: 2.6, J: 0.5 * 2.6 * r * r * 0.8 };
}
// widełki przegubu Cardana na końcu wału: piasta wzdłuż +x i dwa ramiona z oczkami; sworznie wzdłuż lokalnego y (oś krzyżaka)
export function yoke({ r = 0.026, reach = 0.05, name = 'Widełki przegubu' } = {}) {
  const M = materials(), g = new THREE.Group(); g.name = name;
  const hub = mesh(cyl(0.019, 0.03, 24), M.gear); hub.position.x = -reach + 0.015; g.add(hub);
  const bridge = mesh(box(0.012, r * 2 + 0.014, 0.03), M.gear); bridge.position.x = -reach + 0.03; g.add(bridge);
  for (const s of [-1, 1]) {
    const arm = mesh(box(reach - 0.024, 0.009, 0.03), M.gear); arm.position.set(-(reach - 0.024) / 2 - 0.006, s * (r + 0.0025), 0); g.add(arm);
    const eye = mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.012, 24), M.gear); eye.position.set(0, s * (r + 0.004), 0); g.add(eye);
  }
  return g;
}
// krzyżak: dwa czopy prostopadłe (lokalne y i z) z miseczkami łożysk igiełkowych
export function cross({ r = 0.026 } = {}) {
  const M = materials(), g = new THREE.Group(); g.name = 'Krzyżak przegubu';
  g.add(mesh(new THREE.SphereGeometry(0.012, 16, 12), M.steel));
  for (const ax of ['y', 'z']) {
    const c = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, r * 2, 12), M.steel); if (ax === 'z') c.rotation.x = Math.PI / 2; g.add(c);
    for (const s of [-1, 1]) { const cup = mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.009, 16), M.dark); cup.position[ax] = s * (r - 0.002); if (ax === 'z') cup.rotation.x = Math.PI / 2; g.add(cup); }
  }
  return g;
}

/* ---------------- silnik ---------------- */
// trójfazowy silnik indukcyjny 1,1 kW, wielkość 90: oś 90 mm nad łapami; wał wyjściowy na +x
export function motor({ name = 'Silnik indukcyjny 1,1 kW' } = {}) {
  const M = materials(), g = newPart(name), H = 0.09, L = 0.25;
  const body = mesh(cyl(0.083, L, 40), M.paintBlue); body.position.set(-L / 2 - 0.04, H, 0); g.add(body);
  const fins = new THREE.InstancedMesh(box(L * 0.92, 0.014, 0.0035), M.paintBlue, 30); fins.castShadow = true; fins.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let k = 0; k < 30; k++) { const a = k * TAU / 30; e.set(a, 0, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(-L / 2 - 0.04, H + Math.cos(a) * 0.09, Math.sin(a) * 0.09), q, new THREE.Vector3(1, 1, 1)); fins.setMatrixAt(k, m4); }
  g.add(fins);
  const bellF = mesh(lathe([[0.012, 0.0], [0.05, 0.0], [0.086, 0.025], [0.086, 0.04], [0.012, 0.04]], 40), M.paintBlue); bellF.position.set(-0.04, H, 0); g.add(bellF);
  const cowl = mesh(cyl(0.09, 0.08, 40), M.paintBlue); cowl.position.set(-L - 0.08, H, 0); g.add(cowl);
  const grill = mesh(new THREE.CircleGeometry(0.084, 40).rotateY(-Math.PI / 2), M.black); grill.position.set(-L - 0.121, H, 0); g.add(grill);
  const tbox = mesh(box(0.1, 0.06, 0.1), M.paintBlue); tbox.position.set(-0.15, H + 0.11, 0); g.add(tbox);
  const lid = mesh(box(0.104, 0.008, 0.104), M.paintBlue); lid.position.set(-0.15, H + 0.144, 0); g.add(lid);
  const plateN = mesh(box(0.06, 0.0015, 0.035), M.alu); plateN.position.set(-0.22, H + 0.085, 0.045); plateN.rotation.x = 0.9; g.add(plateN);
  for (const x of [-0.08, -0.25]) { const foot = mesh(box(0.04, 0.012, 0.18), M.paintBlue); foot.position.set(x, 0.006, 0); g.add(foot); const web = mesh(box(0.03, H - 0.05, 0.11), M.paintBlue); web.position.set(x, (H - 0.05) / 2 + 0.01, 0); g.add(web); }
  // wał wyjściowy (wiruje)
  const sh = mesh(cyl(0.012, 0.05, 24), M.steel); sh.position.x = 0.025; g.userData.spin.add(sh);
  const key = mesh(box(0.042, 0.002, 0.006), M.dark); key.position.set(0.025, 0.0115, 0); g.userData.spin.add(key);
  g.userData.spin.position.y = H;
  Object.assign(g.userData, { H, mass: 15.5, J: 0.0028 });   // wirnik 1,1 kW: ok. 0,0028 kg·m² (dane katalogowe)
  return g;
}

/* ---------------- obudowa z akrylu ---------------- */
// prostopadłościan: szyby z akrylu i profile aluminiowe 20 × 20 na krawędziach; size [x, y, z], środek w (0, 0, 0)
export function housing(size, { frame = 0.02, name = 'Obudowa (akryl, profile 20 × 20)' } = {}) {
  const M = materials(), g = new THREE.Group(); g.name = name;
  const [sx, sy, sz] = size, panes = new THREE.Group(); panes.name = 'szyby';
  for (const [w, h, p, r] of [[sx, sy, [0, 0, sz / 2], [0, 0, 0]], [sx, sy, [0, 0, -sz / 2], [0, 0, 0]], [sz, sy, [sx / 2, 0, 0], [0, Math.PI / 2, 0]], [sz, sy, [-sx / 2, 0, 0], [0, Math.PI / 2, 0]], [sx, sz, [0, sy / 2, 0], [Math.PI / 2, 0, 0]]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.acrylic); m.position.set(...p); m.rotation.set(...r); m.renderOrder = 5; panes.add(m);
  }
  g.add(panes);
  const f = frame;
  for (const sy2 of [-1, 1]) for (const sz2 of [-1, 1]) { const e = mesh(box(sx + f, f, f), M.alu); e.position.set(0, sy2 * sy / 2, sz2 * sz / 2); g.add(e); }
  for (const sx2 of [-1, 1]) for (const sz2 of [-1, 1]) { const e = mesh(box(f, sy, f), M.alu); e.position.set(sx2 * sx / 2, 0, sz2 * sz / 2); g.add(e); }
  for (const sx2 of [-1, 1]) for (const sy2 of [-1, 1]) { const e = mesh(box(f, f, sz), M.alu); e.position.set(sx2 * sx / 2, sy2 * sy / 2, 0); g.add(e); }
  g.userData.panes = panes;
  return g;
}
// cylindryczna obudowa z akrylu (rura) z aluminiowymi pierścieniami, oś wzdłuż x
export function tubeHousing({ r = 0.1, len = 0.1, name = 'Obudowa (rura z akrylu)' } = {}) {
  const M = materials(), g = new THREE.Group(); g.name = name;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 48, 1, true).rotateZ(-Math.PI / 2), M.acrylic); tube.renderOrder = 5;
  const panes = new THREE.Group(); panes.add(tube);
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.RingGeometry(0.02, r, 48).rotateY(Math.PI / 2), M.acrylic); cap.position.x = s * len / 2; cap.renderOrder = 5; panes.add(cap); const rg = mesh(new THREE.TorusGeometry(r, 0.005, 8, 48).rotateY(Math.PI / 2), M.alu); rg.position.x = s * len / 2; g.add(rg); }
  g.add(panes); g.userData.panes = panes;
  return g;
}

export const MechKit = { materials, gear, ringGear, sprocket, pulley, loopPath, chainDistance, chainLoop, beltLoop, shaft, pillowBlock, jawCoupling, flangeCoupling, yoke, cross, motor, housing, tubeHousing, involuteOutline };
