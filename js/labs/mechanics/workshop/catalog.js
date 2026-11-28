// Warsztat — katalog części napędu obrotowego (pierwsza wersja: obrót). Każda część budowana wzdłuż lokalnej osi +x z MechKit:
//   role: 'motor' (wał wyjściowy w +x, oś na wysokości axisY nad podstawą), 'shaft' (od x = 0 do len), 'hub' (piasta na wale:
//   koło zębate, łańcuchowe, pasowe, sprzęgło, tarcza hamulca — oś przez początek), 'support' (oprawa łożyska — oś na wysokości h).
//   build(p) → { group, spin, J, ext: [x0, x1] (zasięg wzdłuż osi), axisY (oś nad spodem), props: [[nazwa, wartość]] }
import * as THREE from '../../../../vendor/three/three.module.js';
import * as MK from '../../../models/mech/mechkit.js';
import { T } from '../lang.js';

const ext = (g) => { g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g); return [b.min.x, b.max.x]; };
const mass = (g) => `${(g.userData.mass || 0).toFixed(2)} kg`;
const J = (j) => `${(j * 1e4).toFixed(2)} kg·cm²`;

export const WS_PARTS = [
  {
    type: 'motor', role: 'motor', name: 'Silnik indukcyjny',
    params: [{ key: 'kW', label: 'Moc', type: 'select', options: [[0.37, '0,37 kW'], [0.75, '0,75 kW'], [1.1, '1,1 kW'], [2.2, '2,2 kW']], def: 1.1 }],
    build(p) {
      const g = MK.motor({ kW: +p.kW }), sp = MK.MOTORS.find((m) => m.kW >= +p.kW) || MK.MOTORS[0], rated = 1500 * (1 - 0.034 - 0.02 / Math.sqrt(sp.kW));
      return { group: g, spin: g.userData.spin, J: g.userData.J || sp.J, axisY: sp.H, shaftEnd: 0.05 * sp.H / 0.09, kW: sp.kW, rated, Trated: sp.kW * 1000 / (rated * Math.PI / 30),
        props: [['Moc znamionowa', `${String(sp.kW).replace('.', ',')} kW`], ['Obroty znamionowe', `${Math.round(rated)} obr/min`], ['Wysokość osi', `${Math.round(sp.H * 1000)} mm (wzniesienie ${sp.frame})`], ['Bezwładność wirnika', J(sp.J)], ['Masa', `${sp.mass} kg`]] };
    },
  },
  {
    type: 'shaft', role: 'shaft', name: 'Wał Ø 25',
    params: [{ key: 'len', label: 'Długość', type: 'range', min: 0.1, max: 1.2, step: 0.01, unit: 'mm', def: 0.4 }],
    build(p) { const g = MK.shaft({ len: p.len, r: 0.0125, key: true }); return { group: g, spin: g.userData.spin, J: g.userData.J, ext: [0, p.len], len: p.len, props: [['Średnica', '25 mm'], ['Długość', `${Math.round(p.len * 1000)} mm`], ['Stal', 'C45, szlifowana'], ['Masa', mass(g)], ['Bezwładność', J(g.userData.J)]] }; },
  },
  {
    type: 'gear', role: 'hub', name: 'Koło zębate',
    params: [
      { key: 'z', label: 'Liczba zębów', type: 'range', min: 12, max: 80, step: 1, def: 24 },
      { key: 'm', label: 'Moduł', type: 'select', options: [[0.002, '2 mm'], [0.003, '3 mm'], [0.004, '4 mm']], def: 0.003 },
      { key: 'w', label: 'Szerokość', type: 'range', min: 0.015, max: 0.05, step: 0.005, unit: 'mm', def: 0.03 },
      { key: 'mat', label: 'Materiał', type: 'select', options: [['gear', 'stal ulepszona'], ['brass', 'brąz']], def: 'gear' },
    ],
    build(p) { const g = MK.gear({ z: +p.z, m: +p.m, w: p.w, mat: p.mat }), u = g.userData; return { group: g, spin: u.spin, J: u.J, ext: ext(g), z: u.z, m: u.m, rp: u.rp, props: [['Liczba zębów', u.z], ['Moduł', `${u.m * 1000} mm`], ['Średnica podziałowa', `${(u.rp * 2000).toFixed(1)} mm`], ['Szerokość', `${Math.round(u.w * 1000)} mm`], ['Masa', mass(g)]] }; },
  },
  {
    type: 'jaw', role: 'hub', name: 'Sprzęgło kłowe',
    params: [],
    build() { const c = MK.jawCoupling(), g = new THREE.Group(), spin = new THREE.Group(); g.add(spin); spin.add(c.a, c.spider, c.b); g.name = T('Sprzęgło kłowe', 'Jaw coupling'); g.userData = { spin, phys: c.phys, J: c.J, mass: c.mass, ports: c.ports }; return { group: g, spin, J: c.J, ext: ext(g), coupling: true, props: [['Rodzaj', 'kłowe, podatne (gwiazda 92 Sh A)'], ['Kompensuje', 'niewspółosiowość do 0,2 mm, 1°'], ['Masa', mass(g)]] }; },
  },
  {
    type: 'sprocket', role: 'hub', name: 'Koło łańcuchowe 08A',
    params: [{ key: 'z', label: 'Liczba zębów', type: 'range', min: 12, max: 45, step: 1, def: 18 }],
    build(p) { const g = MK.sprocket({ z: +p.z }), u = g.userData; return { group: g, spin: u.spin, J: u.J, ext: ext(g), z: u.z, R: u.R, props: [['Liczba zębów', u.z], ['Podziałka', '12,7 mm (08A)'], ['Średnica podziałowa', `${(u.R * 2000).toFixed(1)} mm`], ['Masa', mass(g)]] }; },
  },
  {
    type: 'pulley', role: 'hub', name: 'Koło pasowe SPA',
    params: [{ key: 'd', label: 'Średnica skuteczna', type: 'range', min: 0.063, max: 0.25, step: 0.001, unit: 'mm', def: 0.1 }],
    build(p) { const g = MK.pulley({ d: p.d }), u = g.userData; return { group: g, spin: u.spin, J: u.J, ext: ext(g), d: u.d, props: [['Średnica skuteczna', `${Math.round(u.d * 1000)} mm`], ['Rowek', 'klinowy SPA'], ['Masa', mass(g)]] }; },
  },
  {
    type: 'brake', role: 'hub', name: 'Hamulec tarczowy (obciążenie)',
    params: [{ key: 'd', label: 'Średnica tarczy', type: 'select', options: [[0.16, 'Ø 160'], [0.2, 'Ø 200'], [0.25, 'Ø 250']], def: 0.2 }],
    build(p) { const g = MK.discBrake({ d: +p.d }), u = g.userData; return { group: g, spin: u.spin, J: u.J, ext: ext(g), brake: true, props: [['Tarcza', `Ø ${Math.round(u.d * 1000)} × ${Math.round(u.t * 1000)} mm, wentylowana`], ['Moment hamowania', 'z suwaka „Hamulec”'], ['Masa', mass(g)]] }; },
  },
  {
    type: 'bearing', role: 'support', name: 'Łożysko w oprawie UCP',
    params: [{ key: 'h', label: 'Wysokość osi', type: 'range', min: 0.06, max: 0.3, step: 0.001, unit: 'mm', def: 0.09 }],
    build(p) { const g = MK.pillowBlock({ h: p.h }); return { group: g, spin: null, J: 0, axisY: p.h, ext: ext(g), props: [['Łożysko', 'UC205 (otwór 25 mm)'], ['Wysokość osi', `${Math.round(p.h * 1000)} mm`], ['Oprawa', 'żeliwna, stojąca']] }; },
  },
];
export const partDef = (type) => WS_PARTS.find((d) => d.type === type);
