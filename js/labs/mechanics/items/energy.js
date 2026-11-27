// Magazynowanie energii (kategoria 2): sprężyna naciskowa, sprężyna spiralna w bębnie, koło zamachowe.
// Przedmiot: { id, name, group, params, build(p) → { group, update(θ), info, live?, warn?, ports } } (opis w ../items.js).
import * as THREE from '../../../../vendor/three/three.module.js';
import * as CL from '../../../models/mech/clock/index.js';
import { TAU, mm, kg, P, num, portsOf } from './util.js';

export const ENERGY = [
  {
    id: 'cspring', name: 'Sprężyna naciskowa', group: 'Sprężyny',
    params: [
      { key: 'd', label: 'Średnica drutu', type: 'range', min: 0.0005, max: 0.006, step: 0.0001, unit: 'mm.1', def: 0.002 },
      { key: 'D', label: 'Średnica podziałowa zwoju', type: 'range', min: 0.006, max: 0.06, step: 0.001, unit: 'mm', def: 0.02 },
      { key: 'n', label: 'Zwoje czynne', type: 'range', min: 2, max: 20, step: 0.5, def: 8 },
      { key: 'L0', label: 'Długość swobodna', type: 'range', min: 0.02, max: 0.2, step: 0.002, unit: 'mm', def: 0.06 },
      { key: 'mat', label: 'Materiał', type: 'select', options: [['sh', 'drut sprężynowy EN 10270-1 SH'], ['ss', 'stal nierdzewna 1.4310']], def: 'sh' },
      { key: 'x', label: 'Ugięcie maks. (podgląd)', type: 'range', min: 0.002, max: 0.1, step: 0.001, unit: 'mm', def: 0.02 },
    ],
    build(p) {
      const G = p.mat === 'ss' ? 70e9 : 81.5e9, Rm = p.mat === 'ss' ? 1.9e9 * Math.pow(p.d * 1000, -0.09) : 2.23e9 * Math.pow(p.d * 1000, -0.135), tauA = 0.5 * Rm;
      const C = p.D / p.d, Kw = (4 * C - 1) / (4 * C - 4) + 0.615 / C, k = G * p.d ** 4 / (8 * p.D ** 3 * p.n), Ls = (p.n + 2) * p.d, sMax = Math.max(0, p.L0 - Ls), x = Math.min(p.x, sMax);
      const sp = CL.compressionSpring({ d: p.d, D: p.D, n: p.n, L0: p.L0 }), u = sp.userData, M = CL.materials();
      const g = new THREE.Group(), base = new THREE.Mesh(new THREE.CylinderGeometry(p.D * 0.9, p.D * 0.9, 0.006, 48), M.steel), top = new THREE.Mesh(new THREE.CylinderGeometry(p.D * 0.75, p.D * 0.75, 0.006, 48), M.steel), rod = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.0015, (p.D - p.d) / 2 * 0.55), Math.max(0.0015, (p.D - p.d) / 2 * 0.55), p.L0 + 0.02, 24), M.steelP);
      base.position.y = -0.003; rod.position.y = (p.L0 + 0.02) / 2; for (const o of [base, top, rod]) { o.castShadow = o.receiveShadow = true; }
      g.add(base, sp, top, rod);
      const tauOf = (F) => Kw * 8 * F * p.D / (Math.PI * p.d ** 3), fn = p.d / (2 * Math.PI * p.n * p.D ** 2) * Math.sqrt(G / (2 * 7850)) * 2 * Math.PI / (2 * Math.PI);
      let cur = 0;
      const set = (s) => { cur = s; u.setLength(p.L0 - s); top.position.y = p.L0 - s + 0.003; };
      set(0);
      const warn = [];
      if (C < 4) warn.push(`Wskaźnik sprężyny D/d = ${num(C, 1)} — za mały (trudna do zwinięcia, duże naprężenia).`);
      if (C > 16) warn.push(`Wskaźnik sprężyny D/d = ${num(C, 1)} — za duży (sprężyna wiotka, plącze się).`);
      if (p.L0 / p.D > 5.2) warn.push(`Smukłość L0/D = ${num(p.L0 / p.D, 1)} — sprężyna może się wyboczyć, potrzebny trzpień lub tuleja.`);
      if (tauOf(k * sMax) > tauA) warn.push(`Przy zblokowaniu zwojów τ = ${num(tauOf(k * sMax) / 1e6)} MPa > dopuszczalne ${num(tauA / 1e6)} MPa — sprężyna osiądzie.`);
      if (p.x > sMax) warn.push(`Ugięcie ograniczone do ${mm(sMax)} — dalej zwoje przylegają (długość zblokowania ${mm(Ls)}).`);
      const live = () => [['Długość', mm(p.L0 - cur, 1)], ['Ugięcie', mm(cur, 1)], ['Siła F = k·s', `${num(k * cur, 1)} N`], ['Naprężenie τ (z poprawką Wahla)', `${num(tauOf(k * cur) / 1e6)} MPa`], ['Energia ½·k·s²', `${num(0.5 * k * cur * cur, 3)} J`]];
      return { group: g, rest: true, warn, view: { yaw: 0.6, pitch: 0.35 },
        update: (t) => set(x * (1 - Math.cos(t)) / 2), live,
        info: [['Sztywność k = G·d⁴ / (8·D³·n)', `${num(k / 1000, 2)} N/mm`], ['Wskaźnik D/d', num(C, 2)], ['Długość zblokowania (n + 2)·d', mm(Ls, 1)], ['Ugięcie do zblokowania', mm(sMax, 1)], ['Siła przy zblokowaniu', `${num(k * sMax, 1)} N`],
          ['Moduł Kirchhoffa G', `${num(G / 1e9, 1)} GPa`], ['Wytrzymałość Rm (dla tej średnicy)', `${num(Rm / 1e6)} MPa`], ['Naprężenie dopuszczalne 0,5·Rm', `${num(tauA / 1e6)} MPa`], ['Częstotliwość własna', `${num(fn, 0)} Hz`], ['Masa', kg(u.mass)], ...live()],
        ports: [P('top', 'Koniec górny (siła)', 'przesuw'), P('bottom', 'Koniec dolny (podparcie)', 'przesuw')] };
    },
  },
  {
    id: 'mainspring', name: 'Sprężyna spiralna (bęben)', group: 'Sprężyny',
    params: [
      { key: 'h', label: 'Grubość taśmy', type: 'range', min: 0.0002, max: 0.0008, step: 0.00002, unit: 'mm.2', def: 0.00042 },
      { key: 'b', label: 'Szerokość taśmy', type: 'range', min: 0.004, max: 0.025, step: 0.001, unit: 'mm', def: 0.016 },
      { key: 'L', label: 'Długość taśmy', type: 'range', min: 0.3, max: 5, step: 0.05, unit: 'mm', def: 3.4 },
      { key: 'r2', label: 'Promień wewnętrzny bębna', type: 'range', min: 0.012, max: 0.05, step: 0.001, unit: 'mm', def: 0.031 },
    ],
    build(p) {
      const r1 = Math.max(0.003, p.r2 / 5.6), bar = CL.mainspringBarrel({ b: p.b, h: p.h, L: p.L, r1, r2: p.r2, teeth: 96, m: Math.max(0.0005, Math.round(p.r2 * 2.5 / 96 * 2e4) / 2e4) }), u = bar.userData;
      const E = 2.06e11, k = E * p.b * p.h ** 3 / (12 * p.L), turns = Math.max(0, u.turns), Tmax = k * TAU * (turns + 1), sigma = 6 * Tmax / (p.b * p.h * p.h), area = Math.PI * (p.r2 ** 2 - r1 ** 2), fill = p.L * p.h / area;
      const g = new THREE.Group(); bar.rotation.y = 0; g.add(bar);
      const warn = [];
      if (fill > 0.55) warn.push(`Taśma zajmuje ${num(fill * 100)} % pola bębna — za dużo (optimum ok. 50 %), mało zwojów roboczych.`);
      if (fill < 0.35) warn.push(`Taśma zajmuje tylko ${num(fill * 100)} % pola bębna — bęben za duży do tej sprężyny.`);
      if (sigma > 2.2e9) warn.push(`Naprężenie gnące przy pełnym naciągu ${num(sigma / 1e6)} MPa — powyżej wytrzymałości stali sprężynowej, sprężyna pęknie.`);
      if (p.h / r1 > 0.08) warn.push('Taśma za gruba do promienia wałka (h/r₁ > 1/12) — pęknie przy haczyku wałka.');
      let wf = 0.5;
      const live = () => [['Naciąg', `${num(wf * turns, 1)} z ${num(turns, 1)} obr.`], ['Moment na bębnie', `${num(k * TAU * (wf * turns + 1), 3)} N·m`], ['Energia', `${num(0.5 * k * (TAU * (wf * turns + 1)) ** 2, 2)} J`]];
      return { group: g, rest: false, warn, view: { yaw: 0.1, pitch: 0.2 },
        update: (t) => { wf = (1 - Math.cos(t / Math.max(1, turns))) / 2; u.setWind(wf); u.arbor.rotation.z = -t; }, live,
        info: [['Sztywność k = E·b·h³ / (12·L)', `${num(k * 1000, 2)} N·mm/rad`], ['Zwoje rozwinięte (przy ściance)', num(u.nDown, 1)], ['Zwoje nawinięte (na wałku)', num(u.nUp, 1)], ['Obroty robocze', num(turns, 1)], ['Wypełnienie bębna', `${num(fill * 100)} %`],
          ['Moment przy pełnym naciągu', `${num(Tmax, 3)} N·m`], ['Naprężenie gnące maks.', `${num(sigma / 1e6)} MPa`], ['Stal', 'sprężynowa, hartowana i odpuszczona (niebieska)'], ['Masa taśmy', kg(u.springMass)], ...live()],
        ports: portsOf(bar) };
    },
  },
  {
    id: 'flywheel', name: 'Koło zamachowe', group: 'Koła zamachowe',
    params: [
      { key: 'D', label: 'Średnica', type: 'range', min: 0.2, max: 1.2, step: 0.02, unit: 'mm', def: 0.5 },
      { key: 'rimW', label: 'Szerokość wieńca', type: 'range', min: 0.02, max: 0.15, step: 0.005, unit: 'mm', def: 0.06 },
      { key: 'rimT', label: 'Grubość wieńca', type: 'range', min: 0.015, max: 0.12, step: 0.005, unit: 'mm', def: 0.05 },
      { key: 'mat', label: 'Materiał', type: 'select', options: [['iron', 'żeliwo EN-GJL-250'], ['steel', 'staliwo / stal']], def: 'iron' },
      { key: 'rpm', label: 'Prędkość', type: 'range', min: 50, max: 3000, step: 10, unit: 'obr/min', def: 600 },
    ],
    build(p) {
      const f = CL.flywheel({ D: p.D, rimW: p.rimW, rimT: Math.min(p.rimT, p.D * 0.2), mat: p.mat }), u = f.userData, w = p.rpm * TAU / 60, v = w * u.R;
      const sAll = p.mat === 'steel' ? 120e6 : 20e6, vMax = Math.sqrt(sAll / u.rho), nMax = vMax / u.R * 60 / TAU, E = 0.5 * u.J * w * w;
      const g = new THREE.Group(); f.rotation.y = Math.PI / 2; g.add(f);
      const warn = [];
      if (v > vMax) warn.push(`Prędkość obwodowa ${num(v, 1)} m/s > dopuszczalna ${num(vMax, 1)} m/s dla tego materiału — wieniec rozerwie siła odśrodkowa.`);
      return { group: g, rest: false, warn, update: (t) => { f.rotation.x = t; }, view: { yaw: 0.9, pitch: 0.25 },
        info: [['Masa', kg(u.mass)], ['Masa wieńca', `${kg(u.mRim)} (${num(u.mRim / u.mass * 100)} %)`], ['Moment bezwładności J', `${num(u.J, 3)} kg·m²`], ['Energia ½·J·ω² przy ' + num(p.rpm) + ' obr/min', `${num(E / 1000, 2)} kJ`], ['Prędkość obwodowa', `${num(v, 1)} m/s`],
          ['Naprężenie w wieńcu ρ·v²', `${num(u.rho * v * v / 1e6, 1)} MPa`], ['Prędkość dopuszczalna', `${num(vMax, 1)} m/s = ${num(nMax)} obr/min`], ['Energia oddana przy spadku obrotów o 5 %', `${num(E * (1 - 0.95 ** 2) / 1000, 2)} kJ`]],
        ports: portsOf(f) };
    },
  },
];
