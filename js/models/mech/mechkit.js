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
const RHO = { gear: STEEL_RHO, steel: STEEL_RHO, dark: STEEL_RHO, brass: BRASS_RHO, iron: IRON_RHO, alu: ALU_RHO };
const TAU = Math.PI * 2, ALPHA = 20 * Math.PI / 180;

/* ---------------- materiały ---------------- */
let MATS = null;
// ---------------- właściwości fizyczne części (userData.phys) ----------------
// Każda część niesie swoje dane fizyczne — laboratorium / gra tylko je czyta (fizyka: js/behaviors/mech/physics.js):
//   eta  — sprawność połączenia, które ta część tworzy (zazębienie, łańcuch, pas, przegub, przekładnia)
//   k    — sztywność skrętna, N·m/rad (albo dane, z których się ją liczy: G, EA, c), zeta — tłumienie względne
//   luz  — pocienienie zęba na kole podziałowym (m), z którego razem z drugim kołem wychodzi luz obwodowy
export const G_STEEL = 80e9;   // moduł Kirchhoffa stali, Pa
export const G_MAT = { steel: G_STEEL, iron: 45e9, brass: 37e9, alu: 26e9 };   // moduł Kirchhoffa wg materiału wału, Pa
export const PHYS = {
  mesh: { c: 2e10, zeta: 0.05, eta: 0.98, thin: 0.04 },   // zazębienie walcowe: k = c·b·r_b² (b — szerokość wspólna); ząb cieńszy o thin·m
  shaft: { G: G_STEEL, zeta: 0.02 },                      // wał: k = G·π·d⁴ / (32·L), G wg materiału (G_MAT)
  spider: { '92A': 1300, '98A': 2300, '64D': 4500 },      // gwiazda sprzęgła kłowego (poliuretan), N·m/rad wg twardości
  jaw: { zeta: 0.07, eta: 0.995 },
  flange: { k: 1.5e5, zeta: 0.02, eta: 0.995 },
  chain: { EA: 2e6, zeta: 0.03, eta: 0.97 },              // łańcuch 08A: sztywność cięgna EA (N) → k = EA / D · R₂²
  belt: { EA: 4e4, zeta: 0.08, eta: 0.95, F0: 300, mu: 0.3, groove: 36, kinetic: 0.85, creep: 0.015 },   // pas klinowy: napięcie wstępne F0 (N) w cięgnie, μ, kąt rowka (°), tarcie kinetyczne / statyczne, pełzanie przy granicy
  ujoint: { k: 2e5, zeta: 0.02, eta: 0.99, mu: 0.05, rc: 0.0055, R: 0.026, clear: 0.00002 },   // przegub Cardana: krzyżak w łożyskach igiełkowych — tarcie efektywne, czop r_c, ramię R, luz promieniowy łożyska (m)
  planetary: { k: 3e5, zeta: 0.03, eta: 0.97 },           // przekładnia planetarna (zestaw: słoneczne, satelity, korona)
  bearing: { drag: 0.0004 },                              // łożysko toczne: opór lepki, N·m·s/rad
  rack: { c: 2e10, zeta: 0.05, eta: 0.98, thin: 0.04 },   // listwa zębata z kołem: k = c·b (N/m — współrzędna listwy w metrach), ząb cieńszy o thin·m
  screw: { ball: { eta: 0.9, k: 2e8, zeta: 0.03 }, trap: { eta: 0.35, k: 3e8, zeta: 0.05 } },   // śruba kulowa / trapezowa: sprawność, sztywność osiowa nakrętki (N/m)
  crank: { eta: 0.97, k: 1e8, zeta: 0.03 },               // mechanizm korbowy: sprawność (dwa sworznie w łożyskach ślizgowych), sztywność korbowodu EA / l
  slide: { mu: 0.003 },                                    // prowadnica toczna: współczynnik oporu
};
// rodzaje portów (dziedziny): każdy port ma dziedzinę (to, co przenosi) i złącze (jak się łączy). Połączyć można złącza
// tej samej nazwy; dziedziny mogą się różnić tylko w połączeniu, które zamienia ruch (listwa, śruba, korba)
export const DOMAIN = { rot: 'obrót', lin: 'przesuw', el: 'prąd', sig: 'sygnał', fluid: 'płyn', light: 'światło' };
const port = (name, domain, iface, extra = {}) => ({ name, domain, iface, ...extra });
// silnik — dane elektryczne (userData.elec): sprawność, cos φ, prąd znamionowy z mocy, prąd biegu jałowego (ułamek In),
// straty jałowe (ułamek mocy), napięcie i częstotliwość znamionowa
export const MOTOR_ELEC = { eta: 0.84, cosPhi: 0.77, U: 400, f: 50, k0: 0.6, p0: 0.05 };
// faza w przekładni planetarnej (ψ_k = k·2π/n): kąt satelity k w jarzmie dla kąta względnego słonecznego `rel`
// i obrót korony, przy którym wrąb korony stoi naprzeciw zęba satelity 0 (zęby się nie przenikają — sprawdzone
// bryłami zderzeń, js/behaviors/mech/contact.js)
export function planetPhase(zs, zp, zr, n) {
  const p0 = Math.PI + Math.PI / zp, off = p0 - Math.round(p0 / (TAU / zp)) * (TAU / zp);
  return { ring: off * zp / zr, planet: (k, rel) => { const psi = k * TAU / n; return -(zs / zp) * (rel - psi) + psi + Math.PI + Math.PI / zp; } };
}

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
// pierścień (rura krótka) wzdłuż osi x / y: otwór ri, zewnętrzny ro, szerokość w — do opraw, oczek, tulei (zamiast brył)
const ringX = (ri, ro, w, seg = 40) => lathe([[ri, -w / 2], [ro, -w / 2], [ro, w / 2], [ri, w / 2], [ri, -w / 2]], seg);
const ringY = (ri, ro, h, seg = 32) => uvScale(new THREE.LatheGeometry([[ri, -h / 2], [ro, -h / 2], [ro, h / 2], [ri, h / 2], [ri, -h / 2]].map(([r, y]) => new THREE.Vector2(r, y)), seg), 3);
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
export function involuteOutline(z, m, { add = 1, ded = 1.25, steps = 7, backlash = 0.04, alpha = ALPHA } = {}) {
  const ALPHA_ = alpha, rp = m * z / 2, rb = rp * Math.cos(ALPHA_), ra = rp + add * m, rf = rp - ded * m;
  const inv = Math.tan(ALPHA_) - ALPHA_, half = Math.PI / (2 * z) - backlash / z + inv;   // połowa grubości zęba na kole zasadniczym (kąt)
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

// bryły zderzeń zębów: każdy ząb to wielokąt wypukły — zarys od stopy do głowy, zamknięty cięciwą na kole stóp
// (ten sam zarys co model, więc bryła = ząb); punkty [x, y] w płaszczyźnie koła (lokalne y, z części wirującej)
export function toothHulls(z, m, { alpha = ALPHA, backlash = 0.04 } = {}) {
  const o = involuteOutline(z, m, { alpha, backlash }), n = o.pts.length / z, out = [];
  for (let i = 0; i < z; i++) out.push(o.pts.slice(i * n + 1, (i + 1) * n).map((p) => [p.x, p.y]));
  return out;
}

// podział wielokąta prostego na wypukłe (strzyżenie uszu + scalanie Hertela–Mehlhorna) — bryły zderzeń zębów,
// których zarys nie jest wypukły (koło łańcuchowe, zęby wewnętrzne koła koronowego); punkty [x, y]
export function convexParts(poly) {
  let P = poly.slice(); const area = P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);
  if (area < 0) P.reverse();
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  const inTri = (p, a, b, c) => cr(a, b, p) > 0 && cr(b, c, p) > 0 && cr(c, a, p) > 0;
  const idx = P.map((_, i) => i), tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
      if (cr(P[i0], P[i1], P[i2]) <= 1e-18) continue;
      if (idx.some((j) => j !== i0 && j !== i1 && j !== i2 && inTri(P[j], P[i0], P[i1], P[i2]))) continue;
      tris.push([i0, i1, i2]); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) { const k = idx.findIndex((_, k) => cr(P[idx[(k + idx.length - 1) % idx.length]], P[idx[k]], P[idx[(k + 1) % idx.length]]) <= 1e-18); idx.splice(k < 0 ? 0 : k, 1); }   // punkt współliniowy
  }
  if (idx.length === 3) tris.push(idx.slice());
  const parts = tris.slice(), convex = (q) => q.every((_, i) => cr(P[q[i]], P[q[(i + 1) % q.length]], P[q[(i + 2) % q.length]]) >= -1e-15);
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) {
      const A = parts[a], B = parts[b];
      for (let i = 0; i < A.length; i++) {
        const u = A[i], v = A[(i + 1) % A.length], j = B.indexOf(v);
        if (j < 0 || B[(j + 1) % B.length] !== u) continue;   // wspólna przekątna u–v (w B przeciwnie)
        const q = [...A.slice(0, i + 1)];
        for (let k = (j + 2) % B.length; k !== j; k = (k + 1) % B.length) q.push(B[k]);
        q.push(...A.slice(i + 1));
        if (!convex(q)) continue;
        parts[a] = q; parts.splice(b, 1); merged = true; break outer;
      }
    }
  }
  return parts.map((q) => q.map((i) => P[i]));
}
// koło łańcuchowe: ząb między gniazdami rolek k i k + 1 (zamknięty cięciwą przez dna gniazd), części wypukłe
export function sprocketHulls(z, p, d1) {
  const o = sprocketOutline(z, p, d1), n = SPROCKET_SAMPLES, out = [];
  for (let k = 0; k < z; k++) {
    const poly = []; for (let i = 0; i <= n; i++) { const q = o.pts[(k * n + i) % o.pts.length]; poly.push([q.x, q.y]); }
    out.push({ parts: convexParts(poly), ang: (k + 0.5) * TAU / z });
  }
  return out;
}
// koło koronowe: ząb wewnętrzny = wrąb zarysu otworu między jego „zębami” i oraz i + 1, domknięty na zewnątrz
// (promień głowy wrębu + 0,5·m — dalej jest wieniec); części wypukłe
export function ringHulls(z, m) {
  const o = involuteOutline(z, m, { add: 1.25, ded: 1, backlash: -0.04 }), n = o.pts.length, pz = TAU / z, Ro = o.ra + 0.5 * m, out = [];
  const wrap = (a) => { a %= TAU; return a < 0 ? a + TAU : a; };
  for (let i = 0; i < z; i++) {
    const c = i * pz, poly = [];
    for (let j = 0; j < 2 * n / z + 2; j++) { const q = o.pts[(i * n / z + j) % n], d = wrap(Math.atan2(q.y, q.x) - c + 1e-9) - 1e-9; if (d >= -1e-9 && d <= pz + 1e-9 && !(j > n / z && d < pz / 2)) poly.push([q.x, q.y]); }
    const a0 = Math.atan2(poly[0][1], poly[0][0]), a1 = Math.atan2(poly[poly.length - 1][1], poly[poly.length - 1][0]);
    poly.push([Ro * Math.cos(a1), Ro * Math.sin(a1)], [Ro * Math.cos(a0), Ro * Math.sin(a0)]);
    out.push({ parts: convexParts(poly), ang: c + pz / 2 });
  }
  return out;
}

