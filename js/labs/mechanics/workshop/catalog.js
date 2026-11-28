// Warsztat — katalog części: napęd obrotowy, przesuw, prąd i płyn. auto: true — parametr ustawiany przez połączenie (zablokowany w połączonej części). Każda część budowana wzdłuż lokalnej osi +x z MechKit:
//   role: 'motor' (wał wyjściowy w +x, oś na wysokości axisY nad podstawą), 'shaft' (od x = 0 do len), 'hub' (piasta na wale:
//   koło zębate, łańcuchowe, pasowe, sprzęgło, tarcza hamulca — oś przez początek), 'support' (oprawa łożyska — oś na wysokości h).
//   build(p) → { group, spin, J, ext: [x0, x1] (zasięg wzdłuż osi), axisY (oś nad spodem), props: [[nazwa, wartość]] }
import * as THREE from '../../../../vendor/three/three.module.js';
import * as MK from '../../../models/mech/mechkit.js';
import * as CK from '../../../models/mech/controls.js';
import * as FK from '../../../models/mech/fluid/index.js';
import * as FL from '../../../behaviors/mech/fluid.js';
import { T } from '../lang.js';

// część przesuwna: model ruchu wzdłuż lokalnego y, góra +z (MechKit: listwa, suwak) → ruch wzdłuż +x, góra +y
const yUp = (g) => { const w = new THREE.Group(); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0))); w.add(g); g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g); g.position.y = -b.min.y; return w; };
const ext = (g) => { g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g); return [b.min.x, b.max.x]; };
const mass = (g) => `${(g.userData.mass || 0).toFixed(2)} kg`;
const J = (j) => `${(j * 1e4).toFixed(2)} kg·cm²`;

