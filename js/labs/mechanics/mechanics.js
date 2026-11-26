// Laboratorium mechaniki — kategoria 1: transmisja ruchu. Tryb „Przedmioty”: każdy przedmiot osobno na stole, z ustawieniami
// (katalog js/labs/mechanics/items.js) — dane, porty i podgląd ruchu. Tryb „Maszyna”: jedna maszyna na żeliwnym łożu z elementów MechKit
// (js/models/mech/mechkit.js) połączonych portami w napędzie (js/behaviors/mech/drive.js):
//   silnik → sprzęgło kłowe → wał → para zębatek 20 : 40 → przekładnia dwustopniowa (16 : 48, 24 : 40) w obudowie z akrylu
//   → łańcuch 18 : 27 → pas klinowy Ø 160 : Ø 80 → sprzęgło kołnierzowe → wał przegubowy (dwa przeguby Cardana, 25°)
//   → przekładnia planetarna (24 / 24 / 72, korona stała) → tarcza hamulca i tarcza z podziałką.
// Kliknięcie elementu — jego właściwości, porty i to, co przez nie płynie. Dla AI: MechanicsApi.
import * as THREE from '../../../vendor/three/three.module.js';
import { createStage, WEATHER } from '../../core/stage.js';
import * as MK from '../../models/mech/mechkit.js';
import { createDrive, KIND_NAME } from '../../behaviors/mech/drive.js';
import { createPhysics } from '../../behaviors/mech/physics.js';
import * as CK from '../../models/mech/controls.js';
import { ITEMS } from './items.js';
import { loadState, valid } from '../shared/saved.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach((k) => e.append(k)); return e; };
const KEY = 'tornado.mechanics.v1';
const S = loadState(KEY, { mode: 'items', item: 'gear', items: {}, spin: 20, rpm: 600, brake: 20, alpha: 0.25, hit: false, weather: 'fair', sunEl: 40, sunAz: 205 },
  { mode: ['items', 'machine', 'physics'], item: ITEMS.map((i) => i.id), items: (v) => !Array.isArray(v), spin: (v) => v >= 0 && v <= 120, rpm: (v) => v >= 0 && v <= 1500, brake: (v) => v >= 0 && v <= 300, alpha: (v) => v >= 0 && v <= 1, weather: Object.keys(WEATHER) });
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* prywatny tryb */ } };
const TAU = Math.PI * 2, X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

const stage = createStage($('view'), { shadow: 4096 });
const { scene, camera, renderer } = stage;
const M = MK.materials();
const root = new THREE.Group(); scene.add(root);

/* ---------------- hala: posadzka, łoże, światła ---------------- */
const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2), M.concrete); floor.receiveShadow = true;
{ const uv = floor.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 16, uv.getY(i) * 16); }
scene.add(floor);
const BED_TOP = 0.75, Y0 = 0.87, BX0 = -6.6, BX1 = 3.8, BZ0 = -0.35, BZ1 = 0.75;
{
  const bg = new THREE.BoxGeometry(BX1 - BX0, 0.08, BZ1 - BZ0), buv = bg.attributes.uv; for (let i = 0; i < buv.count; i++) buv.setXY(i, buv.getX(i) * (BX1 - BX0) / 1.2, buv.getY(i) * (BZ1 - BZ0) / 1.2);
  const bed = new THREE.Mesh(bg, M.bed); bed.position.set((BX0 + BX1) / 2, BED_TOP - 0.04, (BZ0 + BZ1) / 2); bed.castShadow = bed.receiveShadow = true; root.add(bed);
  for (let x = BX0 + 0.25; x < BX1; x += 1.3) for (const z of [BZ0 + 0.08, BZ1 - 0.08]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, BED_TOP - 0.08, 0.1), M.iron); leg.position.set(x, (BED_TOP - 0.08) / 2, z); leg.castShadow = leg.receiveShadow = true; root.add(leg); }
  for (const z of [BZ0 + 0.2, BZ1 - 0.2]) { const slot = new THREE.Mesh(new THREE.BoxGeometry(BX1 - BX0 - 0.1, 0.002, 0.018), M.black); slot.position.set((BX0 + BX1) / 2, BED_TOP + 0.0005, z); root.add(slot); }   // rowki teowe
}
for (const [x, z] of [[-5, 1.6], [-1.5, 1.8], [2, 1.6]]) {   // lampy warsztatowe nad stanowiskami
  const L = new THREE.SpotLight(0xffe2b8, 18, 9, 0.75, 0.6, 1.6); L.position.set(x, 3.4, z); L.target.position.set(x, Y0, 0.15); root.add(L, L.target);
}

/* ---------------- napęd i elementy ---------------- */
const drive = createDrive();
const parts = [];   // { el, group } — do wybierania kliknięciem
const panes = [];   // szyby obudów (przezroczystość)
function element(id, name, type, group, { J = group.userData.J || 0, props = [], ports, frame, onAngle } = {}) {
  const e = drive.add({ id, name, type, J, props, ports, spin: group.userData.spin, frame: frame || { o: group.position.clone(), axis: X.clone(), ref: Y.clone() }, onAngle, group });
  group.userData.el = e; parts.push(e);
  return e;
}
const P = (id, name, kind = 'obrót') => ({ id, name, kind });
const mass = (g) => `${(g.userData.mass || 0).toFixed(2)} kg`;
const Jtxt = (J) => `${(J * 1e4).toFixed(2)} kg·cm²`;
function at(g, x, y, z) { g.position.set(x, y, z); root.add(g); return g; }
function shaftEl(id, x0, x1, y, z, name) {
  const g = at(MK.shaft({ len: x1 - x0, r: 0.0125, name }), x0, y, z);
  return element(id, name, 'shaft', g, { props: [['Średnica', '25 mm'], ['Długość', `${Math.round((x1 - x0) * 1000)} mm`], ['Stal', 'C45, szlifowana'], ['Masa', mass(g)], ['Bezwładność', Jtxt(g.userData.J)]], ports: [P('a', 'Koniec A'), P('b', 'Koniec B')] });
}
const block = (x, y, z, h = y - BED_TOP) => at(MK.pillowBlock({ h }), x, BED_TOP, z);
function gearEl(id, x, y, z, opts, name) {
  const g = at(MK.gear({ ...opts, name }), x, y, z), u = g.userData;
  return element(id, name, 'gear', g, { props: [['Liczba zębów', u.z], ['Moduł', `${u.m * 1000} mm`], ['Średnica podziałowa', `${(u.rp * 2000).toFixed(1)} mm`], ['Szerokość', `${u.w * 1000} mm`], ['Zarys', 'ewolwentowy, α = 20°'], ['Materiał', opts.mat === 'brass' ? 'mosiądz CuZn39Pb3' : 'stal 42CrMo4 ulepszona'], ['Masa', mass(g)], ['Bezwładność', Jtxt(u.J)]], ports: [P('bore', 'Otwór z wpustem (wał)'), P('mesh', 'Zazębienie')] });
}

// 1. silnik, sprzęgło kłowe, wał S1, para zębatek
const motorG = at(MK.motor(), -6.0, BED_TOP + 0.03, 0);
{ const riser = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.22), M.iron); riser.position.set(-6.16, BED_TOP + 0.015, 0); riser.castShadow = riser.receiveShadow = true; root.add(riser); }
const eMotor = element('motor', 'Silnik indukcyjny 1,1 kW', 'motor', motorG, { J: motorG.userData.J, frame: { o: new THREE.Vector3(-6.0, Y0, 0), axis: X.clone(), ref: Y.clone() },
  props: [['Moc znamionowa', '1,1 kW'], ['Obroty znamionowe', '1450 obr/min (4 bieguny, 50 Hz)'], ['Moment krytyczny', '18 N·m'], ['Zasilanie', 'falownik — prędkość z suwaka'], ['Masa', '15,5 kg'], ['Bezwładność wirnika', Jtxt(motorG.userData.J)]], ports: [P('out', 'Wał wyjściowy Ø 24')] });