/* ---------------- zamiana ruchu: listwa zębata, suwak w prowadnicy, korbowód, śruba pociągowa z nakrętką ---------------- */
// listwa zębata (moduł m, n zębów): zarys w płaszczyźnie (y, z) — linia podziałowa z = 0 wzdłuż y (0 … n·p), zęby w +z,
// szerokość wzdłuż x. Zęby wypukłe (trapezy zarysu odniesienia, kąt 20°), ząb cieńszy o backlash·m jak w kołach.
export function rackHulls(m, n, { backlash = 0.04 } = {}) {
  const p = Math.PI * m, s2 = p / 4 - backlash * m / 2, t = Math.tan(ALPHA), hr = s2 + 1.25 * m * t, ht = s2 - m * t, out = [];
  for (let i = 0; i < n; i++) { const c = (i + 0.5) * p; out.push([[c - hr, -1.25 * m], [c + hr, -1.25 * m], [c + ht, m], [c - ht, m]]); }
  return out;
}
function rackShape(m, n, hb, y0 = 0) {
  const p = Math.PI * m, hulls = rackHulls(m, n), sh = new THREE.Shape(), L = n * p;
  sh.moveTo(y0, -1.25 * m - hb); sh.lineTo(y0 + L, -1.25 * m - hb); sh.lineTo(y0 + L, -1.25 * m);
  for (let i = n - 1; i >= 0; i--) { const q = hulls[i]; sh.lineTo(y0 + q[1][0], q[1][1]); sh.lineTo(y0 + q[2][0], q[2][1]); sh.lineTo(y0 + q[3][0], q[3][1]); sh.lineTo(y0 + q[0][0], q[0][1]); }
  sh.lineTo(y0, -1.25 * m); sh.closePath();
  return sh;
}
// listwa sama (przesuwna część w userData.slide, ruch wzdłuż lokalnego y); linia podziałowa na z = 0, listwa od y = 0
export function rack({ m = 0.0015, n = 40, w = 0.012, hb = 0.01, name } = {}) {
  const M = materials(), g = new THREE.Group(), slide = new THREE.Group(); g.add(slide); g.name = name || `Listwa zębata m${m * 1000}, ${n} zębów`;
  slide.add(mesh(extrude(rackShape(m, n, hb), w, 0.0003, 4), M.gear));
  const L = n * Math.PI * m, mass = STEEL_RHO * w * L * (hb + 1.6 * m);
  Object.assign(g.userData, { slide, slideAxis: 'y', m, n, p: Math.PI * m, L, w, hb, rack: true, mass, J: mass,
    phys: { ...PHYS.rack, luz: PHYS.rack.thin * m }, ports: { mesh: port('Zazębienie', DOMAIN.lin, 'zazębienie'), mount: port('Mocowanie', DOMAIN.lin, 'mocowanie') } });
  return g;
}
// suwak w prowadnicy (ruch wzdłuż lokalnego y, góra = +z): wózek na dwóch szynach, sworzeń korbowodu z boku (−x),
// opcjonalnie listwa zębata na wózku (rack: { m, n, w }) — jedna część przesuwna
export function slider({ len = 0.07, w = 0.04, h = 0.03, travel = 0.24, rack: rk = null, name } = {}) {
  const M = materials(), g = new THREE.Group(), slide = new THREE.Group(); g.add(slide); g.name = name || 'Suwak w prowadnicy';
  const railL = travel + len, rz = -h / 2 - 0.006;
  for (const sx of [-1, 1]) { const r = mesh(box(0.008, railL, 0.012), M.steel); r.position.set(sx * (w / 2 - 0.006), 0, rz); g.add(r); }
  const plate = mesh(box(w + 0.02, railL + 0.02, 0.008), M.iron); plate.position.z = rz - 0.01; g.add(plate);
  const blk = mesh(box(w, len, h), M.dark); slide.add(blk);
  const pin = mesh(cyl(0.006, 0.016, 20), M.steel); pin.position.set(-w / 2 - 0.008, 0, 0); slide.add(pin);
  let mass = STEEL_RHO * w * len * h * 0.8, rackInfo = null;
  if (rk) {
    const m = rk.m || 0.0015, n = rk.n || 30, rw = rk.w || 0.012, hb = 0.008, L = n * Math.PI * m;
    const bar = mesh(extrude(rackShape(m, n, hb, -L / 2), rw, 0.0003, 4), M.gear); bar.position.z = h / 2 + hb + 1.25 * m; slide.add(bar);
    mass += STEEL_RHO * rw * L * (hb + 1.6 * m);
    rackInfo = { m, n, w: rw, L, p: Math.PI * m, y0: -L / 2, z: h / 2 + hb + 1.25 * m, luz: PHYS.rack.thin * m };
  }
  Object.assign(g.userData, { slide, slideAxis: 'y', len, w, h, travel, pin: new THREE.Vector3(-w / 2 - 0.008, 0, 0), rack: rackInfo, mass, J: mass,
    phys: { ...PHYS.slide, ...(rackInfo ? { ...PHYS.rack, luz: rackInfo.luz } : {}) },
    ports: { pin: port('Sworzeń korbowodu', DOMAIN.lin, 'sworzeń'), ...(rackInfo ? { mesh: port('Listwa — zazębienie', DOMAIN.lin, 'zazębienie') } : {}) } });
  return g;
}
// korbowód (oczka na obu końcach, oś wzdłuż lokalnego +x od 0 do l): położenie z punktów sworzni — pose(A, B)
export function conRod({ l = 0.2, w = 0.014, t = 0.008, name } = {}) {
  const M = materials(), g = new THREE.Group(); g.name = name || 'Korbowód';
  // oczka z tulejami z brązu (łożyska ślizgowe sworzni Ø 12) — sworzeń przechodzi przez tuleję, trzon między oczkami
  const ro = w * 0.85, rb = 0.006, rt = rb + 0.0015, body = mesh(box(l - 2 * ro + 0.004, w, t), M.dark); body.position.x = l / 2; g.add(body);
  for (const x of [0, l]) {
    const eye = mesh(ringY(rt, ro, t * 1.2, 28).rotateX(Math.PI / 2), M.dark); eye.position.x = x; g.add(eye);
    const bush = mesh(ringY(rb, rt, t * 1.2, 28).rotateX(Math.PI / 2), M.brass); bush.position.x = x; g.add(bush);
  }
  const v = new THREE.Vector3(), X1 = new THREE.Vector3(1, 0, 0);
  const pose = (A, B) => { g.position.copy(A); v.subVectors(B, A).normalize(); g.quaternion.setFromUnitVectors(X1, v); };
  const mass = STEEL_RHO * l * w * t;
  Object.assign(g.userData, { l, mass, pose, phys: { ...PHYS.crank } });
  return g;
}
// śruba pociągowa (oś wzdłuż +x od 0 do len): rdzeń z bruzdą śrubową, czopy na końcach; część obracająca się w spin
export function leadScrew({ d = 0.02, lead = 0.02, len = 0.5, starts = 1, kind = 'ball', thread = null, name } = {}) {
  // thread: [x0, x1] — odcinek gwintowany (dalej czopy łożyskowe Ø 0,84·d); bez — gwint na całej długości
  const M = materials(), g = newPart(name || `Śruba ${kind === 'ball' ? 'kulowa' : 'trapezowa'} Ø${Math.round(d * 1000)}×${Math.round(lead * 1000)}`), sp = g.userData.spin;
  const rc = d * 0.42, [t0, t1] = thread || [0, len];
  const core = mesh(cyl(rc, len, 32), M.steel); core.position.x = len / 2; sp.add(core);
  const turns = (t1 - t0) / lead * starts, pts = [];
  for (let st = 0; st < starts; st++) {
    pts.length = 0; const n = Math.max(24, Math.round(turns / starts * 12));
    for (let i = 0; i <= n; i++) { const u = i / n, x = t0 + u * (t1 - t0), a = (x - t0) / lead * TAU + st * TAU / starts; pts.push(new THREE.Vector3(x, rc * Math.cos(a), rc * Math.sin(a))); }
    const th = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice()), n * 2, d * 0.09, 6), M.steel); sp.add(th);
    for (const q of [pts[0], pts[pts.length - 1]]) { const cap = mesh(new THREE.SphereGeometry(d * 0.09, 8, 6), M.steel); cap.position.copy(q); sp.add(cap); }   // zakończenia bruzdy
  }
  const mass = STEEL_RHO * Math.PI * (d * 0.45) ** 2 * len, ph = PHYS.screw[kind] || PHYS.screw.ball;
  Object.assign(g.userData, { d, lead, len, starts, kind, thread: [t0, t1], r: rc, rj: rc, mass, J: 0.5 * mass * (d * 0.45) ** 2, phys: { ...ph },
    ports: { a: port('Czop A', DOMAIN.rot, 'wał'), b: port('Czop B', DOMAIN.rot, 'wał'), thread: port('Gwint', DOMAIN.rot, 'gwint') } });
  return g;
}
// nakrętka śruby z wózkiem na prowadnicy (ruch wzdłuż lokalnego x — oś śruby; góra = +y): nakrętka z kołnierzem,
// wózek pod nią, szyna nieruchoma na wysokości −hc (podłoże); kierunek gwintu przenosi połączenie 'screw'
export function screwNut({ d = 0.02, lead = 0.02, kind = 'ball', hc = 0.06, travel = 0.12, name } = {}) {
  const M = materials(), g = new THREE.Group(), slide = new THREE.Group(); g.add(slide); g.name = name || `Nakrętka ${kind === 'ball' ? 'kulowa' : 'trapezowa'} z wózkiem`;
  // nakrętka i kołnierz jako pierścienie: otwór na śrubę (kulki w bieżni — luz 0,5 mm do gwintu)
  const ro = d * 0.85, ri = d * 0.51 + 0.0005, nut = mesh(ringX(ri, ro, 0.05, 32), M.dark); slide.add(nut);
  const fl = mesh(ringX(ri, ro * 1.7, 0.01, 32), M.dark); fl.position.x = -0.03; slide.add(fl);
  const car = mesh(box(0.06, hc - ro - 0.022, 0.05), M.alu); car.position.y = -(ro + (hc - ro - 0.022) / 2); slide.add(car);
  const shoe = mesh(box(0.066, 0.014, 0.04), M.steel); shoe.position.y = -hc + 0.019; slide.add(shoe);
  const rail = mesh(box(travel + 0.08, 0.012, 0.02), M.steel); rail.position.y = -hc + 0.006; g.add(rail);
  const mass = 0.35 + ALU_RHO * 0.06 * 0.05 * (hc - ro), ph = PHYS.screw[kind] || PHYS.screw.ball;
  Object.assign(g.userData, { slide, slideAxis: 'x', d, lead, kind, hc, travel, mass, J: mass, phys: { ...ph, ...PHYS.slide },
    ports: { thread: port('Gwint nakrętki', DOMAIN.lin, 'gwint'), mount: port('Wózek — mocowanie', DOMAIN.lin, 'mocowanie') } });
  return g;
}

