// Katalog przedmiotów laboratorium mechaniki (kategoria 1 — transmisja ruchu). Każdy przedmiot: ustawienia (params),
// budowa z MechKit (build(p) → { group, update(θ), info: [[nazwa, wartość]], ports, warn }) — θ: kąt wejścia podglądu.
// Ustawienie: { key, label, type: 'range' | 'select' | 'check', min, max, step, unit, options: [[wartość, opis]], def }
import * as THREE from '../../../vendor/three/three.module.js';
import * as MK from '../../models/mech/mechkit.js';
import { createDrive } from '../../behaviors/mech/drive.js';
import * as CK from '../../models/mech/controls.js';

const TAU = Math.PI * 2, X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const mm = (v, d = 1) => `${(v * 1000).toLocaleString('pl', { maximumFractionDigits: d })} mm`;
const kg = (v) => `${v.toLocaleString('pl', { maximumFractionDigits: v < 1 ? 3 : 2 })} kg`;
const kgcm2 = (J) => `${(J * 1e4).toLocaleString('pl', { maximumFractionDigits: 3 })} kg·cm²`;
const P = (id, name, kind = 'obrót') => ({ id, name, kind });
const MATS = [['gear', 'stal 42CrMo4 ulepszona'], ['steel', 'stal C45 szlifowana'], ['brass', 'mosiądz CuZn39Pb3'], ['iron', 'żeliwo EN-GJL-250'], ['dark', 'stal czerniona'], ['alu', 'aluminium EN AW-6082']];
const matName = (k) => (MATS.find((m) => m[0] === k) || [0, k])[1];
const CHAINS = { '06B': { p: 0.009525, d1: 0.00635 }, '08A': { p: 0.0127, d1: 0.00792 }, '10A': { p: 0.015875, d1: 0.01016 }, '12A': { p: 0.01905, d1: 0.01191 } };
const shaftBit = (len, r = 0.0125) => { const s = MK.shaft({ len, r }); s.position.x = -len / 2; return s; };   // krótki wał na podglądzie
const spinAll = (...gs) => (t) => { for (const g of gs) g.userData.spin.rotation.x = t; };