const jaw = MK.jawCoupling(); const jawG = new THREE.Group(); jawG.userData.spin = new THREE.Group(); jawG.add(jawG.userData.spin);
jawG.userData.spin.add(jaw.a, jaw.spider, jaw.b); at(jawG, -5.92, Y0, 0); jawG.name = 'Sprzęgło kłowe';
const eJaw = element('jaw', 'Sprzęgło kłowe z gwiazdą', 'coupling', jawG, { J: jaw.J, props: [['Rodzaj', 'kłowe, podatne'], ['Gwiazda', 'poliuretan 92 Sh A (czerwona)'], ['Piasty', 'aluminium'], ['Kompensuje', 'niewspółosiowość do 0,2 mm, 1°'], ['Masa', `${jaw.mass} kg`]], ports: [P('a', 'Piasta A'), P('b', 'Piasta B')] });
const eS1 = shaftEl('s1', -5.885, -4.95, Y0, 0, 'Wał 1');
block(-5.72, Y0, 0); block(-5.18, Y0, 0);
const eG1 = gearEl('g1', -5.0, Y0, 0, { z: 20, m: 0.004, w: 0.04, mat: 'gear' }, 'Zębatka 1 (z = 20)');
const eG2 = gearEl('g2', -5.0, Y0, 0.12, { z: 40, m: 0.004, w: 0.04, mat: 'brass' }, 'Zębatka 2 (z = 40)');
const eS2 = shaftEl('s2', -5.08, -4.24, Y0, 0.12, 'Wał 2');
block(-4.86, Y0, 0.12); block(-4.62, Y0, 0.12);

// 2. przekładnia dwustopniowa współosiowa w obudowie z akrylu
const YS3 = Y0 + 0.096;
const eG3 = gearEl('g3', -4.3, Y0, 0.12, { z: 16, m: 0.003, w: 0.03, mat: 'gear' }, 'Zębatka 3 (z = 16)');
const eG4 = gearEl('g4', -4.3, YS3, 0.12, { z: 48, m: 0.003, w: 0.03, mat: 'brass' }, 'Zębatka 4 (z = 48)');
const eS3 = shaftEl('s3', -4.385, -3.815, YS3, 0.12, 'Wał pośredni');
const eG5 = gearEl('g5', -3.95, YS3, 0.12, { z: 24, m: 0.003, w: 0.03, mat: 'gear' }, 'Zębatka 5 (z = 24)');
const eG6 = gearEl('g6', -3.95, Y0, 0.12, { z: 40, m: 0.003, w: 0.03, mat: 'brass' }, 'Zębatka 6 (z = 40)');
const eS4 = shaftEl('s4', -4.06, -2.42, Y0, 0.12, 'Wał 4');
{
  const hs = MK.housing([0.6, 0.34, 0.22]); hs.position.set(-4.1, 0.935, 0.12); root.add(hs); panes.push(hs.userData.panes);
  for (const [x, y] of [[-4.4, Y0], [-4.4, YS3], [-3.8, YS3], [-3.8, Y0]]) { const b = new THREE.Mesh(MK.cyl(0.024, 0.016, 32), M.steel); b.position.set(x, y, 0.12); b.castShadow = true; root.add(b); }   // łożyska w ściankach
  for (const x of [-4.36, -3.84]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.26), M.alu); f.position.set(x, BED_TOP + 0.006, 0.12); f.castShadow = f.receiveShadow = true; root.add(f); }
}
block(-3.55, Y0, 0.12); block(-2.75, Y0, 0.12);

// 3. łańcuch rolkowy 08A: koła 18 i 27 zębów, odległość osi dobrana do parzystej liczby ogniw
const CH = MK.chainDistance(18, 27, 0.0127, 0.4), XC = -2.6, YS5 = Y0 + CH.D;
const sp1 = at(MK.sprocket({ z: 18, name: 'Koło łańcuchowe 1 (z = 18)' }), XC, Y0, 0.12), sp2 = at(MK.sprocket({ z: 27, name: 'Koło łańcuchowe 2 (z = 27)' }), XC, YS5, 0.12);
const chainPath = MK.loopPath({ y: Y0, z: 0.12, r: CH.R1, k: 18 / TAU }, { y: YS5, z: 0.12, r: CH.R2, k: 27 / TAU }, 0.0127);
// gniazda kół pod rolkami: obrót części wirującej koła o fazę drogi (koło 1: początek łuku, koło 2: początek łuku − podziałki przed nim)
sp1.userData.spin.children.forEach((c) => { c.rotation.x = chainPath.a1; });
sp2.userData.spin.children.forEach((c) => { c.rotation.x = chainPath.a2 - chainPath.U2 * TAU / 27; });
const chain = MK.chainLoop(chainPath, CH.N, { x: XC }); root.add(chain);
const spProps = (g) => [['Liczba zębów', g.userData.z], ['Podziałka', '12,7 mm (08A / ANSI 40)'], ['Średnica podziałowa', `${(g.userData.R * 2000).toFixed(1)} mm`], ['Materiał', 'stal C45, czerniona'], ['Masa', mass(g)]];
const eC1 = element('c1', 'Koło łańcuchowe 1 (z = 18)', 'sprocket', sp1, { props: spProps(sp1), ports: [P('bore', 'Otwór (wał)'), P('chain', 'Łańcuch')] });
const eC2 = element('c2', 'Koło łańcuchowe 2 (z = 27)', 'sprocket', sp2, { props: spProps(sp2), ports: [P('bore', 'Otwór (wał)'), P('chain', 'Łańcuch')] });
const eS5 = shaftEl('s5', -2.7, -0.86, YS5, 0.12, 'Wał 5 (górny)');
block(-2.45, YS5, 0.12); block(-1.12, YS5, 0.12);

// 4. pas klinowy SPA: koła Ø 160 i Ø 80
const XB = -0.95;
const pu1 = at(MK.pulley({ d: 0.16, name: 'Koło pasowe 1 (Ø 160)' }), XB, YS5, 0.12), pu2 = at(MK.pulley({ d: 0.08, name: 'Koło pasowe 2 (Ø 80)' }), XB, Y0, 0.12);
const beltPath = MK.loopPath({ y: YS5, z: 0.12, r: 0.08, k: 0.08 }, { y: Y0, z: 0.12, r: 0.04, k: 0.04 }, 1);
const belt = MK.beltLoop(beltPath, { x: XB, label: `SPA ${Math.round(beltPath.L * 1000)} Lw` }); root.add(belt);
const puProps = (g) => [['Średnica skuteczna', `${Math.round(g.userData.d * 1000)} mm`], ['Rowek', 'klinowy SPA, 36°'], ['Materiał', 'żeliwo szare EN-GJL-250'], ['Masa', mass(g)], ['Bezwładność', Jtxt(g.userData.J)]];
const ePu1 = element('pu1', 'Koło pasowe 1 (Ø 160)', 'pulley', pu1, { props: puProps(pu1), ports: [P('bore', 'Otwór (wał)'), P('belt', 'Pas')] });
const ePu2 = element('pu2', 'Koło pasowe 2 (Ø 80)', 'pulley', pu2, { props: puProps(pu2), ports: [P('bore', 'Otwór (wał)'), P('belt', 'Pas')] });
const eS6 = shaftEl('s6', -1.08, -0.008, Y0, 0.12, 'Wał 6');
block(-0.78, Y0, 0.12); block(-0.28, Y0, 0.12);