/* ---------------- łożyska (osobno, do osadzenia w oprawie / obudowie) ---------------- */
// Dane katalogowe dla d = 25 mm (inne średnice — skalowane, ok.): C — nośność dynamiczna, C0 — statyczna (N),
// n — prędkość graniczna (obr/min), mu — współczynnik tarcia (moment M = μ·P·d/2), p — wykładnik trwałości
// (L10 = (C/P)^p · 10⁶ obrotów), Z — liczba elementów tocznych, Dw — ich średnica, alpha — kąt działania
export const BEARINGS = {
  ball: { name: 'Kulkowe zwykłe 6205', D: 0.052, B: 0.015, C: 14800, C0: 7800, n: 18000, mu: 0.0015, p: 3, Z: 9, Dw: 0.00794, alpha: 0, load: 'promieniowe, osiowe do 0,5·C0' },
  roller: { name: 'Walcowe NU 205', D: 0.052, B: 0.015, C: 28600, C0: 27000, n: 15000, mu: 0.0011, p: 10 / 3, Z: 12, Dw: 0.0065, alpha: 0, load: 'promieniowe (duże), bez osiowych' },
  taper: { name: 'Stożkowe 30205', D: 0.052, B: 0.01625, C: 32500, C0: 37000, n: 9000, mu: 0.0018, p: 10 / 3, Z: 15, Dw: 0.0065, alpha: 14 * Math.PI / 180, load: 'promieniowe i osiowe w jedną stronę (para)' },
  thrust: { name: 'Wzdłużne kulkowe 51105', D: 0.042, B: 0.011, C: 15900, C0: 32000, n: 6000, mu: 0.0013, p: 3, Z: 14, Dw: 0.00635, alpha: Math.PI / 2, load: 'tylko osiowe' },
  needle: { name: 'Igiełkowe NK 25/20', D: 0.033, B: 0.02, C: 22000, C0: 32000, n: 13000, mu: 0.0025, p: 10 / 3, Z: 22, Dw: 0.0025, alpha: 0, load: 'promieniowe, mała wysokość' },
  plain: { name: 'Tuleja ślizgowa z brązu (smarowana)', D: 0.03, B: 0.02, C: 0, C0: 0, n: 1500, mu: 0.06, p: 0, Z: 0, Dw: 0, alpha: 0, load: 'promieniowe, p·v ≤ 1,6 MPa·m/s' },
};
// łożysko toczne lub ślizgowe: pierścień zewnętrzny nieruchomy (mocowanie), wewnętrzny w spin, elementy toczne
// w userData.cage (koszyk obraca się z prędkością ω·(1 − Dw·cos α / dm)/2); oś wzdłuż +x
export function rollingBearing({ type = 'ball', d = 0.025, seal = false, name } = {}) {   // seal: uszczelnienia 2RS (kulki zakryte)
  const M = materials(), b0 = BEARINGS[type] || BEARINGS.ball, k = d / 0.025, D = b0.D * k, B = b0.B * k, Dw = b0.Dw * k;
  const g = newPart(name || `Łożysko ${b0.name}${k === 1 ? '' : ` (Ø ${Math.round(d * 1000)}, ok.)`}`), sp = g.userData.spin, cage = new THREE.Group(); g.add(cage);
  const dm = (d + D) / 2, r1 = d / 2, r2 = D / 2;
  const ring = (ri, ro, w, mat, x = 0) => { const m = mesh(lathe([[ri, -w / 2], [ro, -w / 2], [ro, w / 2], [ri, w / 2], [ri, -w / 2]]), mat); m.position.x = x; return m; };
  if (type === 'plain') {
    g.add(ring(r1 + 0.0002, r2, B, M.brass));   // tuleja w obudowie; wał obraca się w niej (luz 0,2 mm)
  } else if (type === 'thrust') {
    g.add(ring(r1 + 0.001, r2, B * 0.3, M.steel, B * 0.35)); sp.add(ring(r1, r2 - 0.001, B * 0.3, M.steel, -B * 0.35));   // podkładka obudowy / wałka
    for (let i = 0; i < b0.Z; i++) { const a = i * TAU / b0.Z, bl = mesh(new THREE.SphereGeometry(Dw / 2, 16, 12), M.steel); bl.position.set(0, dm / 2 * Math.cos(a), dm / 2 * Math.sin(a)); cage.add(bl); }
  } else {
    const t = (r2 - r1) * 0.28;
    g.add(ring(dm / 2 + Dw / 2 * 0.86, r2, B, M.steel)); sp.add(ring(r1, dm / 2 - Dw / 2 * 0.86, B, M.steel));
    for (let i = 0; i < b0.Z; i++) {
      const a = i * TAU / b0.Z, y = dm / 2 * Math.cos(a), z = dm / 2 * Math.sin(a);
      let el;
      if (type === 'ball') el = mesh(new THREE.SphereGeometry(Dw / 2, 16, 12), M.steel);
      else if (type === 'taper') el = mesh(cyl(Dw / 2 * 0.85, B * 0.7, 14, Dw / 2 * 1.1), M.steel);
      else el = mesh(cyl(Dw / 2, type === 'needle' ? B * 0.85 : B * 0.7, 14), M.steel);
      el.position.set(0, y, z);
      if (type === 'taper') el.quaternion.setFromAxisAngle(new THREE.Vector3(0, -Math.sin(a), Math.cos(a)), -b0.alpha);   // wałeczek pochylony o kąt działania
      cage.add(el);
    }
    if (type !== 'needle') { const cg = mesh(new THREE.TorusGeometry(dm / 2, t * 0.12, 6, 48).rotateY(Math.PI / 2), M.brass); cg.position.x = B * 0.36; cage.add(cg); }
    if (seal) for (const sx of [-1, 1]) { const sl = mesh(ringX(dm / 2 - Dw / 2 * 0.86, dm / 2 + Dw / 2 * 0.86, B * 0.06), M.rubber); sl.position.x = sx * B * 0.45; g.add(sl); }
  }
  const vol = Math.PI * (r2 * r2 - r1 * r1) * B * (type === 'plain' ? 1 : 0.62), mass = (type === 'plain' ? BRASS_RHO : STEEL_RHO) * vol, s = k ** 1.8;
  Object.assign(g.userData, { type, d, D, B, dm, Dw, Z: b0.Z, alpha: b0.alpha, cage, mass, J: 0.25 * mass * (r1 * r1 + dm * dm / 4),
    data: { ...b0, C: b0.C * s, C0: b0.C0 * s, n: b0.n / k },
    phys: { mu: b0.mu, drag: PHYS.bearing.drag }, ports: { bore: port('Otwór (wał)', DOMAIN.rot, 'łożysko'), housing: port('Obudowa (mocowanie)', DOMAIN.rot, 'mocowanie') },
    cageRatio: type === 'plain' ? 0 : (1 - Dw * Math.cos(b0.alpha) / dm) / 2 });
  return g;
}