export const ITEMS = [
  {
    id: 'gear', name: 'Zębatka walcowa', group: 'Zębatki i przekładnie',
    params: [
      { key: 'z', label: 'Liczba zębów', type: 'range', min: 9, max: 120, step: 1, def: 32 },
      { key: 'm', label: 'Moduł', type: 'select', options: [[0.001, '1 mm'], [0.0015, '1,5 mm'], [0.002, '2 mm'], [0.0025, '2,5 mm'], [0.003, '3 mm'], [0.004, '4 mm'], [0.005, '5 mm'], [0.006, '6 mm'], [0.008, '8 mm']], def: 0.003 },
      { key: 'alpha', label: 'Kąt przyporu', type: 'select', options: [[14.5, '14,5°'], [20, '20° (ISO)'], [25, '25°']], def: 20 },
      { key: 'w', label: 'Szerokość wieńca', type: 'range', min: 0.008, max: 0.08, step: 0.002, unit: 'mm', def: 0.03 },
      { key: 'bore', label: 'Otwór', type: 'select', options: [[0.005, 'Ø 10'], [0.0075, 'Ø 15'], [0.0125, 'Ø 25'], [0.0175, 'Ø 35'], [0.025, 'Ø 50']], def: 0.0125 },
      { key: 'mat', label: 'Materiał', type: 'select', options: MATS, def: 'gear' },
      { key: 'holes', label: 'Otwory odciążające', type: 'check', def: true },
      { key: 'hub', label: 'Piasta', type: 'check', def: true },
    ],
    build(p) {
      const warn = [];
      if (p.bore * 2 > p.m * p.z - 2.5 * p.m - 0.006) { warn.push('Otwór za duży do tej zębatki — zmniejszony.'); p = { ...p, bore: Math.max(0.003, (p.m * p.z - 2.5 * p.m - 0.006) / 2.4) }; }
      const zmin = Math.ceil(2 / Math.sin(p.alpha * Math.PI / 180) ** 2);
      if (p.z < zmin) warn.push(`Mniej niż ${zmin} zębów przy α = ${String(p.alpha).replace('.', ',')}° — podcięcie stopy zęba przy obróbce obwiedniowej.`);
      const g = MK.gear(p), u = g.userData;
      return { group: g, update: spinAll(g), warn,
        info: [['Średnica podziałowa', mm(u.rp * 2)], ['Średnica wierzchołków', mm(u.ra * 2)], ['Średnica stóp', mm(u.rf * 2)], ['Średnica zasadnicza', mm(u.rb * 2)], ['Podziałka', mm(Math.PI * p.m, 2)], ['Grubość zęba (na podziałowym)', mm(Math.PI * p.m / 2, 2)], ['Materiał', matName(p.mat)], ['Masa', kg(u.mass)], ['Bezwładność', kgcm2(u.J)]],
        ports: [P('bore', 'Otwór z wpustem (wał)'), P('mesh', 'Zazębienie — z zębatką o tym samym module')] };
    },
  },
  {
    id: 'pair', name: 'Para zębatek', group: 'Zębatki i przekładnie',
    params: [
      { key: 'z1', label: 'Zęby — zębnik', type: 'range', min: 10, max: 60, step: 1, def: 18 },
      { key: 'z2', label: 'Zęby — koło', type: 'range', min: 10, max: 120, step: 1, def: 45 },
      { key: 'm', label: 'Moduł', type: 'select', options: [[0.0015, '1,5 mm'], [0.002, '2 mm'], [0.003, '3 mm'], [0.004, '4 mm'], [0.005, '5 mm']], def: 0.003 },
      { key: 'w', label: 'Szerokość', type: 'range', min: 0.01, max: 0.06, step: 0.002, unit: 'mm', def: 0.026 },
      { key: 'mat2', label: 'Materiał koła', type: 'select', options: MATS, def: 'brass' },
    ],
    build(p) {
      const g = new THREE.Group(), a = MK.gear({ z: p.z1, m: p.m, w: p.w, mat: 'gear', bore: Math.min(0.0125, p.m * p.z1 * 0.2) }), b = MK.gear({ z: p.z2, m: p.m, w: p.w, mat: p.mat2, bore: Math.min(0.0125, p.m * p.z2 * 0.2) });
      const a0 = p.m * (p.z1 + p.z2) / 2; a.position.set(0, 0, -a0 / 2); b.position.set(0, 0, a0 / 2); g.add(a, b);
      // kąty z napędu (to samo zazębienie co w maszynie)
      const d = createDrive(), ea = d.add({ id: 'a', J: 0, frame: { o: a.position.clone(), axis: X, ref: Y } }), eb = d.add({ id: 'b', J: 0, frame: { o: b.position.clone(), axis: X, ref: Y } });
      d.connect('a', 'mesh', 'b', 'mesh', 'mesh', { za: p.z1, zb: p.z2 }); d.solve('a');
      return { group: g, view: { yaw: 1.2, pitch: 0.25 }, update: (t) => { d.pose(t); a.userData.spin.rotation.x = ea.theta; b.userData.spin.rotation.x = eb.theta; },
        info: [['Przełożenie', `i = ${p.z2}/${p.z1} = ${(p.z2 / p.z1).toLocaleString('pl', { maximumFractionDigits: 3 })}`], ['Odległość osi', mm(a0)], ['Kierunek', 'przeciwny'], ['Wskaźnik przyporu (ok.)', contactRatio(p.z1, p.z2).toLocaleString('pl', { maximumFractionDigits: 2 })], ['Masa razem', kg(a.userData.mass + b.userData.mass)]],
        ports: [P('in', 'Wał zębnika (wejście)'), P('out', 'Wał koła (wyjście)')] };
    },
  },
  {
    id: 'planet', name: 'Przekładnia planetarna', group: 'Zębatki i przekładnie',
    params: [
      { key: 'zs', label: 'Zęby — słoneczne', type: 'range', min: 12, max: 60, step: 1, def: 24 },
      { key: 'zp', label: 'Zęby — satelity', type: 'range', min: 12, max: 60, step: 1, def: 24 },
      { key: 'n', label: 'Liczba satelitów', type: 'select', options: [[2, '2'], [3, '3'], [4, '4'], [5, '5']], def: 3 },
      { key: 'm', label: 'Moduł', type: 'select', options: [[0.001, '1 mm'], [0.0015, '1,5 mm'], [0.002, '2 mm'], [0.003, '3 mm']], def: 0.002 },
      { key: 'w', label: 'Szerokość', type: 'range', min: 0.01, max: 0.04, step: 0.002, unit: 'mm', def: 0.02 },
    ],
    build(p) {
      const g = MK.planetary(p), u = g.userData, warn = [];
      if (!u.assemblyOk) warn.push(`(zs + zr) / n = ${u.assembly.toLocaleString('pl', { maximumFractionDigits: 2 })} — niecałkowite: satelitów nie da się rozstawić równo.`);
      if (!u.clearanceOk) warn.push('Satelity zachodzą na siebie — za dużo satelitów albo za duże.');
      return { group: g, warn, view: { yaw: -0.9, pitch: 0.25 }, update: (t) => u.update(t),
        info: [['Koło koronowe', `${u.zr} zębów (zr = zs + 2·zp)`], ['Przełożenie (korona stała)', `i = 1 + zr/zs = ${u.ratio.toLocaleString('pl', { maximumFractionDigits: 3 })}`], ['Kierunek wyjścia', 'ten sam co wejście'], ['Promień jarzma', mm(u.RC)], ['Średnica zewnętrzna', mm(u.R * 2)], ['Masa', kg(u.mass)]],
        ports: [P('sun', 'Koło słoneczne (wejście)'), P('ring', 'Koło koronowe', 'podparcie'), P('carrier', 'Jarzmo (wyjście)')] };
    },
  },
  {
    id: 'ring', name: 'Koło koronowe', group: 'Zębatki i przekładnie',
    params: [
      { key: 'z', label: 'Liczba zębów', type: 'range', min: 36, max: 160, step: 1, def: 72 },
      { key: 'm', label: 'Moduł', type: 'select', options: [[0.001, '1 mm'], [0.0015, '1,5 mm'], [0.002, '2 mm'], [0.003, '3 mm']], def: 0.002 },
      { key: 'w', label: 'Szerokość', type: 'range', min: 0.01, max: 0.05, step: 0.002, unit: 'mm', def: 0.02 },
      { key: 'rim', label: 'Grubość wieńca', type: 'range', min: 0.006, max: 0.03, step: 0.001, unit: 'mm', def: 0.012 },
      { key: 'mat', label: 'Materiał', type: 'select', options: MATS, def: 'brass' },
    ],
    build(p) {
      const g = MK.ringGear(p), u = g.userData;
      return { group: g, update: spinAll(g), info: [['Średnica podziałowa', mm(u.rp * 2)], ['Średnica zewnętrzna', mm(u.R * 2)], ['Materiał', matName(p.mat)], ['Masa', kg(u.mass)], ['Bezwładność', kgcm2(u.J)]],
        ports: [P('mesh', 'Uzębienie wewnętrzne'), P('body', 'Wieniec (mocowanie / obrót)')] };
    },
  },
  {
    id: 'sprocket', name: 'Koło łańcuchowe', group: 'Łańcuchy',
    params: [
      { key: 'z', label: 'Liczba zębów', type: 'range', min: 9, max: 60, step: 1, def: 18 },
      { key: 'type', label: 'Łańcuch', type: 'select', options: [['06B', '06B (9,525 mm)'], ['08A', '08A / ANSI 40 (12,7 mm)'], ['10A', '10A / ANSI 50 (15,875 mm)'], ['12A', '12A / ANSI 60 (19,05 mm)']], def: '08A' },
      { key: 'mat', label: 'Materiał', type: 'select', options: MATS, def: 'dark' },
    ],
    build(p) {
      const C = CHAINS[p.type], g = MK.sprocket({ z: p.z, p: C.p, d1: C.d1, w: C.p * 0.57, mat: p.mat }), u = g.userData;
      return { group: g, update: spinAll(g), info: [['Podziałka', mm(C.p, 3)], ['Średnica podziałowa', mm(u.R * 2)], ['Rolka', `Ø ${mm(C.d1, 2)}`], ['Materiał', matName(p.mat)], ['Masa', kg(u.mass)]],
        warn: p.z < 13 ? ['Mniej niż 13 zębów — duża nierównomierność biegu łańcucha (efekt wielokąta).'] : [],
        ports: [P('bore', 'Otwór (wał)'), P('chain', 'Łańcuch')] };
    },
  },
  {
    id: 'chain', name: 'Napęd łańcuchowy', group: 'Łańcuchy',
    params: [
      { key: 'z1', label: 'Zęby — koło czynne', type: 'range', min: 9, max: 40, step: 1, def: 15 },
      { key: 'z2', label: 'Zęby — koło bierne', type: 'range', min: 9, max: 80, step: 1, def: 32 },
      { key: 'type', label: 'Łańcuch', type: 'select', options: [['06B', '06B'], ['08A', '08A'], ['10A', '10A'], ['12A', '12A']], def: '08A' },
      { key: 'a', label: 'Odległość osi (ok.)', type: 'range', min: 0.15, max: 0.8, step: 0.01, unit: 'mm', def: 0.35 },
    ],
    build(p) {
      const C = CHAINS[p.type], D = MK.chainDistance(p.z1, p.z2, C.p, Math.max(p.a, (C.p / (2 * Math.sin(Math.PI / p.z1)) + C.p / (2 * Math.sin(Math.PI / p.z2))) * 1.3));
      const g = new THREE.Group(), s1 = MK.sprocket({ z: p.z1, p: C.p, d1: C.d1, w: C.p * 0.57 }), s2 = MK.sprocket({ z: p.z2, p: C.p, d1: C.d1, w: C.p * 0.57 });
      s1.position.set(0, -D.D / 2, 0); s2.position.set(0, D.D / 2, 0); g.add(s1, s2);
      const path = MK.loopPath({ y: -D.D / 2, z: 0, r: D.R1, k: p.z1 / TAU }, { y: D.D / 2, z: 0, r: D.R2, k: p.z2 / TAU }, C.p);
      s1.userData.spin.children.forEach((c) => { c.rotation.x = path.a1; }); s2.userData.spin.children.forEach((c) => { c.rotation.x = path.a2 - path.U2 * TAU / p.z2; });
      const ch = MK.chainLoop(path, D.N, { p: C.p, d1: C.d1, type: p.type }); g.add(ch);
      return { group: g, view: { yaw: 1.25, pitch: 0.2 }, update: (t) => { s1.userData.spin.rotation.x = t; s2.userData.spin.rotation.x = t * p.z1 / p.z2 + path.seat.phase2; ch.userData.update(t * p.z1 / TAU); },
        info: [['Przełożenie', `i = ${p.z2}/${p.z1} = ${(p.z2 / p.z1).toLocaleString('pl', { maximumFractionDigits: 3 })}`], ['Kierunek', 'ten sam'], ['Liczba ogniw', `${D.N} (parzysta — bez ogniwa przejściowego)`], ['Odległość osi (dobrana)', mm(D.D)], ['Długość łańcucha', mm(D.N * C.p, 0)], ['Masa łańcucha', kg(ch.userData.mass)]],
        ports: [P('in', 'Wał koła czynnego (wejście)'), P('out', 'Wał koła biernego (wyjście)')] };
    },
  },
  {
    id: 'pulley', name: 'Koło pasowe', group: 'Pasy',
    params: [
      { key: 'd', label: 'Średnica skuteczna', type: 'range', min: 0.05, max: 0.4, step: 0.005, unit: 'mm', def: 0.16 },
      { key: 'profile', label: 'Profil rowka', type: 'select', options: [['SPZ', 'SPZ'], ['SPA', 'SPA'], ['SPB', 'SPB']], def: 'SPA' },
      { key: 'grooves', label: 'Liczba rowków', type: 'range', min: 1, max: 5, step: 1, def: 1 },
      { key: 'mat', label: 'Materiał', type: 'select', options: MATS, def: 'iron' },
    ],
    build(p) {
      const g = MK.pulley(p), u = g.userData, dmin = { SPZ: 0.063, SPA: 0.09, SPB: 0.14 }[p.profile];
      return { group: g, update: spinAll(g), warn: p.d < dmin ? [`Średnica poniżej najmniejszej zalecanej dla ${p.profile} (${mm(dmin, 0)}) — pas szybko się zużyje.`] : [],
        info: [['Szerokość wieńca', mm(u.w)], ['Ramiona', u.spokes ? `${u.spokes}` : 'tarcza pełna'], ['Materiał', matName(p.mat)], ['Masa', kg(u.mass)], ['Bezwładność', kgcm2(u.J)]],
        ports: [P('bore', 'Otwór (wał)'), P('belt', `Pas ${p.profile}${p.grooves > 1 ? ` × ${p.grooves}` : ''}`)] };
    },
  },
  {
    id: 'belt', name: 'Napęd pasowy', group: 'Pasy',
    params: [
      { key: 'd1', label: 'Koło czynne', type: 'range', min: 0.063, max: 0.3, step: 0.005, unit: 'mm', def: 0.1 },
      { key: 'd2', label: 'Koło bierne', type: 'range', min: 0.063, max: 0.4, step: 0.005, unit: 'mm', def: 0.2 },
      { key: 'profile', label: 'Profil', type: 'select', options: [['SPZ', 'SPZ'], ['SPA', 'SPA'], ['SPB', 'SPB']], def: 'SPA' },
      { key: 'grooves', label: 'Liczba pasów', type: 'range', min: 1, max: 4, step: 1, def: 2 },
      { key: 'a', label: 'Odległość osi', type: 'range', min: 0.2, max: 0.8, step: 0.01, unit: 'mm', def: 0.4 },
    ],
    build(p) {
      const g = new THREE.Group(), a = Math.max(p.a, (p.d1 + p.d2) * 0.6), q1 = MK.pulley({ d: p.d1, profile: p.profile, grooves: p.grooves }), q2 = MK.pulley({ d: p.d2, profile: p.profile, grooves: p.grooves });
      q1.position.set(0, -a / 2, 0); q2.position.set(0, a / 2, 0); g.add(q1, q2);
      const path = MK.loopPath({ y: -a / 2, z: 0, r: p.d1 / 2, k: p.d1 / 2 }, { y: a / 2, z: 0, r: p.d2 / 2, k: p.d2 / 2 }, 1);
      const L = Math.round(path.L * 1000), belt = MK.beltLoop(path, { profile: p.profile, grooves: p.grooves, label: `${p.profile} ${L} Lw` }); g.add(belt);
      const wrap = Math.PI - 2 * Math.asin((p.d2 - p.d1) / (2 * a));
      return { group: g, view: { yaw: 1.25, pitch: 0.2 }, update: (t) => { q1.userData.spin.rotation.x = t; q2.userData.spin.rotation.x = t * p.d1 / p.d2; belt.userData.update(t * p.d1 / 2); },
        warn: wrap < 120 * Math.PI / 180 ? ['Kąt opasania koła czynnego poniżej 120° — pas może się ślizgać.'] : [],
        info: [['Przełożenie', `i = ${Math.round(p.d2 * 1000)}/${Math.round(p.d1 * 1000)} = ${(p.d2 / p.d1).toLocaleString('pl', { maximumFractionDigits: 3 })}`], ['Kierunek', 'ten sam'], ['Długość pasa (skuteczna)', `${L} mm`], ['Kąt opasania (koło czynne)', `${Math.round(wrap * 180 / Math.PI)}°`], ['Masa pasów', kg(belt.userData.mass)]],
        ports: [P('in', 'Wał koła czynnego (wejście)'), P('out', 'Wał koła biernego (wyjście)')] };
    },
  },
  {
    id: 'shaft', name: 'Wał', group: 'Wały i łożyska',
    params: [
      { key: 'len', label: 'Długość', type: 'range', min: 0.1, max: 1.5, step: 0.01, unit: 'mm', def: 0.6 },
      { key: 'd', label: 'Średnica', type: 'select', options: [[0.012, 'Ø 12'], [0.02, 'Ø 20'], [0.025, 'Ø 25'], [0.03, 'Ø 30'], [0.04, 'Ø 40'], [0.05, 'Ø 50']], def: 0.025 },
      { key: 'mat', label: 'Materiał', type: 'select', options: MATS, def: 'steel' },
      { key: 'key', label: 'Rowek wpustu', type: 'check', def: true },
    ],
    build(p) {
      const g = MK.shaft({ len: p.len, r: p.d / 2, mat: p.mat, key: p.key }); g.position.x = -p.len / 2; const h = new THREE.Group(); h.add(g); const u = g.userData;
      const kt = (p.mat === 'alu' ? 26e9 : p.mat === 'brass' ? 37e9 : p.mat === 'iron' ? 45e9 : 80e9) * Math.PI * p.d ** 4 / 32 / p.len;   // G·J_p / L
      return { group: h, update: spinAll(g), info: [['Masa', kg(u.mass)], ['Bezwładność', kgcm2(u.J)], ['Materiał', matName(p.mat)], ['Sztywność skrętna', `${Math.round(kt).toLocaleString('pl')} N·m/rad (${(kt * Math.PI / 180).toLocaleString('pl', { maximumFractionDigits: 1 })} N·m na 1°)`], ['Smukłość l/d', Math.round(p.len / p.d).toString()]],
        ports: [P('a', 'Koniec A'), P('b', 'Koniec B'), P('mid', 'Osadzenie (koła, sprzęgła, łożyska)')] };
    },
  },
  {
    id: 'bearing', name: 'Łożysko w oprawie', group: 'Wały i łożyska',
    params: [
      { key: 'd', label: 'Otwór (wał)', type: 'select', options: [[0.02, 'Ø 20 (UCP204)'], [0.025, 'Ø 25 (UCP205)'], [0.03, 'Ø 30 (UCP206)'], [0.04, 'Ø 40 (UCP208)']], def: 0.025 },
      { key: 'h', label: 'Wysokość osi', type: 'range', min: 0.03, max: 0.6, step: 0.005, unit: 'mm', def: 0.12 },
    ],
    build(p) {
      const g = MK.pillowBlock({ h: Math.max(p.h, p.d / 0.025 * 0.034), r: p.d / 2, name: 'Łożysko UCP' }), s = shaftBit(0.3, p.d / 2); s.position.y = g.userData.h; g.add(s);
      return { group: g, rest: true, update: (t) => { s.userData.spin.rotation.x = t; }, info: [['Oprawa', 'żeliwo, stojąca, z otworami pod śruby'], ['Łożysko', 'kulkowe zwykłe, wkładka z wkrętami'], ['Wysokość osi', mm(g.userData.h)], ['Masa (ok.)', kg(g.userData.mass)]],
        ports: [P('shaft', 'Wał (podparcie obrotowe)', 'podparcie'), P('base', 'Podstawa (mocowanie)', 'mocowanie')] };
    },
  },
  {
    id: 'jaw', name: 'Sprzęgło kłowe', group: 'Sprzęgła',
    params: [
      { key: 'r', label: 'Średnica zewnętrzna', type: 'range', min: 0.03, max: 0.12, step: 0.002, unit: 'mm×2', def: 0.064 },
      { key: 'spider', label: 'Gwiazda', type: 'select', options: Object.entries(MK.SPIDER).map(([k, v]) => [k, v.name]), def: '92A' },
    ],
    build(p) {
      const r = p.r / 2, c = MK.jawCoupling({ r, bore: Math.min(0.0125, r * 0.4), spider: p.spider }), g = new THREE.Group(), spin = new THREE.Group(); g.add(spin); spin.add(c.a, c.spider, c.b);
      const sa = shaftBit(0.12, Math.min(0.0125, r * 0.4)), sb = shaftBit(0.12, Math.min(0.0125, r * 0.4)); sa.position.x = -0.12 - 0.04; sb.position.x = 0.04; g.add(sa, sb);
      return { group: g, update: (t) => { spin.rotation.x = t; sa.userData.spin.rotation.x = t; sb.userData.spin.rotation.x = t; },
        info: [['Rodzaj', 'podatne, kłowe (3 kły na piaście)'], ['Gwiazda', MK.SPIDER[p.spider].name], ['Sztywność skrętna (wielkość 19)', `${{ '92A': 1300, '98A': 2300, '64D': 4500 }[p.spider].toLocaleString('pl')} N·m/rad`], ['Tłumienie', p.spider === '64D' ? 'małe (twarda)' : 'duże (miękka)'], ['Kompensuje', 'niewspółosiowość, tłumi drgania'], ['Masa', kg(c.mass)]],
        ports: [P('a', 'Piasta A'), P('b', 'Piasta B')] };
    },
  },
  {
    id: 'flange', name: 'Sprzęgło kołnierzowe', group: 'Sprzęgła',
    params: [
      { key: 'd', label: 'Średnica kołnierza', type: 'range', min: 0.07, max: 0.2, step: 0.005, unit: 'mm', def: 0.11 },
      { key: 'bolts', label: 'Liczba śrub', type: 'select', options: [[3, '3'], [4, '4'], [6, '6'], [8, '8']], def: 6 },
    ],
    build(p) {
      const c = MK.flangeCoupling({ r: p.d / 2, bolts: p.bolts }), g = new THREE.Group(), spin = new THREE.Group(); g.add(spin); spin.add(c.a, c.b, c.bolts);
      const sa = shaftBit(0.12), sb = shaftBit(0.12); sa.position.x = -0.12 - 0.045; sb.position.x = 0.045; g.add(sa, sb);
      return { group: g, update: (t) => { spin.rotation.x = t; sa.userData.spin.rotation.x = t; sb.userData.spin.rotation.x = t; },
        info: [['Rodzaj', 'sztywne — wymaga współosiowości'], ['Śruby', `${p.bolts} × M8, klasa 8.8`], ['Masa', kg(c.mass)]],
        ports: [P('a', 'Kołnierz A'), P('b', 'Kołnierz B')] };
    },
  },
  {
    id: 'cardan', name: 'Przegub Cardana', group: 'Sprzęgła',
    params: [
      { key: 'beta', label: 'Kąt łamania', type: 'range', min: 0, max: 45, step: 1, unit: '°', def: 30 },
      { key: 'double', label: 'Podwójny (układ Z)', type: 'check', def: false },
    ],
    build(p) {
      const b = p.beta * Math.PI / 180, g = new THREE.Group(), dir = new THREE.Vector3(Math.cos(b), 0, Math.sin(b)), q = new THREE.Quaternion().setFromUnitVectors(X, dir), L = 0.35;
      const zq = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      // wał czynny wzdłuż x, kończy się przegubem w (0, 0, 0); widełki — sworznie wzdłuż y
      const sA = MK.shaft({ len: 0.3 }); sA.position.x = -0.35; { const y = MK.yoke(); y.position.x = 0.35; sA.userData.spin.add(y); } g.add(sA);
      // wał za przegubem (pochylony o β): pojedynczy — wał bierny, podwójny — wał pośredni z drugimi widełkami
      const sB = MK.shaft({ len: (p.double ? L : 0.3) - 0.1, r: p.double ? 0.015 : 0.0125 }); sB.userData.spin.children.forEach((c) => { c.position.x += 0.05; }); sB.quaternion.copy(q); g.add(sB);
      { const y = MK.yoke(); y.rotation.set(Math.PI / 2, Math.PI, 0); sB.userData.spin.add(y); }
      const cr1 = MK.cross(); g.add(cr1);
      const d = createDrive(), e = { a: d.add({ id: 'a', J: 0, frame: { o: new THREE.Vector3(), axis: X, ref: Y } }), b: d.add({ id: 'b', J: 0, frame: { o: new THREE.Vector3(), axis: dir, ref: Y } }) };
      d.connect('a', 'out', 'b', 'in', 'ujoint', { pinA: Y.clone(), pinB: zq.clone() });
      let sC = null, cr2 = null;
      if (p.double) {
        const J2 = dir.clone().multiplyScalar(L);
        { const y = MK.yoke(); y.rotation.x = Math.PI / 2; y.position.x = L; sB.userData.spin.add(y); }   // widełki w tej samej płaszczyźnie (układ Z)
        sC = MK.shaft({ len: 0.3 }); sC.position.copy(J2); { const y = MK.yoke(); y.rotation.y = Math.PI; sC.userData.spin.add(y); } g.add(sC);
        cr2 = MK.cross(); cr2.position.copy(J2); g.add(cr2);
        e.c = d.add({ id: 'c', J: 0, frame: { o: J2.clone(), axis: X, ref: Y } });
        d.connect('b', 'out', 'c', 'in', 'ujoint', { pinA: zq.clone(), pinB: Y.clone() });
      }
      d.solve('a');
      const pose = (cr, pinA, ta, axA, pinB, tb, axB) => {
        const a = pinA.clone().applyAxisAngle(axA, ta), bb = pinB.clone().applyAxisAngle(axB, tb); bb.addScaledVector(a, -bb.dot(a)).normalize();
        cr.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(a, bb), a, bb));
      };
      const out = p.double ? e.c : e.b, f3 = (v) => v.toLocaleString('pl', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
      const info = () => [['Kąt łamania', `${p.beta}°`], ['Przełożenie chwilowe', `ω₂/ω₁ = ${f3(Math.abs(out.r || 1))}`], ['Wał pośredni / bierny (pojedynczy)', `${f3(Math.cos(b))} … ${f3(1 / Math.cos(b))} × ω₁`], ['Wyjście', p.double ? 'równomierne — układ Z znosi nierównomierność' : 'nierównomierne — przyspiesza i zwalnia 2 razy na obrót']];
      return { group: g, live: info, info: info(), view: { yaw: 0.35, pitch: 0.55 }, ports: [P('in', 'Wał czynny'), P('out', 'Wał bierny')],
        update: (t) => {
          d.pose(t); sA.userData.spin.rotation.x = e.a.theta; sB.userData.spin.rotation.x = e.b.theta;
          pose(cr1, Y, e.a.theta, X, zq, e.b.theta, dir);
          if (p.double) { sC.userData.spin.rotation.x = e.c.theta; pose(cr2, zq, e.b.theta, dir, Y, e.c.theta, X); }
        } };
    },
  },
  {
    id: 'motor', name: 'Silnik elektryczny', group: 'Napęd',
    params: [
      { key: 'kW', label: 'Moc', type: 'select', options: MK.MOTORS.map((m) => [m.kW, `${String(m.kW).replace('.', ',')} kW (wielkość ${m.frame})`]), def: 1.1 },
      { key: 'poles', label: 'Liczba biegunów', type: 'select', options: [[2, '2 — 3000 obr/min'], [4, '4 — 1500 obr/min'], [6, '6 — 1000 obr/min']], def: 4 },
      { key: 'paint', label: 'Kolor', type: 'select', options: [['paintBlue', 'niebieski RAL 5010'], ['paintGrey', 'szary RAL 7031'], ['paintRed', 'czerwony RAL 3000']], def: 'paintBlue' },
    ],
    build(p) {
      const g = MK.motor(p), u = g.userData, h = new THREE.Group(); g.position.y = -u.H; h.add(g);
      return { group: h, rest: true, update: spinAll(g),
        info: [['Wielkość mechaniczna', `${u.spec.frame} (oś ${mm(u.H, 0)} nad łapami)`], ['Obroty synchroniczne', `${Math.round(u.nSync)} obr/min`], ['Obroty znamionowe (ok.)', `${Math.round(u.nRated)} obr/min`], ['Moment znamionowy', `${u.Tn.toLocaleString('pl', { maximumFractionDigits: 1 })} N·m`], ['Wał', `Ø ${mm(u.shaftD, 0)} × ${mm(u.shaftL, 0)}`], ['Masa', kg(u.mass)], ['Bezwładność wirnika', kgcm2(u.J)]],
        ports: [P('out', 'Wał wyjściowy'), P('power', 'Zasilanie 3 × 400 V', 'energia elektryczna'), P('base', 'Łapy (mocowanie)', 'mocowanie')] };
    },
  },
  {
    id: 'brake', name: 'Hamulec tarczowy', group: 'Napęd',
    params: [
      { key: 'd', label: 'Średnica tarczy', type: 'range', min: 0.1, max: 0.35, step: 0.005, unit: 'mm', def: 0.2 },
      { key: 't', label: 'Grubość', type: 'range', min: 0.004, max: 0.02, step: 0.001, unit: 'mm', def: 0.008 },
      { key: 'vents', label: 'Otwory', type: 'range', min: 0, max: 24, step: 1, def: 12 },
    ],
    build(p) {
      const g = MK.discBrake(p), u = g.userData, s = shaftBit(0.3); g.userData.spin.add(s);
      return { group: g, update: spinAll(g), info: [['Masa tarczy', kg(u.mass)], ['Bezwładność', kgcm2(u.J)], ['Zacisk', 'jednotłoczkowy, pływający']],
        ports: [P('shaft', 'Wał (obciążenie)', 'obciążenie'), P('ctl', 'Docisk zacisku', 'sterowanie')] };
    },
  },
  /* ---------------- sterowanie: obsługa na modelu (klik, przeciąganie) ---------------- */
  {
    id: 'switch', name: 'Wyłącznik', group: 'Sterowanie',
    params: [
      { key: 'kind', label: 'Rodzaj', type: 'select', options: [['cam', 'krzywkowy obrotowy 0–I'], ['main', 'główny (rączka czerwona, tabliczka żółta)'], ['lever', 'dźwigniowy']], def: 'cam' },
      { key: 'poles', label: 'Bieguny', type: 'select', options: [[1, '1'], [2, '2'], [3, '3'], [4, '3 + N']], def: 3 },
      { key: 'amps', label: 'Prąd znamionowy', type: 'select', options: [[10, '10 A'], [16, '16 A'], [25, '25 A'], [40, '40 A'], [63, '63 A']], def: 16 },
    ],
    build(p) {
      const g = CK.switchUnit(p), a = g.userData.api;
      const live = () => [['Stan', a.on ? 'I — załączony (obwód zamknięty)' : '0 — wyłączony (obwód otwarty)'], ['Wyjście', a.on ? `${p.poles > 1 ? '3 × 400 V' : '230 V'} podane dalej` : 'bez napięcia']];
      return { group: g, controls: true, rest: true, view: { yaw: 0.35, pitch: 0.25 }, update() {}, tick: (dt) => a.tick(dt), api: a, live,
        info: [['Obsługa', 'kliknij dźwignię albo pokrętło'], ['Bieguny', p.poles === 4 ? '3 + N' : String(p.poles)], ['Prąd znamionowy', `${p.amps} A (AC-21)`], ['Napięcie', '690 V AC maks.'], ['Masa', kg(g.userData.mass)], ...live()],
        ports: [P('in', 'Zasilanie (L1–L3 / L, N)', 'energia elektryczna'), P('out', 'Wyjście po załączeniu', 'energia elektryczna'), P('state', 'Stan 0 / I', 'sygnał cyfrowy'), P('base', 'Obudowa (mocowanie)', 'mocowanie')] };
    },
  },
  {
    id: 'pot', name: 'Potencjometr', group: 'Sterowanie',
    params: [
      { key: 'ohms', label: 'Rezystancja', type: 'select', options: [[1000, '1 kΩ'], [4700, '4,7 kΩ'], [10000, '10 kΩ'], [47000, '47 kΩ'], [100000, '100 kΩ']], def: 10000 },
      { key: 'taper', label: 'Charakterystyka', type: 'select', options: [['lin', 'liniowa (B)'], ['log', 'logarytmiczna (A)']], def: 'lin' },
      { key: 'knob', label: 'Pokrętło', type: 'select', options: [['black', 'czarne'], ['grey', 'szare'], ['red', 'czerwone'], ['blue', 'niebieskie']], def: 'black' },
    ],
    build(p) {
      const g = CK.potentiometer(p), a = g.userData.api, f2 = (v) => v.toLocaleString('pl', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const live = () => { const r = a.ratio(); return [['Położenie', `${f2(a.pos * 10)} / 10 (${Math.round(a.pos * 270)}° z 270°)`], ['Napięcie suwaka (zasilanie 10 V)', `${f2(10 * r)} V`], ['Rezystancja suwak–początek', `${Math.round(p.ohms * r).toLocaleString('pl')} Ω`]]; };
      return { group: g, controls: true, rest: true, view: { yaw: 0.25, pitch: 0.2 }, update() {}, tick: () => {}, api: a, live,
        info: [['Obsługa', 'przeciągnij pokrętło w górę / w dół'], ['Rezystancja', `${(p.ohms / 1000).toLocaleString('pl')} kΩ`], ['Charakterystyka', p.taper === 'log' ? 'logarytmiczna (A) — ok. 10 % przy połowie obrotu' : 'liniowa (B)'], ['Moc', '0,5 W'], ...live()],
        ports: [P('u', 'Zacisk 1 (+10 V)', 'energia elektryczna'), P('gnd', 'Zacisk 3 (masa)', 'energia elektryczna'), P('wiper', 'Zacisk 2 — suwak (0–10 V)', 'sygnał analogowy'), P('base', 'Obudowa (mocowanie)', 'mocowanie')] };
    },
  },
  {
    id: 'button', name: 'Przycisk', group: 'Sterowanie',
    params: [
      { key: 'color', label: 'Kolor', type: 'select', options: Object.entries(CK.BUTTON_COLORS), def: 'green' },
      { key: 'mode', label: 'Działanie', type: 'select', options: [['momentary', 'chwilowy (sprężyna wraca)'], ['latch', 'z podtrzymaniem (wciśnij — wciśnij)']], def: 'momentary' },
      { key: 'contact', label: 'Styk', type: 'select', options: [['NO', 'NO — zwierny (13–14)'], ['NC', 'NC — rozwierny (11–12)']], def: 'NO' },
      { key: 'lit', label: 'Podświetlenie', type: 'check', def: false },
      { key: 'mushroom', label: 'Grzybkowy', type: 'check', def: false },
    ],
    build(p) {
      const g = CK.pushButton(p), a = g.userData.api;
      const live = () => [['Wciśnięty', a.pressed ? 'tak' : 'nie'], ['Styk', a.closed ? 'zamknięty — prąd płynie' : 'otwarty'], ['Wyjście (24 V DC)', a.closed ? '24 V' : '0 V']];
      return { group: g, controls: true, rest: true, view: { yaw: 0.3, pitch: 0.2 }, update() {}, tick: (dt) => a.tick(dt), api: a, live,
        info: [['Obsługa', p.mode === 'latch' ? 'kliknij — wciska się i zostaje; kliknij znowu — wraca' : 'przytrzymaj przycisk myszy na przycisku'], ['Otwór montażowy', 'Ø 22,5 mm'], ['Styk', p.contact === 'NO' ? 'zwierny 13–14' : 'rozwierny 11–12'], ['Obciążalność styku', '10 A, 24 V DC / 6 A, 230 V AC'], ['Podświetlenie', p.lit ? 'LED 24 V — świeci, gdy styk zamknięty' : 'brak'], ...live()],
        ports: [P('a', `Zacisk ${p.contact === 'NO' ? '13' : '11'}`, 'sygnał cyfrowy'), P('b', `Zacisk ${p.contact === 'NO' ? '14' : '12'}`, 'sygnał cyfrowy'), ...(p.lit ? [P('lamp', 'Lampka X1–X2', 'energia elektryczna')] : []), P('base', 'Obudowa (mocowanie)', 'mocowanie')] };
    },
  },
  {
    id: 'vfd', name: 'Falownik z pokrętłem', group: 'Sterowanie',
    params: [
      { key: 'kW', label: 'Moc', type: 'select', options: MK.MOTORS.map((m) => [m.kW, `${String(m.kW).replace('.', ',')} kW`]), def: 1.1 },
      { key: 'fmax', label: 'Częstotliwość maks.', type: 'select', options: [[50, '50 Hz'], [60, '60 Hz'], [87, '87 Hz (silnik w trójkącie)'], [100, '100 Hz']], def: 50 },
      { key: 'ramp', label: 'Rampa (0 → fmax)', type: 'range', min: 0.5, max: 20, step: 0.5, unit: 's', def: 5 },
      { key: 'poles', label: 'Silnik — bieguny', type: 'select', options: [[2, '2'], [4, '4'], [6, '6']], def: 4 },
    ],
    build(p) {
      const g = CK.inverter(p), a = g.userData.api, f1 = (v) => v.toLocaleString('pl', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const live = () => {
        const nSync = 120 * a.f / p.poles, U = Math.min(400, 400 * a.f / 50);
        return [['Stan', a.run ? 'RUN — praca' : 'STOP'], ['Kierunek', a.dir > 0 ? 'FWD — w przód' : 'REV — wstecz'], ['Zadana', `${f1(a.set)} Hz`], ['Wyjściowa', `${f1(a.f)} Hz`], ['Napięcie wyjściowe (U/f)', `${Math.round(Math.abs(U))} V`], ['Obroty silnika (synchroniczne)', `${Math.round(nSync)} obr/min`]];
      };
      return { group: g, controls: true, rest: true, view: { yaw: 0.3, pitch: 0.15 }, update() {}, tick: (dt) => a.tick(dt), api: a, live,
        info: [['Obsługa', 'przeciągnij pokrętło; RUN / STOP i żółty FWD / REV (kierunek) — kliknij'], ['Moc', `${String(p.kW).replace('.', ',')} kW`], ['Zasilanie', '3 × 400 V, 50 Hz'], ['Rampa', `${f1(p.ramp)} s od 0 do ${p.fmax} Hz`], ['Masa', kg(g.userData.mass)], ...live()],
        ports: [P('mains', 'Zasilanie L1 L2 L3', 'energia elektryczna'), P('motor', 'Wyjście U V W (silnik)', 'energia elektryczna'), P('ai', 'Wejście analogowe 0–10 V (potencjometr)', 'sygnał analogowy'), P('di', 'Wejścia cyfrowe: start, stop, kierunek', 'sygnał cyfrowy'), P('base', 'Radiator (mocowanie)', 'mocowanie')] };
    },
  },
  {
    id: 'estop', name: 'Grzybek bezpieczeństwa', group: 'Sterowanie',
    params: [{ key: 'contacts', label: 'Styki', type: 'select', options: [['1NC', '1 NC'], ['2NC', '2 NC'], ['1NC1NO', '1 NC + 1 NO']], def: '1NC' }],
    build(p) {
      const g = CK.eStop(p), a = g.userData.api;
      const live = () => [['Stan', a.latched ? 'WCIŚNIĘTY — zatrzaśnięty' : 'zwolniony'], ['Styk NC (obwód bezpieczeństwa)', a.closed ? 'zamknięty — maszyna może pracować' : 'otwarty — STOP']];
      return { group: g, controls: true, rest: true, view: { yaw: 0.3, pitch: 0.25 }, update() {}, tick: (dt) => a.tick(dt), api: a, live,
        info: [['Obsługa', 'kliknij — wciśnij (zatrzask); kliknij znowu — odblokuj obrotem'], ['Norma', 'PN-EN ISO 13850 (czerwony na żółtym)'], ['Styki', { '1NC': '1 NC', '2NC': '2 NC', '1NC1NO': '1 NC + 1 NO' }[p.contacts] || p.contacts], ['Masa', kg(g.userData.mass)], ...live()],
        ports: [P('nc', 'Styk NC 11–12 (obwód bezpieczeństwa)', 'sygnał cyfrowy'), ...(p.contacts.includes('NO') ? [P('no', 'Styk NO 13–14 (sygnalizacja)', 'sygnał cyfrowy')] : []), ...(p.contacts === '2NC' ? [P('nc2', 'Styk NC 21–22', 'sygnał cyfrowy')] : []), P('base', 'Obudowa (mocowanie)', 'mocowanie')] };
    },
  },
  {
    id: 'lamp', name: 'Lampka sygnalizacyjna', group: 'Sterowanie',
    params: [
      { key: 'color', label: 'Kolor', type: 'select', options: [['green', 'zielona (praca)'], ['red', 'czerwona (awaria)'], ['yellow', 'żółta (ostrzeżenie)'], ['blue', 'niebieska'], ['white', 'biała']], def: 'green' },
      { key: 'volts', label: 'Zasilanie', type: 'select', options: [['24DC', '24 V AC/DC'], ['230AC', '230 V AC']], def: '24DC' },
    ],
    build(p) {
      const g = CK.pilotLamp(p), a = g.userData.api;
      const live = () => [['Stan', a.on ? 'świeci (zasilona)' : 'zgaszona'], ['Prąd', a.on ? (p.volts === '24DC' ? '20 mA' : '8 mA') : '0']];
      return { group: g, controls: true, rest: true, view: { yaw: 0.3, pitch: 0.2 }, update() {}, tick: (dt) => a.tick(dt), api: a, live,
        info: [['Obsługa', 'kliknij soczewkę — zasil / odłącz (test)'], ['Źródło światła', 'LED'], ['Otwór montażowy', 'Ø 22,5 mm'], ['Zasilanie', p.volts === '24DC' ? '24 V AC/DC' : '230 V AC'], ...live()],
        ports: [P('x1', 'Zacisk X1', 'energia elektryczna'), P('x2', 'Zacisk X2', 'energia elektryczna'), P('base', 'Obudowa (mocowanie)', 'mocowanie')] };
    },
  },
  {
    id: 'selector', name: 'Przełącznik wyboru', group: 'Sterowanie',
    params: [
      { key: 'positions', label: 'Pozycje', type: 'select', options: [['0-I', '2 pozycje: 0–I'], ['I-0-II', '3 pozycje: I–0–II']], def: 'I-0-II' },
      { key: 'spring', label: 'Powrót sprężyną do 0', type: 'check', def: false },
      { key: 'handle', label: 'Rączka', type: 'select', options: [['short', 'krótka'], ['long', 'długa']], def: 'short' },
    ],
    build(p) {
      const g = CK.selector(p), a = g.userData.api;
      const live = () => [['Pozycja', a.pos], ['Styk I (13–14)', a.pos === 'I' ? 'zamknięty' : 'otwarty'], ...(p.positions === 'I-0-II' ? [['Styk II (23–24)', a.pos === 'II' ? 'zamknięty' : 'otwarty']] : [])];
      return { group: g, controls: true, rest: true, view: { yaw: 0.3, pitch: 0.2 }, update() {}, tick: (dt) => a.tick(dt), api: a, live,
        info: [['Obsługa', p.spring ? 'przytrzymaj — kolejna pozycja, puść — wraca do 0' : 'kliknij — kolejna pozycja'], ['Kąt', p.positions === 'I-0-II' ? '45° w każdą stronę' : '90°'], ['Otwór montażowy', 'Ø 22,5 mm'], ...live()],
        ports: [P('i', 'Styk pozycji I', 'sygnał cyfrowy'), ...(p.positions === 'I-0-II' ? [P('ii', 'Styk pozycji II', 'sygnał cyfrowy')] : []), P('base', 'Obudowa (mocowanie)', 'mocowanie')] };
    },
  },
  {
    id: 'limit', name: 'Wyłącznik krańcowy', group: 'Sterowanie',
    params: [{ key: 'actuator', label: 'Napęd', type: 'select', options: [['roller', 'dźwignia z rolką'], ['plunger', 'popychacz']], def: 'roller' }],
    build(p) {
      const g = CK.limitSwitch(p), a = g.userData.api;
      const live = () => [['Stan', a.actuated ? 'najechany' : 'swobodny'], ['Styk NO (13–14)', a.actuated ? 'zamknięty' : 'otwarty'], ['Styk NC (21–22)', a.actuated ? 'otwarty' : 'zamknięty']];
      return { group: g, controls: true, rest: true, view: { yaw: 0.5, pitch: 0.2 }, update() {}, tick: (dt) => a.tick(dt), api: a, live,
        info: [['Obsługa', `przytrzymaj ${p.actuator === 'roller' ? 'rolkę' : 'popychacz'} — jak najechanie elementem maszyny`], ['Korpus', 'odlew aluminiowy, IP67'], ['Styki', '1 NO + 1 NC, migowe'], ['Masa', kg(g.userData.mass)], ...live()],
        ports: [P('act', p.actuator === 'roller' ? 'Rolka (najazd — ruch mechaniczny)' : 'Popychacz (najazd — ruch mechaniczny)', 'ruch'), P('no', 'Styk NO 13–14', 'sygnał cyfrowy'), P('nc', 'Styk NC 21–22', 'sygnał cyfrowy'), P('base', 'Korpus (mocowanie)', 'mocowanie')] };
    },
  },
  {
    id: 'contactor', name: 'Stycznik', group: 'Sterowanie',
    params: [
      { key: 'amps', label: 'Prąd AC-3', type: 'select', options: [[9, '9 A (4 kW)'], [12, '12 A (5,5 kW)'], [18, '18 A (7,5 kW)'], [25, '25 A (11 kW)'], [32, '32 A (15 kW)']], def: 12 },
      { key: 'coil', label: 'Cewka', type: 'select', options: [['230AC', '230 V AC'], ['24DC', '24 V DC']], def: '230AC' },
      { key: 'aux', label: 'Styk pomocniczy', type: 'select', options: [['1NO', '1 NO'], ['1NC', '1 NC']], def: '1NO' },
    ],
    build(p) {
      const g = CK.contactor(p), a = g.userData.api;
      const live = () => [['Cewka', a.on ? 'zasilona — kotwica przyciągnięta' : 'bez zasilania'], ['Styki główne 1-2, 3-4, 5-6', a.on ? 'zamknięte — silnik zasilany' : 'otwarte'], [`Styk pomocniczy ${p.aux === '1NO' ? '13–14' : '21–22'}`, (p.aux === '1NO') === a.on ? 'zamknięty' : 'otwarty']];
      return { group: g, controls: true, rest: true, view: { yaw: 0.35, pitch: 0.2 }, update() {}, tick: (dt) => a.tick(dt), api: a, live,
        info: [['Obsługa', 'kliknij przód — test (jak zasilona cewka)'], ['Prąd AC-3', `${p.amps} A`], ['Cewka', p.coil === '230AC' ? '230 V AC, ok. 7 VA' : '24 V DC, ok. 3 W'], ['Montaż', 'szyna DIN 35 mm'], ['Masa', kg(g.userData.mass)], ...live()],
        ports: [P('coil', `Cewka A1–A2 (${p.coil === '230AC' ? '230 V AC' : '24 V DC'})`, 'energia elektryczna'), P('in', 'Styki główne 1 3 5 (zasilanie)', 'energia elektryczna'), P('out', 'Styki główne 2 4 6 (odbiornik)', 'energia elektryczna'), P('aux', `Styk pomocniczy ${p.aux}`, 'sygnał cyfrowy'), P('base', 'Szyna DIN (mocowanie)', 'mocowanie')] };
    },
  },
  /* ---------------- zasilanie i przewody ---------------- */
  {
    id: 'wire', name: 'Przewód', group: 'Zasilanie i przewody',
    params: [
      { key: 'mm2', label: 'Przekrój', type: 'select', options: [[0.5, '0,5 mm²'], [0.75, '0,75 mm²'], [1, '1 mm²'], [1.5, '1,5 mm²'], [2.5, '2,5 mm²'], [4, '4 mm²'], [6, '6 mm²'], [10, '10 mm²'], [16, '16 mm²']], def: 1.5 },
      { key: 'color', label: 'Kolor izolacji', type: 'select', options: Object.entries(CK.WIRE_COLORS).map(([k, v]) => [k, v[1]]), def: 'brown' },
      { key: 'len', label: 'Długość', type: 'range', min: 0.1, max: 3, step: 0.05, unit: 'm', def: 0.6 },
    ],
    build(p) {
      const g = CK.wire(p), u = g.userData, IZ = { 0.5: 7.5, 0.75: 10, 1: 13.5, 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76 }[p.mm2], f = (v, d = 3) => v.toLocaleString('pl', { maximumFractionDigits: d });
      return { group: g, rest: true, view: { yaw: 0.2, pitch: 0.45 }, update() {},
        info: [['Rodzaj', 'linka Cu H07V-K, izolacja PVC'], ['Średnica z izolacją', mm(u.dIns, 1)], ['Rezystancja (20 °C)', `${f(u.R * 1000, 1)} mΩ`], ['Obciążalność (ułożenie B2)', `${IZ} A`], ['Spadek napięcia przy ' + IZ + ' A (tam i z powrotem)', `${f(2 * IZ * u.R, 2)} V`], ['Tulejki', 'zaciskane, kolor wg DIN 46228-4'], ['Masa', kg(u.mass)]],
        ports: [P('a', 'Koniec A (tulejka)', 'energia elektryczna'), P('b', 'Koniec B (tulejka)', 'energia elektryczna')] };
    },
  },
  {
    id: 'ac', name: 'Źródło zasilania AC (umowne)', group: 'Zasilanie i przewody',
    params: [
      { key: 'phases', label: 'Fazy', type: 'select', options: [[1, '1 faza (L, N, PE)'], [3, '3 fazy (L1–L3, N, PE)']], def: 1 },
      { key: 'volts', label: 'Napięcie', type: 'select', options: [[24, '24 V'], [110, '110 V'], [230, '230 V'], [400, '400 V (międzyfazowe)']], def: 230 },
      { key: 'hz', label: 'Częstotliwość', type: 'select', options: [[50, '50 Hz'], [60, '60 Hz']], def: 50 },
      { key: 'amps', label: 'Prąd maks. (zabezpieczenie)', type: 'select', options: [[6, '6 A'], [10, '10 A'], [16, '16 A'], [25, '25 A'], [32, '32 A'], [63, '63 A']], def: 16 },
    ],
    build(p) {
      const g = CK.powerSource({ kind: 'AC', ...p }), a = g.userData.api, Uf = p.phases === 3 ? (p.volts === 400 ? 230 : p.volts / Math.sqrt(3)) : p.volts;
      const live = () => [['Wyjście', a.on ? 'załączone' : 'wyłączone'], ['Napięcie szczytowe', a.on ? `±${Math.round(Uf * Math.SQRT2)} V (faza)` : '0 V']];
      return { group: g, controls: true, rest: true, view: { yaw: 0.25, pitch: 0.25 }, update() {}, tick: (dt) => a.tick(dt), api: a, live,
        info: [['Obsługa', 'kliknij wyłącznik — załącz / wyłącz'], ['Rodzaj', 'umowne źródło (sieć, rozdzielnica) — nie konkretne urządzenie'], ['Napięcie skuteczne', p.phases === 3 ? `${Math.round(Uf)} V fazowe, ${p.volts === 400 ? 400 : Math.round(Uf * Math.sqrt(3))} V międzyfazowe` : `${p.volts} V`], ['Częstotliwość', `${p.hz} Hz (okres ${(1000 / p.hz).toLocaleString('pl', { maximumFractionDigits: 1 })} ms)`], ['Moc maks.', `${(p.phases === 3 ? Math.sqrt(3) * Uf * Math.sqrt(3) * p.amps : p.volts * p.amps).toLocaleString('pl', { maximumFractionDigits: 0 })} VA`], ...live()],
        ports: [...(p.phases === 3 ? ['L1', 'L2', 'L3'] : ['L']).map((t) => P(t.toLowerCase(), `Wyjście ${t}`, 'energia elektryczna')), P('n', 'Przewód neutralny N', 'energia elektryczna'), P('pe', 'Przewód ochronny PE', 'energia elektryczna')] };
    },
  },
  {
    id: 'dc', name: 'Źródło zasilania DC (umowne)', group: 'Zasilanie i przewody',
    params: [
      { key: 'volts', label: 'Napięcie', type: 'range', min: 1, max: 60, step: 0.5, unit: 'V', def: 24 },
      { key: 'amps', label: 'Prąd maks.', type: 'select', options: [[1, '1 A'], [2.5, '2,5 A'], [5, '5 A'], [10, '10 A'], [20, '20 A']], def: 5 },
    ],
    build(p) {
      const g = CK.powerSource({ kind: 'DC', ...p }), a = g.userData.api;
      const live = () => [['Wyjście', a.on ? `załączone — ${p.volts.toLocaleString('pl')} V` : 'wyłączone']];
      return { group: g, controls: true, rest: true, view: { yaw: 0.25, pitch: 0.25 }, update() {}, tick: (dt) => a.tick(dt), api: a, live,
        info: [['Obsługa', 'kliknij wyłącznik — załącz / wyłącz'], ['Rodzaj', 'umowne źródło napięcia stałego (zasilacz, akumulator)'], ['Napięcie', `${p.volts.toLocaleString('pl')} V`], ['Prąd maks.', `${String(p.amps).replace('.', ',')} A — ograniczenie prądu`], ['Moc maks.', `${Math.round(p.volts * p.amps)} W`], ...live()],
        ports: [P('plus', 'Wyjście +', 'energia elektryczna'), P('minus', 'Wyjście −', 'energia elektryczna')] };
    },
  },
];

// przybliżony wskaźnik przyporu pary kół zewnętrznych (α = 20°, wysokość głowy = m)
function contactRatio(z1, z2) {
  const a = 20 * Math.PI / 180, r1 = z1 / 2, r2 = z2 / 2, ra1 = r1 + 1, ra2 = r2 + 1, rb1 = r1 * Math.cos(a), rb2 = r2 * Math.cos(a);
  return (Math.sqrt(ra1 * ra1 - rb1 * rb1) + Math.sqrt(ra2 * ra2 - rb2 * rb2) - (r1 + r2) * Math.sin(a)) / (Math.PI * Math.cos(a));
}