// 5. sprzęgło kołnierzowe, wał przegubowy z dwoma przegubami Cardana (układ Z: wały 7 i 9 równoległe)
const fl = MK.flangeCoupling(); const flG = new THREE.Group(); flG.userData.spin = new THREE.Group(); flG.add(flG.userData.spin);
flG.userData.spin.add(fl.a, fl.b, fl.bolts); at(flG, 0.03, Y0, 0.12); flG.name = 'Sprzęgło kołnierzowe';
const eFl = element('fl', 'Sprzęgło kołnierzowe', 'coupling', flG, { J: fl.J, props: [['Rodzaj', 'sztywne, kołnierzowe'], ['Śruby', '6 × M8, klasa 8.8'], ['Materiał', 'żeliwo'], ['Masa', `${fl.mass} kg`]], ports: [P('a', 'Kołnierz A'), P('b', 'Kołnierz B')] });
const eS7 = shaftEl('s7', 0.068, 1.05, Y0, 0.12, 'Wał 7');
block(0.3, Y0, 0.12); block(0.82, Y0, 0.12);
const BETA = 25 * Math.PI / 180, J1 = new THREE.Vector3(1.1, Y0, 0.12), DIR = new THREE.Vector3(Math.cos(BETA), 0, Math.sin(BETA)), LJ = 0.6, J2 = J1.clone().addScaledVector(DIR, LJ);
const Q8 = new THREE.Quaternion().setFromUnitVectors(X, DIR);
// widełki wału 7 (sworznie wzdłuż y przy kącie 0)
{ const y = MK.yoke(); y.position.x = J1.x - 0.068; eS7.spin.add(y); }
// wał pośredni: od J1 do J2, widełki na obu końcach w jednej płaszczyźnie (sworznie wzdłuż lokalnego z)
const s8 = MK.shaft({ len: LJ - 0.1, r: 0.015, name: 'Wał przegubowy' }); s8.userData.spin.children.forEach((c) => { c.position.x += 0.05; });
s8.position.copy(J1); s8.quaternion.copy(Q8); root.add(s8);
{ const a = MK.yoke(); a.rotation.set(Math.PI / 2, Math.PI, 0); s8.userData.spin.add(a); const b = MK.yoke(); b.rotation.x = Math.PI / 2; b.position.x = LJ; s8.userData.spin.add(b); }
const eS8 = element('s8', 'Wał przegubowy', 'shaft', s8, { J: s8.userData.J + 0.0004, frame: { o: J1.clone(), axis: DIR.clone(), ref: Y.clone() },
  props: [['Średnica', '30 mm'], ['Długość między przegubami', `${LJ * 1000} mm`], ['Kąt łamania', '25°'], ['Układ', 'Z — widełki w jednej płaszczyźnie, wały 7 i 9 równoległe'], ['Uwaga', 'kręci się nierównomiernie (przegub Cardana); wał 9 — równo']], ports: [P('a', 'Przegub 1'), P('b', 'Przegub 2')] });
const eS9 = shaftEl('s9', J2.x, 2.372, Y0, J2.z, 'Wał 9');
{ const y = MK.yoke(); y.rotation.y = Math.PI; eS9.spin.add(y); }
block(1.85, Y0, J2.z); block(2.12, Y0, J2.z);
const cross1 = MK.cross(), cross2 = MK.cross(); cross1.position.copy(J1); cross2.position.copy(J2); root.add(cross1, cross2);

// 6. przekładnia planetarna: słoneczne 24 z, 3 satelity 24 z, korona 72 z (stała), jarzmo na wyjściu — i = 1 + 72/24 = 4
const XP = 2.36, ZP = J2.z, ZS = 24, ZPL = 24, ZR = 72, MP = 0.002;
const eSun = gearEl('sun', XP, Y0, ZP, { z: ZS, m: MP, w: 0.022, mat: 'gear', hub: false, bore: 0.0125 }, 'Koło słoneczne (z = 24)');
const ring = MK.ringGear({ z: ZR, m: MP, w: 0.02 }); ring.position.set(XP, Y0, ZP); root.add(ring);
const carrier = new THREE.Group(); carrier.userData.spin = new THREE.Group(); carrier.add(carrier.userData.spin); carrier.position.set(XP, Y0, ZP); root.add(carrier);
const RC = MP * (ZS + ZPL) / 2, planets = [];
{
  const plate = new THREE.Shape(); plate.absarc(0, 0, RC + 0.016, 0, TAU, false);
  for (let k = 0; k < 3; k++) {
    const pl = MK.gear({ z: ZPL, m: MP, w: 0.018, mat: 'brass', hub: false, bore: 0.004, name: 'Satelita' }); pl.position.set(0, RC * Math.cos(k * TAU / 3), RC * Math.sin(k * TAU / 3));
    carrier.userData.spin.add(pl); planets.push(pl);
    const pin = new THREE.Mesh(MK.cyl(0.004, 0.06, 12), M.steel); pin.position.copy(pl.position); pin.position.x = 0.014; carrier.userData.spin.add(pin);
  }
  for (const x of [0.03, 0.045]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(RC + 0.016, RC + 0.016, 0.006, 48).rotateZ(Math.PI / 2), M.alu); d.position.x = x; d.castShadow = true; carrier.userData.spin.add(d); }
  const ths = MK.tubeHousing({ r: ring.userData.R + 0.012, len: 0.07 }); ths.position.set(XP + 0.012, Y0, ZP); root.add(ths); panes.push(ths.userData.panes);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.05, Y0 - BED_TOP - ring.userData.R, 0.16), M.alu); stand.position.set(XP, BED_TOP + (Y0 - BED_TOP - ring.userData.R) / 2, ZP); stand.castShadow = true; root.add(stand);
}
const eCar = element('car', 'Przekładnia planetarna (jarzmo)', 'planetary', carrier, { J: 0.0012,
  props: [['Koło słoneczne', `${ZS} zęby`], ['Satelity', `3 × ${ZPL} zęby`], ['Koło koronowe', `${ZR} zęby, nieruchome`], ['Moduł', '2 mm'], ['Przełożenie', `i = 1 + ${ZR}/${ZS} = ${1 + ZR / ZS}`], ['Warunek montażu', `(${ZS} + ${ZR}) / 3 = ${(ZS + ZR) / 3} — całkowite`]],
  ports: [P('sun', 'Koło słoneczne (wejście)'), P('ring', 'Koło koronowe (stałe)', 'podparcie'), P('carrier', 'Jarzmo (wyjście)')] });
const eS10 = shaftEl('s10', XP + 0.048, 3.48, Y0, ZP, 'Wał wyjściowy');
block(2.62, Y0, ZP); block(3.22, Y0, ZP);
// hamulec tarczowy i tarcza z podziałką
const disc = new THREE.Group(); disc.userData.spin = new THREE.Group(); disc.add(disc.userData.spin); disc.position.set(2.92, Y0, ZP); root.add(disc);
{
  const ds = new THREE.Shape(); ds.absarc(0, 0, 0.1, 0, TAU, false); ds.holes.push(new THREE.Path().absarc(0, 0, 0.0125, 0, TAU, true));
  for (let k = 0; k < 12; k++) ds.holes.push(new THREE.Path().absarc(0.072 * Math.cos(k * TAU / 12), 0.072 * Math.sin(k * TAU / 12), 0.006, 0, TAU, true));
  const dg = new THREE.ExtrudeGeometry(ds, { depth: 0.008, bevelEnabled: false, curveSegments: 48 }); dg.translate(0, 0, -0.004).applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  const dm = new THREE.Mesh(dg, M.steel); dm.castShadow = dm.receiveShadow = true; disc.userData.spin.add(dm);
  const cal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.07), M.paintRed); cal.position.set(2.92, Y0 + 0.085, ZP); cal.castShadow = true; root.add(cal);
  const brk = new THREE.Mesh(new THREE.BoxGeometry(0.03, Y0 + 0.06 - BED_TOP, 0.03), M.dark); brk.position.set(2.92, BED_TOP + (Y0 + 0.06 - BED_TOP) / 2, ZP + 0.07); brk.castShadow = true; root.add(brk);
}
const eDisc = element('disc', 'Hamulec tarczowy', 'brake', disc, { J: 0.5 * 2.4 * 0.01,
  props: [['Tarcza', 'Ø 200 × 8 mm, stal, otwory wentylacyjne'], ['Zacisk', 'jednotłoczkowy, pływający'], ['Moment hamowania', 'z suwaka „Hamulec”'], ['Masa', '2,4 kg']], ports: [P('shaft', 'Wał (obciążenie)', 'obciążenie')] });