/* ---------------- zębatka ---------------- */
export function gear({ z = 20, m = 0.004, w = 0.04, bore = 0.0125, key = true, mat = 'gear', hub = true, holes: lighten = true, alpha = 20, name } = {}) {   // key: false — gładki otwór (gniazdo łożyska)
  const M = materials(), o = involuteOutline(z, m, { alpha: alpha * Math.PI / 180 }), shape = new THREE.Shape(o.pts);
  bore = Math.min(bore, (o.rf - 0.5 * m) / 1.35);   // otwór z rowkiem wpustu (do 1,28 r) mieści się pod stopą zęba
  shape.holes.push(key ? boreHole(bore) : circlePath(bore, 40));
  const hubR = Math.max(bore * 1.9, bore + 0.012), ring = o.rf - 0.006 - 1.2 * m;
  let holes = 0;
  if (lighten && ring - hubR > 0.022) {   // otwory odciążające w tarczy
    holes = 6; const rm = (ring + hubR) / 2, rr = Math.min((ring - hubR) * 0.36, rm * Math.sin(Math.PI / holes) * 0.75);   // otwory nie nachodzą na siebie
    for (let k = 0; k < holes; k++) shape.holes.push(circlePath(rr, 32, rm * Math.cos(k * TAU / holes + Math.PI / holes), rm * Math.sin(k * TAU / holes + Math.PI / holes)));
  }
  const g = newPart(name || `Zębatka z = ${z}`), body = mesh(extrude(shape, w), M[mat]);
  g.userData.spin.add(body);
  let hubLen = 0;
  if (hub && holes) {   // piasta po obu stronach tarczy
    hubLen = w * 0.35;
    const hg = new THREE.Shape(); hg.absarc(0, 0, hubR, 0, TAU, false); hg.holes.push(boreHole(bore));
    for (const s of [-1, 1]) { const h = mesh(extrude(hg, hubLen + 0.001, 0.0008), M[mat]); h.position.x = s * (w + hubLen - 0.001) / 2; g.userData.spin.add(h); }   // piasta zachodzi 0,5 mm w tarczę — bez wspólnej płaszczyzny
  }
  const area = Math.PI * (o.rp * o.rp - bore * bore), rho = RHO[mat] || STEEL_RHO, mass = rho * area * w * (holes ? 0.78 : 1);
  Object.assign(g.userData, { phys: { ...PHYS.mesh, luz: PHYS.mesh.thin * m }, ports: { bore: port('Otwór z wpustem', DOMAIN.rot, 'wpust'), mesh: port('Zazębienie', DOMAIN.rot, 'zazębienie') }, z, m, alpha: alpha * Math.PI / 180, rp: o.rp, ra: o.ra, rf: o.rf, rb: o.rb, w, mass, J: 0.5 * mass * (o.rp * o.rp * 0.9 + bore * bore), material: mat, hubLen, holes });
  return g;
}
// koło koronowe: otwór o zarysie „wrębów” (głowa korony = stopa zęba koła zewnętrznego)
export function ringGear({ z = 72, m = 0.002, w = 0.03, rim = 0.012, mat = 'brass', name } = {}) {
  const M = materials(), o = involuteOutline(z, m, { add: 1.25, ded: 1, backlash: -0.04 }), shape = new THREE.Shape();
  const R = o.ra + rim; shape.absarc(0, 0, R, 0, TAU, false);
  shape.holes.push(new THREE.Path(o.pts));
  const g = newPart(name || `Koło koronowe z = ${z}`);
  g.userData.spin.add(mesh(extrude(shape, w, 0.0005, 96), M[mat]));
  const mass = (RHO[mat] || STEEL_RHO) * Math.PI * (R * R - o.rp * o.rp) * w;
  Object.assign(g.userData, { phys: { ...PHYS.planetary, luz: PHYS.mesh.thin * m }, ports: { mesh: port('Zazębienie wewnętrzne', DOMAIN.rot, 'zazębienie'), mount: port('Mocowanie (korona stała)', DOMAIN.rot, 'mocowanie') }, z, m, rp: o.rp, R, ra: o.ra, rf: o.rf, w, internal: true, mass, J: 0.5 * mass * (R * R + o.rp * o.rp) });
  return g;
}

/* ---------------- koło łańcuchowe ---------------- */
// zarys z gniazdami rolek: promień gniazda 0,505·d₁ + 0,069 mm, głowa zęba do ok. D/2 + 0,3·d₁ (ISO 606)
// zarys wg ISO 606 (z łuków, na każdą podziałkę): gniazdo rolki — łuk r_i = 0,505·d₁ + 0,069 mm wokół punktu
// podziałowego, kąt osadzenia α = 140° − 90°/z (ISO: min.); bok zęba — łuk r_e = 0,008·d₁·(z² + 180) styczny do
// gniazda (środek na prostej przez koniec gniazda i punkt podziałowy — bok się „otwiera”, rolka schodzi z koła);
// głowa po kole d_a (środek tolerancji ISO). Punkty równo po łukach — cięciwy wchodzą w gniazdo o setne części mm.
export const SPROCKET_SEAT = 6, SPROCKET_FLANK = 6, SPROCKET_TIP = 3, SPROCKET_SAMPLES = 2 * SPROCKET_SEAT + 2 * SPROCKET_FLANK + SPROCKET_TIP + 1;
export function sprocketOutline(z, p, d1) {
  const R = p / (2 * Math.sin(Math.PI / z)), rs = 0.505 * d1 + 0.000069, re = 0.008 * d1 * (z * z + 180);   // wzór ISO liniowy w d₁ — jednostki dowolne
  const da = 2 * R + 0.5 * ((1.25 * p - d1) + (p * (1 - 1.6 / z) - d1)), ra = da / 2, pz = TAU / z, alpha = (140 - 90 / z) * Math.PI / 180;
  // połowa zęba k od strony gniazda k (kąt rośnie): gniazdo od dna, bok do koła głów (albo do osi zęba)
  const ux = 1, uy = 0, C = [R, 0], seat = (b) => [C[0] - rs * Math.cos(b), C[1] + rs * Math.sin(b)];
  const E = seat(alpha / 2), F = [E[0] + (C[0] - E[0]) * re / rs, E[1] + (C[1] - E[1]) * re / rs];
  const rot = (g) => { const c = Math.cos(g), s_ = Math.sin(g), x = E[0] - F[0], y = E[1] - F[1]; return [F[0] + x * c - y * s_, F[1] + x * s_ + y * c]; };
  const sg = Math.hypot(...rot(1e-4).map((v, i) => v - seat(alpha / 2 + 1e-4 * re / rs)[i])) < Math.hypot(...rot(-1e-4).map((v, i) => v - seat(alpha / 2 + 1e-4 * re / rs)[i])) ? 1 : -1;
  const ok = (g) => { const q = rot(sg * g); return Math.hypot(q[0], q[1]) < ra && Math.atan2(q[1], q[0]) < pz / 2; };
  let lo = 0, hi = 1; while (ok(hi)) hi *= 2;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
  const half = [];
  for (let i = 0; i <= SPROCKET_SEAT; i++) half.push(seat(alpha / 2 * i / SPROCKET_SEAT));
  for (let i = 1; i <= SPROCKET_FLANK; i++) half.push(rot(sg * lo * i / SPROCKET_FLANK));
  const aT = Math.atan2(half[half.length - 1][1], half[half.length - 1][0]), rT = Math.hypot(...half[half.length - 1]);
  const tip = []; for (let i = 1; i <= SPROCKET_TIP; i++) { const a = aT + (pz - 2 * aT) * i / (SPROCKET_TIP + 1); tip.push([rT * Math.cos(a), rT * Math.sin(a)]); }
  const mirror = ([x, y]) => { const c = Math.cos(pz), s_ = Math.sin(pz); return [x * c + y * s_, x * s_ - y * c]; };   // odbicie względem osi zęba (kąt pz/2)
  const block = [...half, ...tip, ...half.slice(1).reverse().map(mirror)], pts = [];
  for (let k = 0; k < z; k++) { const c = Math.cos(k * pz), s_ = Math.sin(k * pz); for (const [x, y] of block) pts.push(new THREE.Vector2(x * c - y * s_, x * s_ + y * c)); }
  return { pts, R, rs, ra: rT, re, alpha };
}
export function sprocket({ z = 18, p = 0.0127, d1 = 0.00792, w = 0.0072, bore = 0.0125, mat = 'dark', name } = {}) {
  const M = materials(), { pts, R, rs } = sprocketOutline(z, p, d1);
  bore = Math.min(bore, (R - rs - 0.002) / 1.35);   // otwór z wpustem pod gniazdami rolek
  const shape = new THREE.Shape(pts); shape.holes.push(boreHole(bore));
  const g = newPart(name || `Koło łańcuchowe z = ${z}`);
  g.userData.spin.add(mesh(extrude(shape, w, 0.0005), M[mat]));
  const hubR = Math.max(bore * 1.45, Math.min(R - rs - 0.002, bore * 2.2)), hs = new THREE.Shape(); hs.absarc(0, 0, hubR, 0, TAU, false); hs.holes.push(boreHole(bore));
  const hub = mesh(extrude(hs, 0.023, 0.0008), M[mat]); hub.position.x = -(w + 0.021) / 2; g.userData.spin.add(hub);   // zachodzi 1 mm w tarczę
  const mass = STEEL_RHO * Math.PI * R * R * w + STEEL_RHO * Math.PI * hubR * hubR * 0.022;
  Object.assign(g.userData, { phys: { ...PHYS.chain }, ports: { bore: port('Otwór z wpustem', DOMAIN.rot, 'wpust'), chain: port('Łańcuch', DOMAIN.rot, 'łańcuch') }, z, p, d1, R, rs, w, sprocket: true, mass, J: 0.5 * mass * R * R * 0.8 });
  return g;
}