export const WS_PARTS = [
  {
    type: 'motor', role: 'motor', name: 'Silnik indukcyjny',
    params: [{ key: 'kW', label: 'Moc', type: 'select', options: [[0.37, '0,37 kW'], [0.75, '0,75 kW'], [1.1, '1,1 kW'], [2.2, '2,2 kW']], def: 1.1 },
      { key: 'riser', label: 'Podkładka pod łapy', type: 'range', auto: true, min: 0, max: 0.12, step: 0.002, unit: 'mm', def: 0 }],
    build(p) {
      const m = MK.motor({ kW: +p.kW }), g = new THREE.Group(), rz = +p.riser || 0; g.add(m); m.position.y = rz; g.userData = m.userData; g.name = m.name;
      if (rz > 0) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.4 * m.userData.spin.position.y / 0.09 + 0.04, rz, 0.24 * m.userData.spin.position.y / 0.09), MK.materials().iron); pl.position.set(-0.165 * m.userData.spin.position.y / 0.09, rz / 2, 0); pl.castShadow = pl.receiveShadow = true; g.add(pl); }   // płyta stalowa — podnosi oś silnika
      const sp = MK.MOTORS.find((q) => q.kW >= +p.kW) || MK.MOTORS[0], rated = 1500 * (1 - 0.034 - 0.02 / Math.sqrt(sp.kW));
      return { group: g, spin: m.userData.spin, J: m.userData.J || sp.J, axisY: sp.H + rz, shaftEnd: 0.05 * sp.H / 0.09, kW: sp.kW, rated, Trated: sp.kW * 1000 / (rated * Math.PI / 30),
        props: [['Moc znamionowa', `${String(sp.kW).replace('.', ',')} kW`], ['Obroty znamionowe', `${Math.round(rated)} obr/min`], ['Wysokość osi', `${Math.round((sp.H + rz) * 1000)} mm`], ['Bezwładność wirnika', J(sp.J)], ['Masa', `${sp.mass} kg`]] };
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
    params: [{ key: 'h', label: 'Wysokość osi', type: 'range', auto: true, min: 0.06, max: 0.3, step: 0.001, unit: 'mm', def: 0.09 }],
    build(p) { const g = MK.pillowBlock({ h: p.h }); return { group: g, spin: null, J: 0, axisY: p.h, ext: ext(g), props: [['Łożysko', 'UC205 (otwór 25 mm)'], ['Wysokość osi', `${Math.round(p.h * 1000)} mm`], ['Oprawa', 'żeliwna, stojąca']] }; },
  },
];
// ---------------- przesuw (etap 6, część 2) ----------------
WS_PARTS.push(
  {
    type: 'rack', role: 'lin', name: 'Listwa zębata na prowadnicy',
    params: [{ key: 'm', label: 'Moduł', type: 'select', options: [[0.0015, '1,5 mm'], [0.002, '2 mm'], [0.003, '3 mm']], def: 0.002 }, { key: 'n', label: 'Liczba zębów', type: 'range', min: 20, max: 80, step: 1, def: 40 }],
    build(p) {
      const m = +p.m, n = +p.n, L = n * Math.PI * m, sl = MK.slider({ len: 0.07, w: 0.04, h: 0.03, travel: Math.max(0.06, L * 0.55), rack: { m, n, w: 0.012 } }), u = sl.userData, g = yUp(sl);
      const c = sl.position.y;   // wysokość osi suwaka nad spodem
      return { group: g, spin: null, slide: u.slide, slideAxis: 'y', J: u.mass, dof: 'lin', travel: Math.max(0.06, L * 0.55) - 0.01, refLocal: new THREE.Vector3(0, c + u.rack.z, 0), rack: u.rack, m, n, len: L,
        props: [['Moduł', `${m * 1000} mm`], ['Liczba zębów', n], ['Długość listwy', `${Math.round(L * 1000)} mm`], ['Skok wózka', `± ${Math.round((Math.max(0.06, L * 0.55) - 0.01) * 500)} mm (krańcówki)`], ['Masa ruchoma', `${u.mass.toFixed(2)} kg`]] };
    },
  },
  {
    type: 'screw', role: 'shaft', name: 'Śruba kulowa Ø 20',
    params: [{ key: 'lead', label: 'Skok gwintu', type: 'select', options: [[0.005, '5 mm'], [0.01, '10 mm'], [0.02, '20 mm']], def: 0.01 }, { key: 'len', label: 'Długość', type: 'range', min: 0.2, max: 1, step: 0.01, unit: 'mm', def: 0.5 }],
    build(p) { const g = MK.leadScrew({ d: 0.02, lead: +p.lead, len: p.len, kind: 'ball' }), u = g.userData; return { group: g, spin: u.spin, J: u.J, ext: [0, p.len], len: p.len, screw: true, lead: +p.lead, props: [['Średnica', '20 mm'], ['Skok', `${+p.lead * 1000} mm`], ['Długość', `${Math.round(p.len * 1000)} mm`], ['Sprawność', '≈ 90 % (kulowa)'], ['Masa', `${u.mass.toFixed(2)} kg`]] }; },
  },
  {
    type: 'nut', role: 'lin', name: 'Nakrętka kulowa z wózkiem',
    params: [{ key: 'lead', label: 'Skok gwintu', type: 'select', options: [[0.005, '5 mm'], [0.01, '10 mm'], [0.02, '20 mm']], def: 0.01 }, { key: 'travel', label: 'Skok wózka', type: 'range', min: 0.06, max: 0.6, step: 0.01, unit: 'mm', def: 0.2 }, { key: 'hc', label: 'Wysokość osi', type: 'range', auto: true, min: 0.04, max: 0.3, step: 0.001, unit: 'mm', def: 0.08 }],
    build(p) { const g = MK.screwNut({ d: 0.02, lead: +p.lead, kind: 'ball', hc: p.hc, travel: p.travel }), u = g.userData, w = new THREE.Group(); g.position.y = p.hc; w.add(g);
      return { group: w, spin: null, slide: u.slide, slideAxis: 'x', J: u.mass, dof: 'lin', travel: p.travel - 0.01, refLocal: new THREE.Vector3(0, p.hc, 0), lead: +p.lead, axisY: p.hc,
        props: [['Skok gwintu', `${+p.lead * 1000} mm`], ['Skok wózka', `± ${Math.round((p.travel - 0.01) * 500)} mm (krańcówki)`], ['Wysokość osi', `${Math.round(p.hc * 1000)} mm`], ['Masa ruchoma', `${u.mass.toFixed(2)} kg`]] }; },
  },
  {
    type: 'crank', role: 'hub', name: 'Tarcza korbowa ze sworzniem',
    params: [{ key: 'r', label: 'Promień korby', type: 'range', min: 0.015, max: 0.08, step: 0.001, unit: 'mm', def: 0.04 }, { key: 'l', label: 'Długość korbowodu', type: 'range', min: 0.1, max: 0.35, step: 0.005, unit: 'mm', def: 0.18 }],
    build(p) {
      const M = MK.materials(), g = new THREE.Group(), spin = new THREE.Group(); g.add(spin); g.name = T('Tarcza korbowa', 'Crank disc');
      const R = p.r + 0.02, disc = new THREE.Mesh(MK.cyl(R, 0.012, 48), M.iron), hub = new THREE.Mesh(MK.cyl(0.024, 0.03, 32), M.dark), pin = new THREE.Mesh(MK.cyl(0.006, 0.022, 20), M.steel);
      hub.position.x = -0.015; pin.position.set(0.006 + 0.011, p.r, 0); [disc, hub, pin].forEach((o) => { o.castShadow = o.receiveShadow = true; spin.add(o); });
      const mass = 7850 * Math.PI * R * R * 0.012, J = 0.5 * mass * R * R;
      g.userData = { spin, mass, J };
      return { group: g, spin, J, ext: [-0.03, 0.028], crank: true, r: p.r, l: p.l, pinX: 0.017, R, props: [['Promień korby', `${Math.round(p.r * 1000)} mm (skok suwaka ${Math.round(p.r * 2000)} mm)`], ['Korbowód', `${Math.round(p.l * 1000)} mm`], ['Masa', `${mass.toFixed(2)} kg`]] };
    },
  },
  {
    type: 'slider', role: 'lin', name: 'Suwak w prowadnicy (do korbowodu)',
    params: [{ key: 'travel', label: 'Skok prowadnicy', type: 'range', min: 0.06, max: 0.3, step: 0.01, unit: 'mm', def: 0.12 }, { key: 'ped', label: 'Wysokość osi suwaka', type: 'range', auto: true, min: 0.035, max: 0.3, step: 0.001, unit: 'mm', def: 0.08 }],
    build(p) {
      const sl = MK.slider({ len: 0.07, w: 0.04, h: 0.03, travel: p.travel }), u = sl.userData, g = yUp(sl), c0 = sl.position.y, ped = Math.max(c0, p.ped);
      sl.position.y = ped;   // wspornik pod prowadnicą: oś suwaka na wysokości osi korby
      if (ped - c0 > 0.002) { const b = new THREE.Mesh(new THREE.BoxGeometry(p.travel + 0.09, ped - c0, 0.06), MK.materials().iron); b.position.y = (ped - c0) / 2; b.castShadow = b.receiveShadow = true; g.add(b); }
      return { group: g, spin: null, slide: u.slide, slideAxis: 'y', J: u.mass, dof: 'lin', travel: p.travel - 0.01, refLocal: new THREE.Vector3(0, ped, 0), pinLat: -(0.04 / 2 + 0.008), axisY: ped,
        props: [['Skok prowadnicy', `${Math.round(p.travel * 1000)} mm`], ['Wysokość osi', `${Math.round(ped * 1000)} mm`], ['Masa ruchoma', `${u.mass.toFixed(2)} kg`]] };
    },
  },
);
export const partDef = (type) => WS_PARTS.find((d) => d.type === type);
// ---------------- prąd (etap 6, część 3) — urządzenia ControlKit; el: 'src' zasilanie, 'btn' przycisk, 'k' stycznik, 'vfd' falownik ----------------
// kaseta przycisku stoi na blacie frontem w +z (jak w Fizyce)
const BTN = { start: ['green', 'NO', 'START (zielony, NO)'], stop: ['red', 'NC', 'STOP (czerwony, NC)'], estop: ['', 'NC', 'Grzybek awaryjny (NC, z zatrzaskiem)'] };
WS_PARTS.push(
  {
    type: 'source', role: 'elec', el: 'src', name: 'Zasilanie 3 × 400 V z wyłącznikiem',
    params: [{ key: 'amps', label: 'Zabezpieczenie', type: 'select', options: [[16, '16 A'], [25, '25 A'], [32, '32 A']], def: 16 }],
    build(p) { const g = CK.powerSource({ kind: 'AC', volts: 400, phases: 3, amps: +p.amps }); return { group: g, api: g.userData.api, el: 'src', J: 0, props: [['Napięcie', '3 × 400 / 230 V, 50 Hz (TN-S)'], ['Zabezpieczenie', `${+p.amps} A`], ['Wyłącznik', 'kołyskowy na panelu (kliknij)'], ['Masa', '2,5 kg']] }; },
  },
  {
    type: 'button', role: 'elec', el: 'btn', name: 'Przycisk w kasecie',
    params: [{ key: 'kind', label: 'Rodzaj', type: 'select', options: Object.entries(BTN).map(([k, v]) => [k, v[2]]), def: 'start' }],
    build(p) {
      const [color, contact, label] = BTN[p.kind] || BTN.start, g = p.kind === 'estop' ? CK.eStop() : CK.pushButton({ color, contact });
      return { group: g, api: g.userData.api, el: 'btn', kind: p.kind, contact, ctrl: p.kind === 'estop' ? 'estop' : 'button', J: 0, props: [['Rodzaj', label], ['Styk', contact === 'NO' ? 'zwierny 13-14' : 'rozwierny 11-12'], ['Obciążalność styku', '6 A / 230 V AC-15'], ['Obudowa', 'IP65, 1 otwór 22 mm']] };
    },
  },
  {
    type: 'contactor', role: 'elec', el: 'k', name: 'Stycznik na płycie montażowej',
    params: [{ key: 'amps', label: 'Prąd AC-3', type: 'select', options: [[12, '12 A'], [25, '25 A']], def: 12 }, { key: 'hold', label: 'Podtrzymanie (13-14 równolegle do START)', type: 'select', options: [[1, T('tak', 'yes')], [0, T('nie', 'no')]], def: 1 }],
    build(p) {
      const M = MK.materials(), g = new THREE.Group(), k = CK.contactor({ amps: +p.amps, coil: '230AC', aux: '1NO' }); k.position.set(0, 0.025, 0.012); g.add(k);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.006), M.steel); plate.position.set(0, 0.065, 0.006); const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.006, 0.08), M.steel); foot.position.set(0, 0.003, 0.04);
      [plate, foot].forEach((o) => { o.castShadow = o.receiveShadow = true; g.add(o); });
      g.userData = { ...k.userData };
      const e = k.userData.elec;
      return { group: g, api: k.userData.api, el: 'k', hold: !!+p.hold, elec: e, J: 0, props: [['Styki główne', `3 × NO, ${+p.amps} A (AC-3)`], ['Cewka', '230 V AC — zadziała od 85 % Un, odpada poniżej 60 %'], ['Styk pomocniczy', +p.hold ? '13-14 NO — podtrzymanie' : '13-14 NO (niepodłączony)'], ['Masa', `${(+p.amps > 18 ? 0.55 : 0.36) + 0.9} kg (z płytą)`]] };
    },
  },
  {
    type: 'inverter', role: 'elec', el: 'vfd', name: 'Falownik 3 × 400 V',
    params: [{ key: 'kW', label: 'Moc', type: 'select', options: [[0.37, '0,37 kW'], [0.75, '0,75 kW'], [1.1, '1,1 kW'], [2.2, '2,2 kW']], def: 1.1 }, { key: 'ramp', label: 'Rampa 0–50 Hz', type: 'range', min: 0.5, max: 10, step: 0.5, unit: 's', def: 3 }],
    build(p) {
      const g = CK.inverter({ kW: +p.kW, fmax: 50, ramp: +p.ramp }), api = g.userData.api; api.reference('ai');   // zadawanie z suwaka „Falownik” (wejście analogowe)
      return { group: g, api, el: 'vfd', kW: +p.kW, elec: g.userData.elec, J: 0, props: [['Moc', `${String(+p.kW).replace('.', ',')} kW`], ['Wejście', '3 × 400 V'], ['Wyjście', '0–50 Hz, U/f'], ['Rampa', `${String(+p.ramp).replace('.', ',')} s (0–50 Hz)`], ['Sprawność', '97 %']] };
    },
  },
);
// ---------------- płyn (etap 6, część 4) — FluidKit; fl: 'tank' zbiornik, 'pump' pompa blokowa, 'valve' zawór, 'nozzle' dysza
// na wysięgniku, 'bucket' wiadro. ports: { nazwa: { p, n } } — punkt przyłącza węża i normalna na zewnątrz (układ części) ----------------
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const fitting = (M, x, y) => { const g = new THREE.Group(); const hx = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 6).rotateZ(Math.PI / 2), M); hx.position.x = x - 0.005; const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 20).rotateZ(Math.PI / 2), M); nk.position.x = x - 0.016; [hx, nk].forEach((o) => { o.position.y = y; o.castShadow = true; g.add(o); }); return g; };
WS_PARTS.push(
  {
    type: 'tank', role: 'fluid', fl: 'tank', name: 'Zbiornik wody z wylotem',
    params: [{ key: 'fill', label: 'Napełnienie na start', type: 'range', min: 0.1, max: 0.9, step: 0.05, unit: '%', def: 0.6 }],
    build(p) {
      const g = new THREE.Group(), t = FK.waterTank({}), u = t.userData; g.add(t); const F = FK.fluidMaterials();
      const x = u.L / 2 + 0.012, y = 0.03; g.add(fitting(F.brass, x, y));   // króciec przez ściankę przy dnie
      const A = u.inner[0] * u.inner[1], Hin = u.H - 0.006;
      return { group: g, el: null, fl: 'tank', J: 0, model: u, A, Hin, y0: 0.006, fill: +p.fill, ports: { out: { p: V3(x, y, 0), n: V3(1, 0, 0) } },
        props: [['Pojemność', `${Math.round(A * Hin * 1000)} l`], ['Wylot', 'króciec G 1/2 przy dnie (oś 30 mm)'], ['Materiał', 'akryl 6 mm, rama aluminiowa']] };
    },
  },
  {
    type: 'pump', role: 'fluid', fl: 'pump', name: 'Pompa odśrodkowa blokowa',
    params: [{ key: 'D2', label: 'Średnica wirnika', type: 'select', options: [[0.04, 'Ø 40 mm'], [0.05, 'Ø 50 mm'], [0.06, 'Ø 60 mm']], def: 0.06 }],
    build(p) {
      const g = FK.centrifugalPump({ D2: +p.D2, kW: 0.18 }), u = g.userData, c = FL.centrifugal({ D2: +p.D2, n0: 2850 });
      return { group: g, el: 'pump', fl: 'pump', J: 0, curve: c, setAngle: u.setAngle, portAt: u.portAt, ports: { in: { p: u.portAt.in.clone(), n: V3(1, 0, 0) }, out: { p: u.portAt.out.clone(), n: V3(0, 1, 0) } },
        props: [['Silnik', '0,18 kW, 2 bieguny (2850 obr/min przy 50 Hz)'], ['Wirnik', `Ø ${Math.round(+p.D2 * 1000)} mm, zamknięty, mosiężny`], ['Wysokość przy zamkniętym zaworze', `${c.H0.toFixed(1).replace('.', T(',', '.'))} m`], ['Punkt najlepszej sprawności', `${(c.Qb * 60000).toFixed(1).replace('.', T(',', '.'))} l/min, ${c.Hb.toFixed(1).replace('.', T(',', '.'))} m`], ['Zasysanie', 'nie samozasysająca — napływ ze zbiornika powyżej osi']] };
    },
  },
  {
    type: 'valve', role: 'fluid', fl: 'valve', name: 'Zawór kulowy DN 15 na podstawce',
    params: [{ key: 'open', label: 'Otwarcie', type: 'range', min: 0, max: 1, step: 0.05, unit: '%', def: 1 }],
    build(p) {
      const g = new THREE.Group(), v = FK.ballValve({ dn: 15 }), u = v.userData, hv = 0.06, F = FK.fluidMaterials(); v.position.y = hv; g.add(v);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, hv - u.d * 0.9, 0.03), F.alu); st.position.y = (hv - u.d * 0.9) / 2; st.castShadow = st.receiveShadow = true; g.add(st);
      const set = (o) => u.setAngle((1 - o) * Math.PI / 2); set(+p.open);
      return { group: g, el: null, fl: 'valve', J: 0, d: u.d, set, ports: { a: { p: V3(-u.L / 2, hv, 0), n: V3(-1, 0, 0) }, b: { p: V3(u.L / 2, hv, 0), n: V3(1, 0, 0) } },
        props: [['Przelot', 'DN 15 (pełny, kula Ø 15)'], ['Otwarcie', `${Math.round(+p.open * 100)} % (dźwignia ${Math.round((1 - +p.open) * 90)}°)`], ['Sterowanie', 'dźwignia — kliknij, gdy podłączony']] };
    },
  },
  {
    type: 'nozzle', role: 'fluid', fl: 'nozzle', name: 'Dysza na wysięgniku',
    params: [{ key: 'd', label: 'Średnica dyszy', type: 'select', options: [[0.004, 'Ø 4 mm'], [0.006, 'Ø 6 mm'], [0.008, 'Ø 8 mm'], [0.01, 'Ø 10 mm']], def: 0.006 }, { key: 'h', label: 'Wysokość dyszy', type: 'range', min: 0.3, max: 0.5, step: 0.01, unit: 'mm', def: 0.34 }],
    build(p) {
      const F = FK.fluidMaterials(), g = new THREE.Group(), h = p.h, arm = 0.16, n = FK.nozzle({ d: +p.d });
      n.rotation.x = Math.PI; n.position.set(arm, h, 0); g.add(n);   // wlot u góry, wylot w dół
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.008, 0.08), F.alu); base.position.y = 0.004;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.02, h - 0.004, 0.02), F.alu); post.position.y = 0.008 + (h - 0.012) / 2;
      const boom = new THREE.Mesh(new THREE.BoxGeometry(arm - 0.012, 0.012, 0.012), F.alu); boom.position.set((arm - 0.012) / 2, h - 0.017, 0);
      const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 24, 1, true), F.alu); clamp.position.set(arm, h - 0.017, 0); clamp.material = F.alu;
      [base, post, boom, clamp].forEach((o) => { o.castShadow = o.receiveShadow = true; g.add(o); });
      return { group: g, el: null, fl: 'nozzle', J: 0, d: +p.d, tip: V3(arm, h - 0.0441, 0), ports: { in: { p: V3(arm, h, 0), n: V3(0, 1, 0) } },
        props: [['Dysza', `Ø ${+p.d * 1000} mm, mosiężna (Cd 0,9)`], ['Wysokość wylotu', `${Math.round((h - 0.044) * 1000)} mm nad blatem`], ['Wysięgnik', '160 mm']] };
    },
  },
  {
    type: 'bucket', role: 'fluid', fl: 'bucket', name: 'Wiadro ocynkowane',
    params: [],
    build() { const g = FK.bucket({ V: 0.01, handleUp: false }), u = g.userData; return { group: g, el: null, fl: 'bucket', J: 0, model: u, ports: {}, props: [['Pojemność', `${(u.Vfull * 1000).toFixed(1).replace('.', T(',', '.'))} l do rantu`], ['Materiał', 'blacha ocynkowana']] }; },
  },
);