// tarcza z podziałką na końcu wału
{
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#d7dade'; g.beginPath(); g.arc(256, 256, 250, 0, TAU); g.fill();
  g.strokeStyle = '#1b1d20'; g.fillStyle = '#1b1d20';
  for (let k = 0; k < 72; k++) { const a = k * TAU / 72, r0 = k % 6 ? 222 : 196; g.lineWidth = k % 6 ? 3 : 6; g.beginPath(); g.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0); g.lineTo(256 + Math.cos(a) * 246, 256 + Math.sin(a) * 246); g.stroke(); }
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k < 12; k++) { const a = k * TAU / 12; g.fillText(String(k * 30), 256 + Math.cos(a) * 160, 256 + Math.sin(a) * 160); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.12, 64).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.5 }));
  face.position.x = 3.485 - eS10.group.position.x; eS10.spin.add(face);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.008, 64).rotateZ(Math.PI / 2), M.alu); back.position.x = 3.48 - eS10.group.position.x; eS10.spin.add(back);
  const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 3).rotateZ(Math.PI), M.paintRed); ptr.position.set(3.5, Y0 + 0.14, ZP); root.add(ptr);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.012, Y0 + 0.16 - BED_TOP, 0.012), M.dark); post.position.set(3.53, BED_TOP + (Y0 + 0.16 - BED_TOP) / 2, ZP); root.add(post);
}

/* ---------------- połączenia portów ---------------- */
const C = drive.connect;
C('motor', 'out', 'jaw', 'a', 'coupling'); C('jaw', 'b', 's1', 'a', 'coupling');
C('s1', 'b', 'g1', 'bore', 'shaft'); C('g1', 'mesh', 'g2', 'mesh', 'mesh', { za: 20, zb: 40 }); C('g2', 'bore', 's2', 'a', 'shaft');
C('s2', 'b', 'g3', 'bore', 'shaft'); C('g3', 'mesh', 'g4', 'mesh', 'mesh', { za: 16, zb: 48 }); C('g4', 'bore', 's3', 'a', 'shaft');
C('s3', 'b', 'g5', 'bore', 'shaft'); C('g5', 'mesh', 'g6', 'mesh', 'mesh', { za: 24, zb: 40 }); C('g6', 'bore', 's4', 'a', 'shaft');
C('s4', 'b', 'c1', 'bore', 'shaft'); C('c1', 'chain', 'c2', 'chain', 'chain', { za: 18, zb: 27 }); C('c2', 'bore', 's5', 'a', 'shaft');
C('s5', 'b', 'pu1', 'bore', 'shaft'); C('pu1', 'belt', 'pu2', 'belt', 'belt', { za: 0.16, zb: 0.08 }); C('pu2', 'bore', 's6', 'a', 'shaft');
C('s6', 'b', 'fl', 'a', 'coupling'); C('fl', 'b', 's7', 'a', 'coupling');
C('s7', 'b', 's8', 'a', 'ujoint', { pinA: Y.clone(), pinB: new THREE.Vector3(0, 0, 1).applyQuaternion(Q8) });
C('s8', 'b', 's9', 'a', 'ujoint', { pinA: new THREE.Vector3(0, 0, 1).applyQuaternion(Q8), pinB: Y.clone() });
C('s9', 'b', 'sun', 'bore', 'shaft'); C('sun', 'mesh', 'car', 'sun', 'planetary', { zs: ZS, zr: ZR }); C('car', 'carrier', 's10', 'a', 'shaft');
C('s10', 'b', 'disc', 'shaft', 'shaft');
const solved = drive.solve('motor', 'disc');
if (!solved.ok) console.warn('Napęd zakleszczony', solved.conflicts);
if (solved.unreached.length) console.warn('Elementy bez połączenia', solved.unreached.map((e) => e.name));
// faza korony: wrąb korony naprzeciw zęba satelity 0 (punkt styku na zewnątrz satelity, kąt 0)
{
  const p0 = Math.PI + Math.PI / ZPL;   // kąt satelity 0 w układzie jarzma przy kątach 0 (wzór zazębienia ze słonecznym, ψ = 0)
  const off = p0 - Math.round(p0 / (TAU / ZPL)) * (TAU / ZPL);
  ring.userData.spin.rotation.x = off * ZPL / ZR + Math.PI / ZR;
}

/* ---------------- obrazowanie kątów ---------------- */
function applyAngles() {
  for (const e of parts) if (e.spin) e.spin.rotation.x = e.theta;
  // satelity: obrót względem jarzma z zazębienia ze słonecznym (Willis), położenie z jarzmem
  const ts = eSun.theta - eCar.theta;
  planets.forEach((pl, k) => { const psi = k * TAU / 3; pl.userData.spin.rotation.x = -(ZS / ZPL) * (ts - psi) + psi + Math.PI + Math.PI / ZPL; });
  // łańcuch i pas
  chain.userData.update(eC1.theta * 18 / TAU);
  belt.userData.update(ePu1.theta * 0.08);
  // krzyżaki przegubów: czopy wzdłuż sworzni widełek po obu stronach
  crossPose(cross1, Y, eS7.theta, X, new THREE.Vector3(0, 0, 1).applyQuaternion(Q8), eS8.theta, DIR);
  crossPose(cross2, new THREE.Vector3(0, 0, 1).applyQuaternion(Q8), eS8.theta, DIR, Y, eS9.theta, X);
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Matrix4();
function crossPose(cr, pinA, ta, axA, pinB, tb, axB) {
  _a.copy(pinA).applyAxisAngle(axA, ta); _b.copy(pinB).applyAxisAngle(axB, tb);
  _b.addScaledVector(_a, -_b.dot(_a)).normalize(); _c.crossVectors(_a, _b);
  _m.makeBasis(_c, _a, _b); cr.quaternion.setFromRotationMatrix(_m);
}

/* ---------------- pętla ---------------- */
let last = performance.now(), statT = 0, sel = null;
const selBox = new THREE.BoxHelper(new THREE.Object3D(), 0xf2c14e); selBox.visible = false; scene.add(selBox);
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.mode === 'machine') { drive.step(dt, { rpm: S.rpm, brake: S.brake }); applyAngles(); }
  else if (S.mode === 'physics') { reg.api.tick(dt); phys.step(dt, { w0: reg.api.f * 4 * Math.PI / 4, brake: S.brake }); applyAngles(); }   // silnik 4-biegunowy: ω_syn = 4π f / p
  else if (item) { itemTheta += S.spin * TAU / 60 * dt; item.update(itemTheta); if (item.tick) item.tick(dt); }
  moveKeys(dt);
  if ((statT += dt) > 0.2) { statT = 0; stats(); }
  if (sel) selBox.update();
  if (S.hit && hitG.visible) syncHit();
  const c = Math.cos(orbit.pitch);
  camera.position.set(orbit.target.x + Math.sin(orbit.yaw) * c * orbit.dist, orbit.target.y + Math.sin(orbit.pitch) * orbit.dist, orbit.target.z + Math.cos(orbit.yaw) * c * orbit.dist);
  camera.lookAt(orbit.target);
  stage.follow(orbit.target, 7);
  stage.render();
  requestAnimationFrame(loop);
}
const rpmOf = (w) => w * 60 / TAU, fmt = (v, d = 0) => v.toLocaleString('pl', { minimumFractionDigits: d, maximumFractionDigits: d });
const dirOf = (w) => (Math.abs(w) < 1e-3 ? '—' : w > 0 ? '↺' : '↻');   // patrząc od +x wzdłuż osi
function stats() {
  if (S.mode === 'items') { itemStats(); return; }
  if (S.mode === 'physics') { physStats(); return; }
  const st = drive.state;
  const rows = [['Silnik', `${fmt(rpmOf(st.omega))} obr/min`], ['Moment silnika', `${fmt(st.Tm, 1)} N·m`], ['Moc silnika', `${fmt(st.P)} W`], ['Moc na hamulcu', `${fmt(st.Pout || 0)} W`],
    ['Sprawność całkowita', `${fmt(eDisc.eta * 100, 1)} %`], ['Przełożenie całkowite', `${fmt(Math.abs(1 / (eDisc.r || 1e-9)), 2)} : 1`], ['Bezwładność zredukowana', `${fmt(st.Jeff * 1e4, 1)} kg·cm²`], ['Wyjście', `${fmt(rpmOf(eDisc.omega), 1)} obr/min, ${fmt(eDisc.T, 1)} N·m`]];
  $('bDrive').replaceChildren(...rows.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: b })]));
  $('bList').replaceChildren(...parts.flatMap((e) => { const s = el('span', { textContent: e.name }); s.onclick = () => select(e); return [s, el('b', { textContent: `${dirOf(e.omega)} ${fmt(Math.abs(rpmOf(e.omega)), 1)} obr/min · ${fmt(e.T, 1)} N·m` })]; }));
  if (sel) showSel();
  if (window.LabPerf) window.LabPerf.modelRows([['Elementy', String(parts.length)], ['Połączenia', String(drive.edges.length)], ['Ogniwa łańcucha', String(CH.N)]]);
}