/* ---------------- koło pasowe (rowki klinowe) ---------------- */
// profile pasów wąskoklinowych (ISO 4184): szerokość u góry, wysokość, szerokość skuteczna; podziałka rowków e
export const VBELT = { SPZ: { top: 0.0097, h: 0.008, lw: 0.0085, e: 0.012, depth: 0.011 }, SPA: { top: 0.0127, h: 0.010, lw: 0.011, e: 0.015, depth: 0.0138 }, SPB: { top: 0.0163, h: 0.013, lw: 0.014, e: 0.019, depth: 0.0175 } };
export function pulley({ d = 0.16, profile = 'SPA', grooves = 1, bore = 0.0125, mat = 'iron', name } = {}) {
  const M = materials(), V = VBELT[profile] || VBELT.SPA, rp = d / 2, ro = rp + 0.0028, rg = rp - V.depth + 0.0028, top = V.lw / 2 + 0.0004, bot = top - (V.depth - 0.0028) * Math.tan(18 * Math.PI / 180);
  const w = (grooves - 1) * V.e + V.lw + 0.016, hw = w / 2, hubR = Math.max(0.026, bore * 2), web = Math.max(0.009, w * 0.3), rimIn = rg - 0.008;
  const prof = [[bore, -hw * 1.5], [hubR, -hw * 1.5], [hubR, -web / 2], [rimIn, -web / 2], [rimIn, -hw], [ro, -hw]];
  for (let k = 0; k < grooves; k++) {
    const c = -((grooves - 1) * V.e) / 2 + k * V.e;
    prof.push([ro, c - top - 0.0015], [rp + 0.001, c - top], [rg, c - bot], [rg, c + bot], [rp + 0.001, c + top], [ro, c + top + 0.0015]);
  }
  prof.push([ro, hw], [rimIn, hw], [rimIn, web / 2], [hubR, web / 2], [hubR, hw * 1.5], [bore, hw * 1.5], [bore, -hw * 1.5]);
  const g = newPart(name || `Koło pasowe Ø ${Math.round(d * 1000)} mm`);
  g.userData.spin.add(mesh(lathe(prof, 64), M[mat]));
  let spokes = 0;
  if (rimIn - hubR > 0.03) {   // ramiona między piastą a wieńcem (koła większe)
    spokes = 5;
    for (let k = 0; k < spokes; k++) {
      const a = k * TAU / spokes, len = rimIn - hubR, s = mesh(box(web * 1.6, len, 0.012 + d * 0.04), M[mat]);
      s.position.set(0, Math.cos(a) * (hubR + len / 2), Math.sin(a) * (hubR + len / 2)); s.rotation.x = a; g.userData.spin.add(s);
    }
  }
  const rho = RHO[mat] || IRON_RHO, mass = rho * (Math.PI * (ro * ro - rimIn * rimIn) * w + Math.PI * (rimIn * rimIn - hubR * hubR) * web * 0.6 + Math.PI * hubR * hubR * w * 1.5);
  Object.assign(g.userData, { phys: { ...PHYS.belt }, ports: { bore: port('Otwór z wpustem', DOMAIN.rot, 'wpust'), belt: port('Pas', DOMAIN.rot, 'pas') }, d, rp, w, profile, grooves, mass, J: 0.5 * mass * (ro * ro + rimIn * rimIn) * 0.85, spokes });
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
  // osadzenie ogniw w gniazdach (k = z / 2π, unit = podziałka): przesunięcie u, przy którym ogniwo 0 leży w gnieździe 0
  // koła 1 (θ = 0), i faza koła 2 (θ₂ = θ₁·z₁/z₂ + phase2), przy której jego gniazda trafiają w ogniwa
  const seatU = (((-a1s * c1.k) % 1) + 1) % 1, p2 = 1 / c2.k, phase2 = ((((a2s + (seatU - segs[2].u0) / c2.k) % p2) + p2) % p2);
  return { L, at, a1: a1s, a2: a2s, U2: segs[2].u0, seat: { u: seatU, phase2 } };
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
export function chainLoop(path, N, { p = 0.0127, d1 = 0.00792, x = 0, type = '08A' } = {}) {
  const M = materials(), g = new THREE.Group(), k = p / 0.0127; g.name = `Łańcuch rolkowy ${type}, ${N} ogniw`;
  const plate = (h, t) => {   // płytka: dwa półkola połączone przewężeniem
    const s = new THREE.Shape(), r = h / 2;
    s.absarc(0, 0, r, Math.PI / 2, Math.PI * 1.5, false); s.lineTo(p / 2, -r * 0.78); s.lineTo(p, -r);
    s.absarc(p, 0, r, -Math.PI / 2, Math.PI / 2, false); s.lineTo(p / 2, r * 0.78); s.lineTo(0, r);
    s.holes.push(circlePath(d1 * 0.28, 16, 0, 0), circlePath(d1 * 0.28, 16, p, 0));
    // kształt w (sx = wzdłuż ogniwa, sy = w poprzek drogi) wyciągnięty na grubość → oś x świata = grubość
    return extrude(s, t, 0.0002, 12);
  };
  const inner = plate(0.0118 * k, 0.0015 * k), outer = plate(0.0104 * k, 0.0015 * k), roller = cyl(d1 / 2, 0.0078 * k, 16), pin = cyl(0.00198 * k, 0.0178 * k, 10);
  const half = Math.floor(N / 2), mk = (geo, mat, n) => { const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; g.add(im); return im; };
  const iIn = mk(inner, M.steel, half * 2), iOut = mk(outer, M.steel, half * 2), iRol = mk(roller, M.dark, N), iPin = mk(pin, M.steel, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), basis = new THREE.Matrix4();
  const OFF_IN = 0.0047 * k, OFF_OUT = 0.0067 * k;   // odsunięcie płytek od środka (połowa szerokości wewnętrznej + płytka)
  function update(u0) {
    const s0 = path.seat ? path.seat.u : 0, P = []; for (let k = 0; k <= N; k++) P.push(path.at(u0 + s0 + k));
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
  const mass = N * 0.0094 * k * k;   // 08A: ok. 0,7 kg/m (masa rośnie z kwadratem podziałki)
  // środki rolek w układzie łańcucha (x, y, z) dla fazy u0 — do brył zderzeń rolek z zębami kół
  const rollers = (u0) => { const out = []; for (let k = 0; k < N; k++) { const a = path.at(u0 + (path.seat ? path.seat.u : 0) + k); out.push([x, a.y, a.z]); } return out; };
  g.userData = { phys: { ...PHYS.chain }, N, p, d1, mass, update, rollers };
  return g;
}

/* ---------------- pas klinowy SPA ---------------- */
// przekrój trapezowy (13 × 10 mm) prowadzony po drodze; nadruk przesuwany teksturą (update(s) — przesunięcie w metrach)
export function beltLoop(path, { x = 0, label = 'SPA 1250 Lw', profile = 'SPA', grooves = 1 } = {}) {
  const V = VBELT[profile] || VBELT.SPA;
  const c = document.createElement('canvas'); c.width = 512; c.height = 32;
  const cx = c.getContext('2d'); cx.fillStyle = '#1b1c1e'; cx.fillRect(0, 0, 512, 32);
  for (let i = 0; i < 512; i += 4) { cx.fillStyle = i % 8 ? '#1f2022' : '#18191b'; cx.fillRect(i, 0, 2, 32); }
  cx.fillStyle = '#d8d4c8'; cx.font = 'bold 15px sans-serif'; cx.fillText(label, 16, 21); cx.fillText(label, 272, 21);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0 });
  const t2 = V.top / 2, b2 = t2 - V.h * Math.tan(20 * Math.PI / 180), sec = [[V.h * 0.45, -t2], [V.h * 0.45, t2], [-V.h * 0.55, b2], [-V.h * 0.55, -b2]];   // (normalna, oś x)
  const n = Math.ceil(path.L / 0.004), period = 0.5, pos = [], uv = [], idx = [];
  for (let gq = 0; gq < grooves; gq++) {
    const xo = x - ((grooves - 1) * V.e) / 2 + gq * V.e, base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const s = path.L * i / n, a = path.at(s), ny = a.tz, nz = -a.ty;   // normalna na zewnątrz pętli
      for (let k = 0; k <= 4; k++) { const [nn, xx] = sec[k % 4]; pos.push(xo + xx, a.y + ny * nn, a.z + nz * nn); uv.push(s / period + gq * 0.37, k / 4); }
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const a = base + i * 5 + k, b = a + 5; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = mesh(geo, mat); m.name = `Pas klinowy ${label}`;
  m.userData = { phys: { ...PHYS.belt }, L: path.L, mass: path.L * grooves * (profile === 'SPZ' ? 0.074 : profile === 'SPB' ? 0.195 : 0.123), update: (s) => { tex.offset.x = -s / period; } };
  return m;
}

/* ---------------- wał, łożysko ---------------- */
export function shaft({ len = 1, r = 0.0125, mat = 'steel', key: keyway = true, name } = {}) {
  const M = materials(), g = newPart(name || `Wał Ø ${Math.round(r * 2000)} mm`);
  const s = mesh(uvScale(new THREE.CylinderGeometry(r, r, len - 0.004, 32, 1, true).rotateZ(-Math.PI / 2), 1), M[mat]); s.position.x = len / 2; g.userData.spin.add(s);   // bez denek — końce zamykają fazki
  // wpusty tylko tam, gdzie siedzą piasty (koła, sprzęgła, tarcze): key — true (cała długość), false albo [[x0, x1], …];
  // setKeys(odcinki) — przebudowa po złożeniu maszyny. Poza piastą wał jest gładki (łożysko obejmuje wał, nie wpust)
  const keys = new THREE.Group(); g.userData.spin.add(keys);
  const setKeys = (segs) => {
    keys.clear();
    for (const [x0, x1] of segs) { const a = Math.max(0.004, x0), b = Math.min(len - 0.004, x1); if (b - a < 0.004) continue; const k = mesh(box(b - a, 0.0018, r * 0.5), M.dark); k.position.set((a + b) / 2, r - 0.0006, 0); keys.add(k); }
  };
  setKeys(keyway === true ? [[len * 0.04, len * 0.96]] : Array.isArray(keyway) ? keyway : []);   // rowek wpustu — widać obrót
  for (const e of [0, len]) { const ch = mesh(cyl(r, 0.002, 32, r * 0.86), M[mat]); ch.position.x = e ? len - 0.001 : 0.001; if (!e) ch.rotation.y = Math.PI; g.userData.spin.add(ch); }   // fazka 0,14 r na końcach
  const mass = (RHO[mat] || STEEL_RHO) * Math.PI * r * r * len;
  Object.assign(g.userData, { setKeys, ports: { a: port('Koniec A', DOMAIN.rot, 'wał'), b: port('Koniec B', DOMAIN.rot, 'wał'), mid: port('Osadzenie (wpust)', DOMAIN.rot, 'wpust') }, phys: { ...PHYS.shaft, G: G_MAT[mat] || G_STEEL, k: (G_MAT[mat] || G_STEEL) * Math.PI * (2 * r) ** 4 / 32 / len }, len, r, mass, J: 0.5 * mass * r * r });
  return g;
}
// oprawa łożyska stojąca (UCP) na podstawie: oś na wysokości h nad podstawą
export function pillowBlock({ h = 0.12, r = 0.0125, name = 'Łożysko w oprawie stojącej UCP' } = {}) {
  const M = materials(), g = new THREE.Group(); g.name = name;
  const k = r / 0.0125, hc = 0.036 * k, base = h - hc, top = new THREE.Group(); top.scale.setScalar(k); top.position.y = base; g.add(top);
  const s = new THREE.Shape(); s.moveTo(-0.085, 0); s.lineTo(0.085, 0); s.lineTo(0.085, 0.016); s.lineTo(0.036, 0.019);
  s.absarc(0, 0.036, 0.038, -0.35, Math.PI + 0.35, false); s.lineTo(-0.085, 0.016); s.closePath();   // kształt w skali 1 (oprawa skalowana k), oś na 0,036
  s.holes.push(circlePath(0.026, 40, 0, 0.036), circlePath(0.0065, 16, -0.064, 0.008), circlePath(0.0065, 16, 0.064, 0.008));
  // kształt (sx → z, sy → y), wyciągnięcie wzdłuż x (macierz o wyznaczniku +1)
  const SM = new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1);
  const hg = new THREE.ExtrudeGeometry(s, { depth: 0.036, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 24 });
  hg.translate(0, 0, -0.018).applyMatrix4(SM); uvScale(hg, 6);
  const hs = mesh(hg, M.paintGrey); top.add(hs);
  // wkładka łożyskowa UC (w skali 1, oprawa skalowana k): pierścień zewnętrzny w gnieździe, uszczelnienia, pierścień
  // wewnętrzny poszerzony z otworem na wał (r = 12,5 mm × k) i dwoma wkrętami — wał przechodzi przez otwór, nie przez bryłę
  for (const [ri, ro, w, mat, x] of [[0.019, 0.026, 0.017, M.steel, 0], [0.0155, 0.019, 0.0012, M.rubber, 0.0079], [0.0155, 0.019, 0.0012, M.rubber, -0.0079], [0.0125, 0.0155, 0.031, M.steel, 0]]) {
    const rg = mesh(ringX(ri, ro, w), mat); rg.position.set(x, 0.036, 0); top.add(rg);
  }
  for (const a of [Math.PI / 2, Math.PI / 2 + 2.1]) { const ss = mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.004, 8), M.dark); ss.position.set(0.0115, 0.036 + 0.0165 * Math.sin(a), 0.0165 * Math.cos(a)); ss.lookAt(new THREE.Vector3(0.0115, 0.036, 0)); ss.rotateX(Math.PI / 2); top.add(ss); }
  const nip = mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.012, 8), M.brass); nip.position.y = 0.036 + 0.044; top.add(nip);
  if (base > 0.12) {   // wysoka podpora: słupek z rury kwadratowej 60 × 60, blacha podstawy i blacha pod oprawą
    const post = mesh(box(0.06, base - 0.024, 0.06), M.paintGrey); post.position.y = base / 2; g.add(post);
    for (const [y, t] of [[0.006, 0.012], [base - 0.006, 0.012]]) { const pl = mesh(box(0.1, t, 0.2), M.iron); pl.position.y = y; g.add(pl); }
    for (const s of [-1, 1]) { const rib = mesh(box(0.006, 0.08, 0.07), M.paintGrey); rib.position.set(0, 0.052, s * 0.065); g.add(rib); }
  } else if (base > 0.002) { const ped = mesh(box(0.05, base, 0.19), M.iron); ped.position.y = base / 2; g.add(ped); }
  for (const z of [-0.064, 0.064]) { const b = mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 6), M.dark); b.position.set(0, 0.02, z); top.add(b); }
  g.userData = { phys: { ...PHYS.bearing }, ports: { bore: port('Gniazdo wału', DOMAIN.rot, 'łożysko') }, h, r, k, mass: 0.8 * k * k * k + (base > 0 ? IRON_RHO * 0.05 * 0.19 * base * 0.4 : 0) };
  return g;
}

/* ---------------- sprzęgła ---------------- */
// sprzęgło kłowe z gwiazdą z poliuretanu: dwie piasty po 3 kły, gwiazda między nimi; część a i b (obie wirują z wałami)
export const SPIDER = { '92A': { color: 0xd8432e, name: '92 Sh A (czerwona)' }, '98A': { color: 0xe8c22e, name: '98 Sh A (żółta)' }, '64D': { color: 0x3f9a4a, name: '64 Sh D (zielona)' } };
export function jawCoupling({ r = 0.032, bore = 0.0125, spider: hard = '92A' } = {}) {
  const M = materials(), mk = (side) => {
    const g = new THREE.Group(), hub = new THREE.Shape(); hub.absarc(0, 0, r, 0, TAU, false); hub.holes.push(boreHole(bore));
    const h = mesh(extrude(hub, 0.03, 0.0012), M.alu); h.position.x = side * 0.027; g.add(h);
    for (let k = 0; k < 3; k++) {
      const a0 = k * TAU / 3 + (side > 0 ? Math.PI / 3 : 0), s = new THREE.Shape();
      s.absarc(0, 0, r * 0.99, a0 - 0.42, a0 + 0.42, false); s.absarc(0, 0, bore * 1.6, a0 + 0.42, a0 - 0.42, true);   // kły odrobinę mniejsze niż piasta — bez wspólnej powierzchni
      const jw = mesh(extrude(s, 0.02, 0.0008), M.alu); jw.position.x = side * 0.004; g.add(jw);
    }
    return g;
  };
  const spider = new THREE.Group(), polyM = M.poly.clone(); polyM.color.setHex((SPIDER[hard] || SPIDER['92A']).color);
  for (let k = 0; k < 6; k++) {
    const a0 = k * TAU / 6 + Math.PI / 6, s = new THREE.Shape();
    s.absarc(0, 0, r * 0.96, a0 - 0.16, a0 + 0.16, false); s.absarc(0, 0, bore * 1.7, a0 + 0.16, a0 - 0.16, true);
    spider.add(mesh(extrude(s, 0.017, 0.0008), polyM));
  }
  const ring = new THREE.Shape(); ring.absarc(0, 0, bore * 2, 0, TAU, false); ring.holes.push(circlePath(bore * 1.15));
  spider.add(mesh(extrude(ring, 0.0164, 0.0006), polyM));   // pierścień cieńszy od ramion — bez wspólnych płaszczyzn
  const mass = ALU_RHO * Math.PI * r * r * 0.08 * 0.9;
  const phys = { ...PHYS.jaw, k: PHYS.spider[hard] || PHYS.spider['92A'], spider: hard };
  spider.userData.phys = phys;
  const ports = { a: port('Piasta A', DOMAIN.rot, 'wał'), b: port('Piasta B', DOMAIN.rot, 'wał') };
  return { a: mk(-1), b: mk(1), spider, phys, ports, mass, J: 0.5 * mass * r * r };
}
// sprzęgło kołnierzowe sztywne: dwie tarcze z piastami i 6 śrub
export function flangeCoupling({ r = 0.055, bore = 0.0125, bolts: nb = 6 } = {}) {
  const M = materials(), mk = (side) => {
    const g = new THREE.Group(), f = new THREE.Shape(); f.absarc(0, 0, r, 0, TAU, false); f.holes.push(boreHole(bore));
    const fl = mesh(extrude(f, 0.014, 0.001), M.iron); fl.position.x = side * 0.0075; g.add(fl);
    const hb = new THREE.Shape(); hb.absarc(0, 0, bore * 2.4, 0, TAU, false); hb.holes.push(boreHole(bore));
    const hub = mesh(extrude(hb, 0.03, 0.001), M.iron); hub.position.x = side * 0.029; g.add(hub);
    return g;
  };
  const bolts = new THREE.Group();
  for (let k = 0; k < nb; k++) {
    const a = k * TAU / nb, y = Math.cos(a) * r * 0.74, z = Math.sin(a) * r * 0.74;
    const b = mesh(cyl(0.004, 0.036, 10), M.steel); b.position.set(0, y, z); bolts.add(b);
    for (const s of [-1, 1]) { const hx = mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 6).rotateZ(Math.PI / 2), M.dark); hx.position.set(s * 0.0172, y, z); bolts.add(hx); }   // łeb wchodzi 0,3 mm w kołnierz
  }
  const mass = IRON_RHO * (Math.PI * r * r * 0.028 + Math.PI * (bore * 2.4) ** 2 * 0.06);
  return { a: mk(-1), b: mk(1), bolts, phys: { ...PHYS.flange }, ports: { a: port('Piasta A', DOMAIN.rot, 'wał'), b: port('Piasta B', DOMAIN.rot, 'wał') }, mass, J: 0.5 * mass * r * r * 0.8 };
}
// widełki przegubu Cardana na końcu wału: piasta wzdłuż +x i dwa ramiona z oczkami; sworznie wzdłuż lokalnego y (oś krzyżaka)
export function yoke({ r = 0.026, reach = 0.07, name = 'Widełki przegubu' } = {}) {   // reach 70 mm: piasta i mostek za oczkami drugich widełek do ok. 45° (kontrola kolizji)
  const M = materials(), g = new THREE.Group(); g.name = name;
  const hub = mesh(cyl(0.019, 0.03, 24), M.gear); hub.position.x = -reach + 0.015; g.add(hub);
  const bridge = mesh(box(0.012, r * 2 + 0.014, 0.03), M.gear); bridge.position.x = -reach + 0.03; g.add(bridge);
  for (const s of [-1, 1]) {
    // ramię węższe od mostka, oczko wyższe od ramienia — bez wspólnych płaszczyzn
    const ax0 = -(reach - 0.018), ax1 = -0.0138;   // ramię od mostka do zewnętrznej ścianki oczka (nie wchodzi w otwór kubka)
    const arm = mesh(box(ax1 - ax0, 0.0087, 0.028), M.gear); arm.position.set((ax0 + ax1) / 2, s * (r + 0.0025), 0); g.add(arm);
    const eye = mesh(ringY(0.0085, 0.0145, 0.0126, 24), M.gear); eye.position.set(0, s * (r + 0.0041), 0); g.add(eye);   // oczko z otworem na kubek łożyska igiełkowego krzyżaka
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
  g.userData.ports = { a: port('Czopy widełek A', DOMAIN.rot, 'przegub'), b: port('Czopy widełek B', DOMAIN.rot, 'przegub') };
  g.userData.phys = { ...PHYS.ujoint };
  return g;
}

/* ---------------- silnik ---------------- */
// trójfazowy silnik indukcyjny 1,1 kW, wielkość 90: oś 90 mm nad łapami; wał wyjściowy na +x
// silniki indukcyjne IEC (4 bieguny): moc → wielkość mechaniczna (wysokość osi), masa, bezwładność wirnika (dane katalogowe)
export const MOTORS = [
  { kW: 0.18, frame: '63', H: 0.063, mass: 4.2, J: 0.00035 }, { kW: 0.37, frame: '71', H: 0.071, mass: 6.2, J: 0.0008 }, { kW: 0.75, frame: '80', H: 0.08, mass: 9.5, J: 0.0018 },
  { kW: 1.1, frame: '90S', H: 0.09, mass: 13.5, J: 0.0028 }, { kW: 1.5, frame: '90L', H: 0.09, mass: 15.5, J: 0.0035 }, { kW: 2.2, frame: '100L', H: 0.1, mass: 22, J: 0.0065 },
  { kW: 4, frame: '112M', H: 0.112, mass: 31, J: 0.0115 }, { kW: 5.5, frame: '132S', H: 0.132, mass: 43, J: 0.0255 }, { kW: 7.5, frame: '132M', H: 0.132, mass: 52, J: 0.033 },
];
export function motor({ kW = 1.1, poles = 4, paint = 'paintBlue', name } = {}) {
  const spec = MOTORS.find((m) => m.kW >= kW) || MOTORS[MOTORS.length - 1];
  const M = materials(), g = newPart(name || `Silnik indukcyjny ${String(spec.kW).replace('.', ',')} kW`), H = 0.09, L = 0.25, body0 = new THREE.Group(), kS = spec.H / 0.09;
  body0.scale.setScalar(kS); body0.position.y = 0; g.add(body0);
  const add0 = (o) => body0.add(o);
  const body = mesh(cyl(0.083, L, 40), M.paintBlue); body.position.set(-L / 2 - 0.04, H, 0); add0(body);
  const fins = new THREE.InstancedMesh(box(L * 0.92, 0.014, 0.0035), M.paintBlue, 30); fins.castShadow = true; fins.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let k = 0; k < 30; k++) { const a = k * TAU / 30; e.set(a, 0, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(-L / 2 - 0.04, H + Math.cos(a) * 0.09, Math.sin(a) * 0.09), q, new THREE.Vector3(1, 1, 1)); fins.setMatrixAt(k, m4); }
  add0(fins);
  const bellF = mesh(lathe([[0.012, 0.0], [0.05, 0.0], [0.086, 0.025], [0.086, 0.04], [0.012, 0.04]], 40), M.paintBlue); bellF.position.set(-0.04, H, 0); add0(bellF);
  const cowl = mesh(uvScale(new THREE.CylinderGeometry(0.09, 0.09, 0.084, 40, 1, true).rotateZ(-Math.PI / 2), 1), M.paintBlue); cowl.position.set(-L - 0.078, H, 0); add0(cowl);   // osłona wentylatora bez denek; tył zamyka kratka
  const grill = mesh(new THREE.CircleGeometry(0.09, 40).rotateY(-Math.PI / 2), M.black); grill.position.set(-L - 0.12, H, 0); add0(grill);
  const cowlRing = mesh(new THREE.RingGeometry(0.08, 0.09, 40).rotateY(Math.PI / 2), M.paintBlue); cowlRing.position.set(-L - 0.036, H, 0); add0(cowlRing);   // przód osłony — szczelina do kadłuba zamknięta
  const tbox = mesh(box(0.1, 0.06, 0.1), M.paintBlue); tbox.position.set(-0.15, H + 0.11, 0); add0(tbox);
  const lid = mesh(box(0.104, 0.008, 0.104), M.paintBlue); lid.position.set(-0.15, H + 0.144, 0); add0(lid);
  const plateN = mesh(box(0.06, 0.0015, 0.035), M.alu); plateN.position.set(-0.22, H + 0.085, 0.045); plateN.rotation.x = 0.9; add0(plateN);
  for (const x of [-0.08, -0.25]) { const foot = mesh(box(0.04, 0.012, 0.18), M.paintBlue); foot.position.set(x, 0.006, 0); add0(foot); const web = mesh(box(0.03, H - 0.05, 0.11), M.paintBlue); web.position.set(x, (H - 0.05) / 2 + 0.01, 0); add0(web); }
  // wał wyjściowy (wiruje)
  const sr = 0.012 * kS, sl = 0.05 * kS;
  const sh = mesh(cyl(sr, sl, 24), M.steel); sh.position.x = sl / 2; g.userData.spin.add(sh);
  const key = mesh(box(sl * 0.84, 0.002 * kS, sr * 0.5), M.dark); key.position.set(sl / 2, sr - 0.0005, 0); g.userData.spin.add(key);
  g.userData.spin.position.y = spec.H;
  if (paint !== 'paintBlue') body0.traverse((o) => { if (o.material === M.paintBlue) o.material = M[paint] || M.paintBlue; });
  const nSync = 6000 / poles, nRated = nSync * (1 - 0.034 - 0.02 / Math.sqrt(spec.kW));
  Object.assign(g.userData, { ports: { out: port('Wał wyjściowy', DOMAIN.rot, 'wał'), power: port('Zaciski U V W', DOMAIN.el, 'zaciski') }, elec: { ...MOTOR_ELEC, kW: spec.kW, In: spec.kW * 1000 / (Math.sqrt(3) * MOTOR_ELEC.U * MOTOR_ELEC.eta * MOTOR_ELEC.cosPhi) }, H: spec.H, mass: spec.mass, J: spec.J * (poles >= 6 ? 1.6 : poles <= 2 ? 0.55 : 1), spec, poles, nSync, nRated, Tn: spec.kW * 1000 / (nRated * TAU / 60), shaftD: sr * 2, shaftL: sl });
  return g;
}