/* ---------------- wybór elementu ---------------- */
function select(e) { sel = e; selBox.setFromObject(e.group); selBox.visible = !!e; showSel(); }
function showSel() {
  const e = sel; if (!e) return;
  $('selName').textContent = e.name;
  const rows = [...e.props, ['Prędkość', `${dirOf(e.omega)} ${fmt(Math.abs(rpmOf(e.omega)), 1)} obr/min`], ['Moment przenoszony', `${fmt(e.T, 2)} N·m`], ['Moc', `${fmt(Math.abs(e.T * e.omega))} W`], ['Sprawność od silnika', `${fmt(e.eta * 100, 1)} %`]];
  $('selProps').replaceChildren(...rows.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: String(b) })]));
  // porty: z czym są połączone i co przez nie płynie
  $('selPorts').replaceChildren(...(e.ports || []).map((p) => {
    const ed = drive.edges.find((x) => (x.a === e && x.pa === p.id) || (x.b === e && x.pb === p.id));
    const other = ed ? (ed.a === e ? ed.b : ed.a) : null, io = ed ? (ed.b === e ? 'wejście' : 'wyjście') : (p.kind === 'obrót' ? 'wolny' : p.kind);
    const li = el('li', {}, el('b', { textContent: p.name }), el('span', { textContent: ` · ${p.kind} · ${io}` }));
    if (other) { const a = el('a', { href: '#', textContent: ` → ${other.name} (${KIND_NAME[ed.type]})` }); a.onclick = (ev) => { ev.preventDefault(); select(other); }; li.append(a); }
    return li;
  }));
}
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(parts.map((p) => p.group), true);
  for (const h of hits) { let o = h.object; while (o && !o.userData.el) o = o.parent; if (o) { select(o.userData.el); return; } }
  sel = null; selBox.visible = false; $('selName').textContent = 'Kliknij element maszyny'; $('selProps').replaceChildren(); $('selPorts').replaceChildren();
}

/* ---------------- kamera ---------------- */
const orbit = { target: new THREE.Vector3(-1.4, 0.9, 0.2), dist: 9, yaw: 0.25, pitch: 0.38 };
const CAMS = { 'Cała maszyna': { t: [-1.4, 0.9, 0.2], dist: 9.5, yaw: 0.25, pitch: 0.4 }, 'Zębatki': { t: [-5.3, 0.9, 0.06], dist: 1.5, yaw: 0.7, pitch: 0.35 }, 'Przekładnia': { t: [-4.1, 0.95, 0.12], dist: 1.3, yaw: 0.35, pitch: 0.3 },
  'Łańcuch': { t: [-2.6, 1.07, 0.12], dist: 1.2, yaw: -1.15, pitch: 0.15 }, 'Pas': { t: [-0.95, 1.07, 0.12], dist: 1.2, yaw: -1.15, pitch: 0.15 }, 'Sprzęgła i przeguby': { t: [0.9, 0.9, 0.25], dist: 1.9, yaw: 0.2, pitch: 0.45 }, 'Planetarna': { t: [2.36, 0.87, 0.37], dist: 0.55, yaw: -1.0, pitch: 0.25 }, 'Hamulec': { t: [3.1, 0.9, 0.37], dist: 1.1, yaw: 0.8, pitch: 0.3 } };
const setCam = (v) => { Object.assign(orbit, { yaw: v.yaw, pitch: v.pitch, dist: v.dist }); orbit.target.set(...v.t); };
function cams() {
  const C = S.mode === 'machine' ? CAMS : S.mode === 'physics' ? { ...CAMS, 'Regulator': { t: [-6.1, 0.9, 0.3], dist: 0.9, yaw: 0.35, pitch: 0.3 } } : { 'Przedmiot': null, 'Z przodu': { yaw: Math.PI / 2, pitch: 0.05 }, 'Z boku': { yaw: 0, pitch: 0.1 }, 'Z góry': { yaw: 0.3, pitch: 1.4 } };
  $('cams').replaceChildren(...Object.entries(C).map(([k, v]) => { const b = el('button', { type: 'button', textContent: k }); b.onclick = () => (S.mode === 'items' ? frameItem(v) : setCam(v)); return b; }));
}
const cv = renderer.domElement; let drag = null;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
// sterowanie na modelu (tryb Przedmioty): część z userData.control — klik / przytrzymanie / przeciąganie zamiast obrotu kamery
let ctl = null;
// obiekt z obsługą w bieżącym trybie: przedmiot ze sterowaniem (Przedmioty) albo regulator przy silniku (Fizyka)
const ctlTarget = () => (S.mode === 'items' ? (item && item.controls ? { group: item.group, api: item.api } : null) : S.mode === 'physics' ? reg : null);
function controlAt(e) {
  const tg = ctlTarget(); if (!tg) return null;
  const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObject(tg.group, true)[0]; let o = h && h.object; while (o && !o.userData.control) o = o.parent;
  return o ? { name: o.userData.control, api: tg.api } : null;
}
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  const c = e.button === 0 ? controlAt(e) : null;
  if (c) { ctl = { name: c.name, api: c.api, y: e.clientY }; c.api.press(c.name); stats(); return; }
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
});
cv.addEventListener('pointermove', (e) => {
  if (ctl) { ctl.api.drag(ctl.name, e.clientY - ctl.y); ctl.y = e.clientY; return; }
  if (!drag) { cv.classList.toggle('grab', !!controlAt(e)); return; } const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true; if (drag.moved) { orbit.yaw -= dx * 0.005; orbit.pitch = Math.max(0.02, Math.min(1.52, orbit.pitch + dy * 0.004)); } });
// przerwany gest (pointercancel — np. dotyk, utrata przechwycenia, okno w tle): sterowanie zawsze puszczone
function endPointer() { if (ctl) { ctl.api.release(ctl.name); ctl = null; stats(); } drag = null; }
cv.addEventListener('pointercancel', endPointer); cv.addEventListener('lostpointercapture', () => { if (ctl) endPointer(); }); addEventListener('blur', endPointer);
cv.addEventListener('pointerup', (e) => { if (ctl) { ctl.api.release(ctl.name); ctl = null; stats(); return; } const click = drag && !drag.moved; drag = null; if (click && e.button === 0 && S.mode !== 'items') pick(e); });
cv.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.min(30, Math.max(0.3, orbit.dist * Math.exp(e.deltaY * 0.0011))); }, { passive: false });
const held = new Set();
addEventListener('keyup', (e) => held.delete(e.code)); addEventListener('blur', () => held.clear());
function moveKeys(dt) {
  const f = (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0), s = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
  if (!f && !s) return;
  const fx = -Math.sin(orbit.yaw), fz = -Math.cos(orbit.yaw), v = Math.max(0.6, orbit.dist) * 0.8 * dt;
  orbit.target.x += (fx * f - fz * s) * v; orbit.target.z += (fz * f + fx * s) * v;
}

/* ---------------- tryb „Fizyka”: regulator przy silniku, napęd fizyczny, hitboksy ---------------- */
// regulator prędkości: falownik z pokrętłem, RUN / STOP i FWD / REV na łożu przed silnikiem (obsługa na modelu)
const reg = (() => { const g = CK.inverter({ kW: 1.1, fmax: 50, ramp: 4 }); g.position.set(-6.3, BED_TOP, 0.4); scene.add(g); g.visible = false; return { group: g, api: g.userData.api }; })();
// luz w zazębieniu z geometrii zębów: oba koła cieńsze o 0,04·m → luz obwodowy 0,08·m na kole podziałowym koła b
const BACKLASH = (e) => (e.type === 'mesh' && e.b.group && e.b.group.userData.rp ? 0.08 * e.b.group.userData.m / e.b.group.userData.rp : 0);
// punkt 2 — sztywności skrętne połączeń (N·m/rad kąta koła b) i tłumienie ζ:
//   wał: G·J_p / L (stal G = 80 GPa, J_p = π d⁴ / 32); gwiazda sprzęgła kłowego — wg twardości (katalog, wielkość 19);
//   zazębienie: sztywność zęba c ≈ 20 N/(mm·µm) × szerokość, sprowadzona na koło zasadnicze (k = c·b·r_b²);
//   łańcuch i pas: sztywność cięgna EA / L (łańcuch 08A ≈ 2 MN, pas SPA ≈ 40 kN na pas) × r²
const G_STEEL = 80e9, SPIDER_K = { '92A': 1300, '98A': 2300, '64D': 4500 };
function STIFF(e) {
  const ua = e.a.group && e.a.group.userData, ub = e.b.group && e.b.group.userData;
  if (e.type === 'shaft' && e.a.type === 'shaft' && ua.len) { const d = ua.r * 2; return { k: G_STEEL * Math.PI * d ** 4 / 32 / ua.len, zeta: 0.02, name: `${e.a.name} (Ø ${Math.round(d * 1000)}, ${Math.round(ua.len * 1000)} mm)` }; }
  if (e.type === 'coupling' && e.a.id === 'jaw') return { k: SPIDER_K['92A'], zeta: 0.07, name: 'Gwiazda sprzęgła kłowego 92 Sh A' };
  if (e.type === 'coupling') return { k: 1.5e5, zeta: 0.02, name: e.a.name };
  if (e.type === 'mesh') { const b = Math.min(ua.w, ub.w), rb = ub.rp * Math.cos(20 * Math.PI / 180); return { k: 2e10 * b * rb * rb, zeta: 0.05, name: `Zazębienie ${ua.z} : ${ub.z}` }; }
  if (e.type === 'chain') return { k: 2e6 / CH.D * CH.R2 * CH.R2, zeta: 0.03, name: 'Łańcuch 08A' };
  if (e.type === 'belt') return { k: 4e4 / Math.hypot(YS5 - Y0, 0) * 0.04 * 0.04, zeta: 0.08, name: 'Pas klinowy SPA' };
  if (e.type === 'ujoint') return { k: 2e5, zeta: 0.02, name: 'Przegub Cardana' };
  if (e.type === 'planetary') return { k: 3e5, zeta: 0.03, name: 'Przekładnia planetarna' };
  return null;   // wpust (koło na wale) — sztywno
}
const phys = createPhysics(drive, { motorId: 'motor', brakeId: 'disc', backlash: BACKLASH, stiffness: STIFF });
function physStats() {
  const st = phys.state, f1 = (v) => fmt(v, 1), a = reg.api;
  const rows = [['Regulator', `${a.run ? 'RUN' : 'STOP'} · ${a.dir > 0 ? 'FWD' : 'REV'} · ${f1(Math.abs(a.f))} Hz (zadana ${f1(a.set)} Hz)`], ['Silnik', `${dirOf(st.omega)} ${fmt(Math.abs(rpmOf(st.omega)))} obr/min (synchr. ${fmt(Math.abs(30 * a.f))})`], ['Moment silnika', `${f1(st.Tm)} N·m`],
    ['Wyjście', `${dirOf(eDisc.omega)} ${f1(Math.abs(rpmOf(eDisc.omega)))} obr/min`], ['Moment hamulca', `${f1(Math.abs(st.Tb))} N·m`]];
  // sprężyste połączenia: skręcenie (poza luzem) i moment — miękkie na liście (sztywność poniżej 10⁵ N·m/rad)
  for (const c of phys.edges) if (c.k < 1e5) rows.push([`Sprężystość: ${c.name}`, `${fmt(c.twist * 180 / Math.PI, 3)}° · ${fmt(Math.abs(c.T), 2)} N·m · k = ${fmt(c.k)} N·m/rad`]);
  for (const c of phys.edges) if (c.dead) {
    const ga = c.e.a.group.userData, gb = c.e.b.group.userData;
    rows.push([`Luz ${ga.z} : ${gb.z}`, `${fmt(0.08 * gb.m * 1000, 2)} mm · ${c.contact > 0 ? 'przylega flanką przednią' : c.contact < 0 ? 'przylega flanką tylną' : 'w luzie — zęby się nie dotykają'}`]);
  }
  $('bDrive').replaceChildren(...rows.flatMap(([x, y]) => [el('span', { textContent: x }), el('b', { textContent: y })]));
  $('bList').replaceChildren(...parts.flatMap((e) => { const sp = el('span', { textContent: e.name }); sp.onclick = () => select(e); return [sp, el('b', { textContent: `${dirOf(e.omega)} ${fmt(Math.abs(rpmOf(e.omega)), 1)} obr/min · ${fmt(e.T, 1)} N·m` })]; }));
  if (sel) showSel();
  if (window.LabPerf) window.LabPerf.modelRows([['Stopnie swobody', String(phys.nodes.length)], ['Wiązania', String(phys.edges.length)], ['Zazębienia z luzem', String(phys.edges.filter((c) => c.dead).length)]]);
}
// hitboksy z geometrii (ogólnie, bez ręcznych wymiarów): część obrotowa — walec wzdłuż osi (obraca się z częścią),
// część nieruchoma — prostopadłościan; siatki druciane rysowane przez wszystko
const hitG = new THREE.Group(); scene.add(hitG); hitG.visible = false;
const HM = { spin: new THREE.LineBasicMaterial({ color: 0x4ad2ff, transparent: true, opacity: 0.85, depthTest: false }), fixed: new THREE.LineBasicMaterial({ color: 0xffc14a, transparent: true, opacity: 0.7, depthTest: false }) };
let hitItems = null;
function buildHit() {
  hitItems = [];
  const inv = new THREE.Matrix4(), v = new THREE.Vector3();
  for (const e of parts) {   // walec: zasięg wzdłuż osi (x lokalne) i największy promień w płaszczyźnie (y, z) części wirującej
    const sp = e.spin || e.group; sp.updateWorldMatrix(true, true); inv.copy(sp.matrixWorld).invert();
    let x0 = Infinity, x1 = -Infinity, r = 0;
    sp.traverse((o) => { if (!o.isMesh || !o.geometry.attributes.position) return; const pa = o.geometry.attributes.position, mw = o.matrixWorld;
      if (o.isInstancedMesh) return;
      for (let i = 0; i < pa.count; i += 3) { v.fromBufferAttribute(pa, i).applyMatrix4(mw).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); r = Math.max(r, Math.hypot(v.y, v.z)); } });
    if (!(x1 > x0)) continue;
    const cyl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(r, r, x1 - x0, 20, 1).rotateZ(-Math.PI / 2), 1), HM.spin); cyl.position.x = (x0 + x1) / 2; cyl.renderOrder = 20;
    const holder = new THREE.Group(); holder.add(cyl); hitG.add(holder); hitItems.push({ holder, src: sp });
  }
  const isPart = (o) => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.el) return true; return false; };
  for (const o of root.children) {   // nieruchome: łożyska, obudowy, silnik (korpus), podpory, łoże
    if (isPart(o) || o.isLight || !o.visible) continue;
    const bb = new THREE.Box3().setFromObject(o); if (bb.isEmpty()) continue;
    const bx = new THREE.Box3Helper(bb, 0xffc14a); bx.material = HM.fixed; bx.renderOrder = 20; hitG.add(bx);
  }
  { const bb = new THREE.Box3().setFromObject(motorG.children.find((c) => c !== motorG.userData.spin) || motorG); const bx = new THREE.Box3Helper(bb, 0xffc14a); bx.material = HM.fixed; hitG.add(bx); }
  { const bb = new THREE.Box3().setFromObject(reg.group); const bx = new THREE.Box3Helper(bb, 0xffc14a); bx.material = HM.fixed; bx.userData.reg = true; hitG.add(bx); }
}
function syncHit() { for (const h of hitItems) { h.src.updateWorldMatrix(true, false); h.holder.matrixAutoUpdate = false; h.holder.matrix.copy(h.src.matrixWorld); } for (const c of hitG.children) if (c.userData.reg) c.visible = S.mode === 'physics'; }
function setHit(on) { S.hit = on; save(); if (on && !hitItems) buildHit(); hitG.visible = on && S.mode !== 'items'; }
$('hit').checked = S.hit; $('hit').onchange = () => setHit($('hit').checked);