/* ---------------- obudowa z akrylu ---------------- */
// prostopadłościan: szyby z akrylu i profile aluminiowe 20 × 20 na krawędziach; size [x, y, z], środek w (0, 0, 0)
export function housing(size, { frame = 0.02, bores = [], name = 'Obudowa (akryl, profile 20 × 20)' } = {}) {
  // bores: [[y, z, r]] — otwory w ściankach x (względem środka) na łożyska wałów; wokół otworu — oprawka z aluminium
  const M = materials(), g = new THREE.Group(); g.name = name;
  const [sx, sy, sz] = size, panes = new THREE.Group(); panes.name = 'szyby';
  const wallX = () => { const sh = new THREE.Shape(); sh.moveTo(-sz / 2, -sy / 2); sh.lineTo(sz / 2, -sy / 2); sh.lineTo(sz / 2, sy / 2); sh.lineTo(-sz / 2, sy / 2); sh.closePath(); for (const [y, z, r] of bores) sh.holes.push(circlePath(r, 40, -z, y)); return new THREE.ShapeGeometry(sh, 24); };
  for (const sx2 of [-1, 1]) for (const [y, z, r] of bores) { const seat = mesh(ringX(r, r + 0.012, 0.012), M.alu); seat.position.set(sx2 * sx / 2, y, z); g.add(seat); }
  for (const [w, h, p, r] of [[sx, sy, [0, 0, sz / 2], [0, 0, 0]], [sx, sy, [0, 0, -sz / 2], [0, 0, 0]], [sz, sy, [sx / 2, 0, 0], [0, Math.PI / 2, 0]], [sz, sy, [-sx / 2, 0, 0], [0, Math.PI / 2, 0]], [sx, sz, [0, sy / 2, 0], [Math.PI / 2, 0, 0]]]) {
    const m = new THREE.Mesh(bores.length && r[1] ? wallX() : new THREE.PlaneGeometry(w, h), M.acrylic); m.position.set(...p); m.rotation.set(...r); m.renderOrder = 5; panes.add(m);
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
export function tubeHousing({ r = 0.1, len = 0.1, hole = 0.02, name = 'Obudowa (rura z akrylu)' } = {}) {   // hole: otwór w deklach (gniazdo łożyska)
  const M = materials(), g = new THREE.Group(); g.name = name;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 48, 1, true).rotateZ(-Math.PI / 2), M.acrylic); tube.renderOrder = 5;
  const panes = new THREE.Group(); panes.add(tube);
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.RingGeometry(hole, r, 48).rotateY(Math.PI / 2), M.acrylic); cap.position.x = s * len / 2; cap.renderOrder = 5; panes.add(cap); const rg = mesh(new THREE.TorusGeometry(r, 0.005, 8, 48).rotateY(Math.PI / 2), M.alu); rg.position.x = s * len / 2; g.add(rg); }
  g.add(panes); g.userData.panes = panes;
  return g;
}