/* ---------------- tryb „Przedmioty”: stół, katalog, ustawienia ---------------- */
const IO = new THREE.Vector3(0, 0, -6), TABLE = 0.9;   // stół z podglądem z dala od maszyny
const itemRoot = new THREE.Group(); scene.add(itemRoot);
{
  const tg = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 64), tuv = tg.attributes.uv; for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getX(i) * 1.1, tuv.getY(i) * 1.1);
  const top = new THREE.Mesh(tg, M.bed); top.position.set(IO.x, TABLE - 0.02, IO.z); top.castShadow = top.receiveShadow = true;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, TABLE - 0.08, 24), M.paintGrey); col.position.set(IO.x, (TABLE - 0.04) / 2, IO.z); col.castShadow = true;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.04, 48), M.iron); foot.position.set(IO.x, 0.02, IO.z); foot.castShadow = foot.receiveShadow = true;
  const L = new THREE.SpotLight(0xfff0dc, 14, 6, 0.6, 0.5, 1.5); L.position.set(IO.x + 1.2, 3, IO.z + 1.6); L.target.position.set(IO.x, TABLE, IO.z);
  itemRoot.add(top, col, foot, L, L.target);
}
let item = null, itemDef = null, itemTheta = 0, itemR = 0.3;
const itemHolder = new THREE.Group(); itemRoot.add(itemHolder);
// statyw: słupek z boku przedmiotu i poziomy czop wzdłuż osi obrotu (x) do środka przedmiotu
const stand = new THREE.Group(); itemRoot.add(stand);
const standPost = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 16), M.paintGrey), standArm = new THREE.Mesh(MK.cyl(0.006, 1, 16), M.steel), standFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.012, 32), M.iron);
for (const o of [standPost, standArm, standFoot]) { o.castShadow = true; o.receiveShadow = true; stand.add(o); }
// ustawienia przedmiotu: zapisana wartość tylko, gdy pasuje do definicji (typ, zakres, lista) — inaczej domyślna
function itemParams(def) {
  const saved0 = S.items[def.id] || {}, p = {};
  for (const q of def.params) { const v = saved0[q.key]; p[q.key] = valid(q.def, v, q.type === 'select' ? q.options.map((o) => o[0]) : q.type === 'range' ? (x) => x >= q.min && x <= q.max : null) ? v : q.def; }
  return p;
}
function disposeTree(o) { o.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); }
function buildItem() {
  itemDef = ITEMS.find((i) => i.id === S.item) || ITEMS[0]; S.item = itemDef.id;
  for (const c of [...itemHolder.children]) { disposeTree(c); itemHolder.remove(c); }
  item = itemDef.build(itemParams(itemDef));
  const g = item.group; itemHolder.add(g); g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  // na blacie (silnik, oprawa łożyska) albo nad blatem na statywie — część wirująca nie dotyka stołu
  const lift = item.rest ? 0.015 : 0.06;
  g.position.set(IO.x - c.x, TABLE + lift - bb.min.y, IO.z - c.z);
  itemR = Math.max(0.08, sz.length() / 2);
  stand.visible = !item.rest;
  if (!item.rest) {
    const cy = TABLE + lift + sz.y / 2, px = IO.x - sz.x / 2 - 0.05, h = cy - TABLE;
    standPost.scale.y = h; standPost.position.set(px, TABLE + h / 2, IO.z); standFoot.position.set(px, TABLE + 0.006, IO.z);
    standArm.scale.x = IO.x - px; standArm.position.set((px + IO.x) / 2, cy, IO.z);
  }
  item.update(itemTheta);
  itemStats();
}
function frameItem(v) {
  const c = new THREE.Box3().setFromObject(itemHolder).getCenter(new THREE.Vector3());
  orbit.target.copy(c); orbit.dist = itemR * 3.2;
  const d0 = item && item.view ? item.view : { yaw: 0.75, pitch: 0.32 };
  if (v) { orbit.yaw = v.yaw; orbit.pitch = v.pitch; } else { orbit.yaw = d0.yaw; orbit.pitch = d0.pitch; }
}
function itemList() {
  const groups = [...new Set(ITEMS.map((i) => i.group))];
  $('itemList').replaceChildren(...groups.flatMap((gname) => [el('h4', { textContent: gname }), el('div', { className: 'btns' }, ...ITEMS.filter((i) => i.group === gname).map((i) => {
    const b = el('button', { type: 'button', textContent: i.name, className: i.id === S.item ? 'on' : '' }); b.onclick = () => { S.item = i.id; save(); itemList(); itemSettings(); buildItem(); frameItem(); }; return b;
  }))]));
}
function itemSettings() {
  const def = ITEMS.find((i) => i.id === S.item) || ITEMS[0], p = itemParams(def), box0 = $('itemSet');
  const fmtV = (q, v) => (q.unit === 'mm' ? `${Math.round(v * 1000)} mm` : q.unit === 'mm×2' ? `${Math.round(v * 1000)} mm` : q.unit === '°' ? `${v}°` : q.unit ? `${String(v).replace('.', ',')} ${q.unit}` : String(v));
  const rows = def.params.map((q) => {
    const set = (v) => { (S.items[def.id] ||= {})[q.key] = v; save(); buildItem(); };
    if (q.type === 'select') {
      const sel = el('select', {}, ...q.options.map(([v, t]) => el('option', { value: String(v), textContent: t })));
      sel.value = String(p[q.key]); sel.onchange = () => { const o = q.options.find(([v]) => String(v) === sel.value); set(o[0]); };
      return el('div', { className: 'row' }, el('span', { textContent: q.label }), sel, el('output'));
    }
    if (q.type === 'check') {
      const cb = el('input', { type: 'checkbox', checked: !!p[q.key] }); cb.onchange = () => set(cb.checked);
      return el('label', { className: 'row' }, el('span', { textContent: q.label }), cb, el('output'));
    }
    const r = el('input', { type: 'range', min: q.min, max: q.max, step: q.step, value: p[q.key] }), out = el('output', { textContent: fmtV(q, p[q.key]) });
    r.oninput = () => { out.textContent = fmtV(q, +r.value); }; r.onchange = () => set(+r.value);
    return el('div', { className: 'row' }, el('span', { textContent: q.label }), r, out);
  });
  const sp = el('input', { type: 'range', min: 0, max: 120, step: 1, value: S.spin }), spo = el('output', { textContent: `${S.spin} obr/min` });
  sp.oninput = () => { S.spin = +sp.value; spo.textContent = `${S.spin} obr/min`; save(); };
  const reset = el('button', { type: 'button', textContent: 'Domyślne' }); reset.onclick = () => { delete S.items[def.id]; save(); itemSettings(); buildItem(); };
  // sterowanie i zasilanie — bez obrotu podglądu; sterowanie obsługuje się na modelu
  const preview0 = def.group === 'Zasilanie i przewody' && def.id === 'wire' ? [] : ['Sterowanie', 'Zasilanie i przewody'].includes(def.group) ? [el('p', { className: 'note', textContent: 'Obsługa na modelu: klik — dźwignia, przycisk, wyłącznik, RUN / STOP; przytrzymanie — przycisk chwilowy, krańcówka; przeciąganie w górę / w dół — pokrętło.' })] : [el('h3', { textContent: 'Podgląd' }), el('div', { className: 'row' }, el('span', { textContent: 'Obrót wejścia' }), sp, spo)];
  box0.replaceChildren(el('h3', { textContent: def.name }), ...rows, ...preview0, el('div', { className: 'btns' }, reset));
}
function itemStats() {
  if (!item) return;
  $('selName').textContent = itemDef.name;
  const rows = [...item.info, ...(item.live ? item.live() : [])];   // wartości na żywo zastępują te same pola z opisu
  const uniq = []; const seen = new Set(); for (const r of rows) { if (seen.has(r[0])) { uniq[uniq.findIndex((u) => u[0] === r[0])] = r; continue; } seen.add(r[0]); uniq.push(r); }
  $('selProps').replaceChildren(...uniq.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: String(b) })]), ...(item.warn || []).map((w) => el('p', { className: 'warn', textContent: '⚠ ' + w })));
  $('selPorts').replaceChildren(...item.ports.map((pt) => el('li', {}, el('b', { textContent: pt.name }), el('span', { textContent: ` · ${pt.kind}` }))));
  if (window.LabPerf) window.LabPerf.modelRows([['Przedmiot', itemDef.name], ['Ustawienia', String(itemDef.params.length)], ['Porty', String(item.ports.length)]]);
}
function setMode(m) {
  const was = S.mode;
  S.mode = ['machine', 'physics'].includes(m) ? m : 'items'; save();
  for (const b of document.querySelectorAll('#modes button')) b.classList.toggle('on', b.dataset.mode === S.mode);
  const mach = S.mode !== 'items', phy = S.mode === 'physics';
  root.visible = mach; for (const c of [cross1, cross2]) c.visible = mach; itemRoot.visible = !mach; selBox.visible = mach && !!sel;
  reg.group.visible = phy; $('rpmCtl').hidden = phy; hitG.visible = mach && S.hit;
  if (phy && was !== 'physics') phys.sync();   // fizyka startuje z bieżącego położenia części
  $('mBar').hidden = !mach;
  $('info').textContent = phy ? $('info').dataset.physics : mach ? $('info').dataset.machine : $('info').dataset.items;
  if (mach) { sel = null; $('selName').textContent = 'Kliknij element maszyny'; $('selProps').replaceChildren(); $('selPorts').replaceChildren(); if (was === 'items' || !was) setCam(CAMS['Cała maszyna']); }
  else { buildItem(); frameItem(); }
  cams(); stats();
}
for (const b of document.querySelectorAll('#modes button')) b.onclick = () => setMode(b.dataset.mode);

/* ---------------- UI ---------------- */
const bind = (id, key, fmtV, after) => { $(id).value = S[key]; $(id + 'V').textContent = fmtV(S[key]); $(id).oninput = () => { S[key] = +$(id).value; $(id + 'V').textContent = fmtV(S[key]); if (after) after(); save(); }; };
bind('rpm', 'rpm', (v) => (v ? `${v} obr/min` : 'stop'));
bind('brake', 'brake', (v) => `${v} N·m`);
bind('alpha', 'alpha', (v) => `${Math.round(v * 100)} %`, applyAlpha);
function applyAlpha() { M.acrylic.opacity = S.alpha; for (const p of panes) p.visible = S.alpha > 0.01; }
$('weather').replaceChildren(...Object.entries(WEATHER).map(([k, w]) => el('option', { value: k, textContent: w.label || k })));
$('weather').value = S.weather; $('weather').onchange = () => { S.weather = $('weather').value; sky(); save(); };
for (const k of ['sunEl', 'sunAz']) { $(k).value = S[k]; $(k + 'V').textContent = S[k] + '°'; $(k).oninput = () => { S[k] = +$(k).value; $(k + 'V').textContent = S[k] + '°'; sky(); save(); }; }
function sky() { stage.setSky({ weather: S.weather, sunEl: S.sunEl, sunAz: S.sunAz }); }
addEventListener('keydown', (e) => {
  if (e.target.closest('input,select,textarea')) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) held.add(e.code);
  if (e.code === 'KeyH') document.querySelectorAll('[data-window]').forEach((p) => p.classList.toggle('hidden-panel'));
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), RUN_MAX = 120;
// MechanicsApi.mode('items' | 'machine'), item(id, ustawienia), items(), rpm(v), brake(Nm), alpha(0–1), state(), elements(), select(id), view(…), run(sekundy)
window.MechanicsApi = {
  mode(m) { setMode(m); return S.mode; },
  // regulator(nazwa) — obsługa regulatora przy silniku w trybie Fizyka: 'run' | 'stop' | 'dir' | liczba (przeciągnięcie pokrętła, px)
  regulator(c) { if (typeof c === 'number') reg.api.drag('knob', c); else reg.api.press(c); return { run: reg.api.run, dir: reg.api.dir, f: reg.api.f, set: reg.api.set }; },
  // ratios() — przełożenia ω_element / ω_silnika w fizyce i w kinematyce (sprawdzenie zgodności)
  ratios() { return parts.filter((e) => phys.nodes.includes(e)).slice(-4).map((e) => [e.name, +(phys.state.omega ? e.omega / phys.state.omega : 0).toFixed(4)]); },
  item(id, params = {}) { S.item = id; S.items[id] = { ...(S.items[id] || {}), ...params }; itemList(); itemSettings(); buildItem(); frameItem(); return { name: itemDef.name, info: item.info, warn: item.warn || [], ports: item.ports.map((p) => p.name) }; },
  items: () => ITEMS.map((i) => ({ id: i.id, name: i.name, group: i.group, params: i.params.map((q) => q.key) })),
  // control(nazwa, 'press' | 'release' | dy) — obsługa części sterującej przedmiotu (jak myszą); zwraca stan na żywo
  control(name, act = 'press') { if (!item || !item.api) return null; if (act === 'press') item.api.press(name); else if (act === 'release') item.api.release(name); else item.api.drag(name, act); return item.live ? Object.fromEntries(item.live()) : null; },
  // liczby spoza zakresu przycinane do zakresu suwaka; nie-liczby pomijane (zostaje obecna wartość)
  rpm(v) { if (Number.isFinite(v)) { S.rpm = clamp(v, 0, 1500); $('rpm').value = S.rpm; $('rpmV').textContent = S.rpm ? `${S.rpm} obr/min` : 'stop'; save(); } return S.rpm; },
  brake(v) { if (Number.isFinite(v)) { S.brake = clamp(v, 0, 300); $('brake').value = S.brake; $('brakeV').textContent = `${S.brake} N·m`; save(); } return S.brake; },
  alpha(a) { if (Number.isFinite(a)) { S.alpha = clamp(a, 0, 1); $('alpha').value = S.alpha; $('alphaV').textContent = `${Math.round(S.alpha * 100)} %`; applyAlpha(); save(); } return S.alpha; },
  state: () => ({ ...drive.state, ok: solved.ok }),
  elements: () => parts.map((e) => ({ id: e.id, name: e.name, rpm: +rpmOf(e.omega).toFixed(2), T: +e.T.toFixed(3), eta: +e.eta.toFixed(4), theta: +e.theta.toFixed(4) })),
  select(id) { const e = parts.find((p) => p.id === id); if (e) select(e); return !!e; },
  view(t = [-1.4, 0.9, 0.2], dist = 9, yaw = 0.25, pitch = 0.38) { orbit.target.set(...t); Object.assign(orbit, { dist, yaw, pitch }); },
  // run: najwyżej RUN_MAX sekund na wywołanie (Infinity / NaN nie zawieszą strony)
  run(sec = 1) { const n = Math.round(clamp(Number.isFinite(sec) ? sec : 0, 0, RUN_MAX) * 60); for (let i = 0; i < n; i++) drive.step(1 / 60, { rpm: S.rpm, brake: S.brake }); applyAngles(); stats(); return this.state(); },
  drive,
};

sky(); applyAlpha(); applyAngles(); itemList(); itemSettings(); setMode(S.mode); if (S.hit) setHit(true);
if (window.LabLoad) window.LabLoad.step('Maszyna złożona', 1);
requestAnimationFrame(loop);