/* ---------------- przekładnia planetarna ---------------- */
// słoneczne zs, n satelitów zp, korona zr = zs + 2·zp (stała), jarzmo; update(θs) ustawia jarzmo i satelity (Willis)
export function planetary({ zs = 24, zp = 24, n = 3, m = 0.002, w = 0.02, mat = 'gear', matP = 'brass', matR = 'brass' } = {}) {
  const M = materials(), zr = zs + 2 * zp, g = newPart(`Przekładnia planetarna ${zs}/${zp}/${zr}`), RC = m * (zs + zp) / 2;
  const sun = gear({ z: zs, m, w: w * 1.1, mat, hub: false, bore: Math.min(0.0125, m * zs * 0.25), name: 'Koło słoneczne' }); g.userData.spin.add(sun);
  const ring = ringGear({ z: zr, m, w, mat: matR }); g.add(ring);
  const carrier = new THREE.Group(), planets = [];
  for (let k = 0; k < n; k++) {
    const pl = gear({ z: zp, m, w: w * 0.9, mat: matP, hub: false, bore: Math.min(0.004, m * zp * 0.18), name: 'Satelita' });
    pl.position.set(0, RC * Math.cos(k * TAU / n), RC * Math.sin(k * TAU / n)); carrier.add(pl); planets.push(pl);
    const pin = mesh(cyl(Math.min(0.004, m * zp * 0.18) * 0.97, w * 2.6, 12), M.steel); pin.position.copy(pl.position); pin.position.x = w * 0.7; carrier.add(pin);   // luz w otworze satelity — bez wspólnej powierzchni
  }
  for (const x of [w * 1.4, w * 2.1]) { const d = mesh(new THREE.CylinderGeometry(RC + m * zp * 0.35, RC + m * zp * 0.35, w * 0.3, 48).rotateZ(Math.PI / 2), M.alu); d.position.x = x; carrier.add(d); }
  const out = mesh(cyl(0.0125, 0.08, 24), M.steel); out.position.x = w * 2.1 + 0.04; carrier.add(out);   // wał jarzma zaczyna się w środku tarczy
  g.add(carrier);
  const assembly = (zs + zr) / n, clearance = (zs + zp) * Math.sin(Math.PI / n) - (zp + 2);
  const ph = planetPhase(zs, zp, zr, n);
  ring.userData.spin.rotation.x = ph.ring;   // wrąb korony naprzeciw zęba satelity najbliższego punktowi styku
  function update(ts) {
    const tc = ts * zs / (zs + zr), rel = ts - tc;
    g.userData.spin.rotation.x = ts; carrier.rotation.x = tc;
    planets.forEach((pl, k) => { pl.userData.spin.rotation.x = ph.planet(k, rel); });
    return { tc };
  }
  const mass = sun.userData.mass + ring.userData.mass + planets.reduce((a, p) => a + p.userData.mass, 0) + 0.3;
  Object.assign(g.userData, { phys: { ...PHYS.planetary }, ports: { in: port('Wał słonecznego (wejście)', DOMAIN.rot, 'wał'), out: port('Jarzmo (wyjście)', DOMAIN.rot, 'wał') }, zs, zp, zr, n, m, ratio: 1 + zr / zs, assemblyOk: Number.isInteger(assembly), assembly, clearanceOk: clearance > 0, RC, R: ring.userData.R, mass, update, carrier, ring, sun });
  return g;
}

/* ---------------- hamulec tarczowy ---------------- */
export function discBrake({ d = 0.2, t = 0.008, vents = 12 } = {}) {
  const M = materials(), g = newPart(`Hamulec tarczowy Ø ${Math.round(d * 1000)}`), R = d / 2;
  const ds = new THREE.Shape(); ds.absarc(0, 0, R, 0, TAU, false); ds.holes.push(boreHole(0.0125));
  for (let k = 0; k < vents; k++) ds.holes.push(circlePath(R * 0.06, 16, R * 0.72 * Math.cos(k * TAU / vents), R * 0.72 * Math.sin(k * TAU / vents)));
  const hub = new THREE.Shape(); hub.absarc(0, 0, R * 0.32, 0, TAU, false); hub.holes.push(boreHole(0.0125));
  g.userData.spin.add(mesh(extrude(ds, t, 0.0005, 64), M.steel));
  const h = mesh(extrude(hub, 0.03, 0.001), M.dark); h.position.x = -0.019; g.userData.spin.add(h);
  // zacisk pływający okracza tarczę: dwie obudowy klocków po bokach (luz 1 mm do tarczy) i mostek nad krawędzią (2 mm)
  const gap = 0.001, ht = 0.018, cx = t / 2 + gap + ht / 2;
  for (const sx of [-1, 1]) { const c = mesh(box(ht, 0.05, 0.07), M.paintRed); c.position.set(sx * cx, R - 0.015, 0); g.add(c); }
  const bridge = mesh(box(2 * (cx + ht / 2) - 0.002, 0.012, 0.068), M.paintRed); bridge.position.set(0, R + 0.002 + 0.006, 0); g.add(bridge);
  const mass = STEEL_RHO * Math.PI * R * R * t * 0.9 + STEEL_RHO * Math.PI * (R * 0.32) ** 2 * 0.03;
  Object.assign(g.userData, { ports: { shaft: port('Piasta (wpust)', DOMAIN.rot, 'wpust') }, d, t, vents, mass, J: 0.5 * mass * R * R * 0.85 });
  return g;
}

export const MechKit = { materials, gear, ringGear, sprocket, pulley, loopPath, chainDistance, chainLoop, beltLoop, shaft, pillowBlock, jawCoupling, flangeCoupling, yoke, cross, motor, housing, tubeHousing, involuteOutline, toothHulls, convexParts, sprocketOutline, sprocketHulls, ringHulls, planetary, discBrake, planetPhase, PHYS, MOTOR_ELEC, G_STEEL, G_MAT, DOMAIN, rack, rackHulls, slider, conRod, leadScrew, screwNut, rollingBearing, BEARINGS };
