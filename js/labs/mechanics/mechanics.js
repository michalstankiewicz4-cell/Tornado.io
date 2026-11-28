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
import { createDrive, KIND_NAME, ujointEta } from '../../behaviors/mech/drive.js';
import { createPhysics } from '../../behaviors/mech/physics.js';
import { meshZone, planeMap, contactPair, meshClash } from '../../behaviors/mech/contact.js';
import { createCircuit } from '../../behaviors/mech/circuit.js';
import * as CK from '../../models/mech/controls.js';
import { createClock } from './clock.js';
import { createAutomation } from './automation.js';
import { createTrigger } from './trigger.js';
import { tickLiquids } from '../../render/fluid/liquid.js';
import { createWorkshop } from './workshop/workshop.js';
import { createHydraulicStation } from './hydraulic-station.js';
import { createFountainStation } from './fountain-station.js';
import { createOpticsStation } from './optics-station.js';
import { ITEMS, CATS, cardanMax } from './items.js';
import { loadState, valid } from '../shared/saved.js';
import { T, tr, LOC, EN, translateDom } from './lang.js';

const $ = (id) => document.getElementById(id);
translateDom();
const perfRows = (rows) => { if (window.LabPerf) window.LabPerf.modelRows(rows.map(([a, b]) => [tr(a), tr(String(b))])); };
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); if (EN) { if (typeof props.textContent === 'string') props.textContent = tr(props.textContent); if (props.title) props.title = tr(props.title); } Object.assign(e, props); kids.forEach((k) => e.append(k)); return e; };
const KEY = 'tornado.mechanics.v1';
const WEATHER_PL = { clear: 'Bezchmurnie', fair: 'Cumulusy pięknej pogody', broken: 'Rozerwane chmury', overcast: 'Całkowite zachmurzenie', rain: 'Deszcz', fog: 'Mgła morska', storm: 'Burza' };
const S = loadState(KEY, { mode: 'items', item: 'gear', items: {}, spin: 20, rpm: 600, brake: 20, alpha: 0.25, hit: false, weather: 'fair', sunEl: 40, sunAz: 205 },
  { mode: ['items', 'machine', 'physics'], item: ITEMS.map((i) => i.id), items: (v) => !Array.isArray(v), spin: (v) => v >= 0 && v <= 120, rpm: (v) => v >= 0 && v <= 1500, brake: (v) => v >= 0 && v <= 300, alpha: (v) => v >= 0 && v <= 1, weather: Object.keys(WEATHER) });
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* prywatny tryb */ } };
const TAU = Math.PI * 2, X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const rpmOf = (w) => w * 60 / TAU, fmt = (v, d = 0) => v.toLocaleString(LOC, { minimumFractionDigits: d, maximumFractionDigits: d });

const stage = createStage($('view'), { shadow: 4096 });
const { scene, camera, renderer } = stage;
const M = MK.materials();
const root = new THREE.Group(); scene.add(root);
// warsztat (etap 6): osobny stół przed łożem — js/labs/mechanics/workshop/workshop.js
let WS = null;

/* ---------------- hala: posadzka, łoże, światła ---------------- */
const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2), M.concrete); floor.receiveShadow = true;
{ const uv = floor.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 16, uv.getY(i) * 16); }
scene.add(floor);
const BED_TOP = 0.75, Y0 = 0.87, BX0 = -6.6, BX1 = 3.8, BZ0 = -0.35, BZ1 = 0.75;
{
  const bg = new THREE.BoxGeometry(BX1 - BX0, 0.08, BZ1 - BZ0), buv = bg.attributes.uv; for (let i = 0; i < buv.count; i++) buv.setXY(i, buv.getX(i) * (BX1 - BX0) / 1.2, buv.getY(i) * (BZ1 - BZ0) / 1.2);
  const bed = new THREE.Mesh(bg, M.bed); bed.position.set((BX0 + BX1) / 2, BED_TOP - 0.04, (BZ0 + BZ1) / 2); bed.castShadow = bed.receiveShadow = true; root.add(bed);
  for (let x = BX0 + 0.25; x < BX1; x += 1.3) for (const z of [BZ0 + 0.08, BZ1 - 0.08]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, BED_TOP - 0.08, 0.1), M.iron); leg.position.set(x, (BED_TOP - 0.08) / 2, z); leg.castShadow = leg.receiveShadow = true; root.add(leg); }
  for (const z of [BZ0 + 0.2, BZ1 - 0.2]) { const slot = new THREE.Mesh(new THREE.BoxGeometry(BX1 - BX0 - 0.1, 0.0002, 0.018), M.black); slot.position.set((BX0 + BX1) / 2, BED_TOP + 0.0001, z); root.add(slot); }   // rowki teowe
}
for (const [x, z] of [[-5, 1.6], [-1.5, 1.8], [2, 1.6]]) {   // lampy warsztatowe nad stanowiskami
  const L = new THREE.SpotLight(0xffe2b8, 18, 9, 0.75, 0.6, 1.6); L.position.set(x, 3.4, z); L.target.position.set(x, Y0, 0.15); root.add(L, L.target);
}

/* ---------------- napęd i elementy ---------------- */
const drive = createDrive();
const parts = [];   // { el, group } — do wybierania kliknięciem
let CLOCK = { parts: [], devices: [], step: () => {}, rows: () => {} };
let AUTO = null, TRIG = null; const STATIONS = [];   // STATIONS — stanowiska na łożu: zatrzask (trigger.js), hydraulika (hydraulic-station.js), fontanna (fountain-station.js)
   // TRIG — stanowisko wyzwalania (js/labs/mechanics/trigger.js)   // czujniki, przekaźnik czasowy, regulator PID (js/labs/mechanics/automation.js)   // zegar — regulator (osobny mechanizm obok łoża; sekcja „zegar” niżej)
const panes = [];   // szyby obudów (przezroczystość)
function element(id, name, type, group, { J = group.userData.J || 0, props = [], ports, frame, onAngle } = {}) {
  const u = group.userData, dof = u.slide ? 'lin' : 'rot';   // część przesuwna (listwa, suwak, nakrętka): współrzędna w metrach, J = masa
  const e = drive.add({ id, name, type, J, props, ports, dof, spin: u.spin, slide: u.slide, slideAxis: u.slideAxis, frame: frame || { o: group.position.clone(), axis: X.clone(), ref: Y.clone() }, onAngle, group });
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
const FX = {};   // części mocowane do łoża (do śrub i fizyki luźnych części)
{ const riser = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.22), M.iron); riser.position.set(-6.16, BED_TOP + 0.015, 0); riser.castShadow = riser.receiveShadow = true; root.add(riser); FX.riser = riser; }
const eMotor = element('motor', 'Silnik indukcyjny 1,1 kW', 'motor', motorG, { J: motorG.userData.J, frame: { o: new THREE.Vector3(-6.0, Y0, 0), axis: X.clone(), ref: Y.clone() },
  props: [['Moc znamionowa', '1,1 kW'], ['Obroty znamionowe', '1450 obr/min (4 bieguny, 50 Hz)'], ['Moment krytyczny', '18 N·m'], ['Zasilanie', 'falownik — prędkość z suwaka'], ['Masa', '15,5 kg'], ['Bezwładność wirnika', Jtxt(motorG.userData.J)]], ports: [P('out', 'Wał wyjściowy Ø 24')] });
const jaw = MK.jawCoupling(); const jawG = new THREE.Group(); jawG.userData.spin = new THREE.Group(); jawG.add(jawG.userData.spin); jawG.userData.phys = jaw.phys;
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
const eS4 = shaftEl('s4', -4.06, -2.5, Y0, 0.12, 'Wał 4');   // koniec przed słupkiem podpory wału 5 (x −2,45)
{
  // ścianki z otworami i oprawkami; w nich łożyska kulkowe 6205-2RS (otwór 25 mm = wał) — wał przechodzi przez łożysko
  const B0 = MK.BEARINGS.ball, hs = MK.housing([0.6, 0.34, 0.22], { bores: [[Y0 - 0.935, 0, B0.D / 2], [YS3 - 0.935, 0, B0.D / 2]] }); hs.position.set(-4.1, 0.935, 0.12); root.add(hs); panes.push(hs.userData.panes);
  for (const [x, y] of [[-4.4, Y0], [-4.4, YS3], [-3.8, YS3], [-3.8, Y0]]) at(MK.rollingBearing({ type: 'ball', d: 0.025, seal: true, name: 'Łożysko 6205-2RS w ściance' }), x, y, 0.12);
  FX.gbFeet = []; for (const x of [-4.36, -3.84]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.3), M.alu); f.position.set(x, BED_TOP + 0.006, 0.12); f.castShadow = f.receiveShadow = true; root.add(f); FX.gbFeet.push(f); }
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
const fl = MK.flangeCoupling(); const flG = new THREE.Group(); flG.userData.spin = new THREE.Group(); flG.add(flG.userData.spin); flG.userData.phys = fl.phys;
flG.userData.spin.add(fl.a, fl.b, fl.bolts); at(flG, 0.03, Y0, 0.12); flG.name = 'Sprzęgło kołnierzowe';
const eFl = element('fl', 'Sprzęgło kołnierzowe', 'coupling', flG, { J: fl.J, props: [['Rodzaj', 'sztywne, kołnierzowe'], ['Śruby', '6 × M8, klasa 8.8'], ['Materiał', 'żeliwo'], ['Masa', `${fl.mass} kg`]], ports: [P('a', 'Kołnierz A'), P('b', 'Kołnierz B')] });
const eS7 = shaftEl('s7', 0.068, 1.05, Y0, 0.12, 'Wał 7');
block(0.3, Y0, 0.12); block(0.82, Y0, 0.12);
const BETA = 25 * Math.PI / 180, J1 = new THREE.Vector3(1.1, Y0, 0.12), DIR = new THREE.Vector3(Math.cos(BETA), 0, Math.sin(BETA)), LJ = 0.6, J2 = J1.clone().addScaledVector(DIR, LJ);
const Q8 = new THREE.Quaternion().setFromUnitVectors(X, DIR);
// widełki wału 7 (sworznie wzdłuż y przy kącie 0)
const YK = {}; { const y = MK.yoke(); y.position.x = J1.x - 0.068; eS7.spin.add(y); YK.a1 = y; }
// wał pośredni: od J1 do J2, widełki na obu końcach w jednej płaszczyźnie (sworznie wzdłuż lokalnego z)
const s8 = MK.shaft({ len: LJ - 0.1, r: 0.015, name: 'Wał przegubowy' }); s8.userData.spin.children.forEach((c) => { c.position.x += 0.05; });
s8.position.copy(J1); s8.quaternion.copy(Q8); root.add(s8);
{ const a = MK.yoke(); a.rotation.set(Math.PI / 2, Math.PI, 0); s8.userData.spin.add(a); const b = MK.yoke(); b.rotation.x = Math.PI / 2; b.position.x = LJ; s8.userData.spin.add(b); YK.b1 = a; YK.a2 = b; }
const eS8 = element('s8', 'Wał przegubowy', 'shaft', s8, { J: s8.userData.J + 0.0004, frame: { o: J1.clone(), axis: DIR.clone(), ref: Y.clone() },
  props: [['Średnica', '30 mm'], ['Długość między przegubami', `${LJ * 1000} mm`], ['Kąt łamania', '25°'], ['Układ', 'Z — widełki w jednej płaszczyźnie, wały 7 i 9 równoległe'], ['Uwaga', 'kręci się nierównomiernie (przegub Cardana); wał 9 — równo']], ports: [P('a', 'Przegub 1'), P('b', 'Przegub 2')] });
const eS9 = shaftEl('s9', J2.x + 0.05, 2.372, Y0, J2.z, 'Wał 9');   // wał zaczyna się w piaście widełek, nie w krzyżaku
{ const y = MK.yoke(); y.rotation.y = Math.PI; y.position.x = -0.05; eS9.spin.add(y); YK.b2 = y; }
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
    const nb = MK.rollingBearing({ type: 'needle', d: 0.008, name: 'Łożysko igiełkowe satelity' });   // sworzeń Ø 8 → igiełki → satelita
    const pl = MK.gear({ z: ZPL, m: MP, w: 0.018, mat: 'brass', hub: false, bore: nb.userData.D / 2, key: false, name: 'Satelita' }); pl.position.set(0, RC * Math.cos(k * TAU / 3), RC * Math.sin(k * TAU / 3));
    carrier.userData.spin.add(pl); planets.push(pl); nb.position.copy(pl.position); carrier.userData.spin.add(nb);
    const pin = new THREE.Mesh(MK.cyl(0.004, 0.06, 12), M.steel); pin.position.copy(pl.position); pin.position.x = 0.014; carrier.userData.spin.add(pin);
  }
  for (const x of [0.03, 0.045]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(RC + 0.016, RC + 0.016, 0.006, 48).rotateZ(Math.PI / 2), M.alu); d.position.x = x; d.castShadow = true; carrier.userData.spin.add(d); }
  // obudowa dłuższa od jarzma (sworznie −16 mm, tarcza +48 mm), w deklach łożyska 6205-2RS: wał słonecznego i wał wyjściowy
  const ths = MK.tubeHousing({ r: ring.userData.R + 0.012, len: 0.11, hole: MK.BEARINGS.ball.D / 2 }); ths.position.set(XP + 0.016, Y0, ZP); root.add(ths); panes.push(ths.userData.panes);
  for (const sx of [-1, 1]) (FX._pb = FX._pb || []).push(at(MK.rollingBearing({ type: 'ball', d: 0.025, seal: true, name: 'Łożysko 6205-2RS w deklu' }), XP + 0.016 + sx * 0.055, Y0, ZP));   // dekle: wał słonecznego i wał wyjściowy
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.05, Y0 - BED_TOP - ring.userData.R, 0.16), M.alu); stand.position.set(XP, BED_TOP + (Y0 - BED_TOP - ring.userData.R) / 2, ZP); stand.castShadow = true; root.add(stand);
  const sf = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.2), M.alu); sf.position.set(XP, BED_TOP + 0.004, ZP); sf.castShadow = true; root.add(sf);   // stopa podpory pod śruby
  FX.planet = { objs: [ring, ths, stand, sf, ...FX._pb], foot: sf };
}
const eCar = element('car', 'Przekładnia planetarna (jarzmo)', 'planetary', carrier, { J: 0.0012,
  props: [['Koło słoneczne', `${ZS} zęby`], ['Satelity', `3 × ${ZPL} zęby`], ['Koło koronowe', `${ZR} zęby, nieruchome`], ['Moduł', '2 mm'], ['Przełożenie', `i = 1 + ${ZR}/${ZS} = ${1 + ZR / ZS}`], ['Warunek montażu', `(${ZS} + ${ZR}) / 3 = ${(ZS + ZR) / 3} — całkowite`]],
  ports: [P('sun', 'Koło słoneczne (wejście)'), P('ring', 'Koło koronowe (stałe)', 'podparcie'), P('carrier', 'Jarzmo (wyjście)')] });
const eS10 = shaftEl('s10', XP + 0.048, 3.48, Y0, ZP, 'Wał wyjściowy');
block(2.62, Y0, ZP); block(3.22, Y0, ZP);
// hamulec tarczowy i tarcza z podziałką
const disc = MK.discBrake({ d: 0.2, t: 0.008, vents: 12 }); disc.position.set(2.92, Y0, ZP); root.add(disc);
{ // wspornik zacisku z łoża: słupek obok tarczy (od strony +x, poza jej grubością i promieniem wału) i ramię pod obudowę klocka
  const px = 2.92 + 0.03, top = Y0 + 0.0595;   // ramię pod obudową klocka (0,5 mm luzu)
  const brk = new THREE.Mesh(new THREE.BoxGeometry(0.03, top - BED_TOP, 0.03), M.dark); brk.position.set(px, BED_TOP + (top - BED_TOP) / 2, ZP + 0.07); brk.castShadow = true; root.add(brk);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.065), M.dark); arm.position.set(px, top - 0.006, ZP + 0.0525); arm.castShadow = true; root.add(arm);
  const bf = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.07), M.dark); bf.position.set(px, BED_TOP + 0.004, ZP + 0.07); bf.castShadow = true; root.add(bf);   // stopa wspornika pod śruby
  FX.brake = { objs: [brk, arm, bf], foot: bf };
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
  const pf = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.05), M.dark); pf.position.set(3.53, BED_TOP + 0.003, ZP); root.add(pf); FX.post = { objs: [post, ptr, pf], foot: pf };
}

/* ---------------- połączenia portów ---------------- */
// 8. zamiana ruchu (punkt 1 planu): korba na tarczy z podziałką → korbowód → suwak z listwą zębatą (ruch posuwisto-zwrotny)
//    → zębnik z = 16 na śrubie kulowej Ø 20 × 20 (wahadłowy obrót) → nakrętka z wózkiem (przesuw w obie strony)
const CR = { r: 0.05, l: 0.24, x: 3.505 }, ZM = ZP + CR.l;   // promień korby, długość korbowodu, płaszczyzna korbowodu, środek skoku suwaka
const crankPin = new THREE.Mesh(MK.cyl(0.006, 0.024, 20), M.steel); crankPin.position.set(3.5 - eS10.group.position.x, CR.r, 0); eS10.spin.add(crankPin);
const rod = MK.conRod({ l: CR.l }); root.add(rod);
const slG = MK.slider({ len: 0.07, w: 0.04, h: 0.03, travel: 0.12, rack: { m: 0.0015, n: 30, w: 0.012 } });
// suwak: lokalne y (ruch) → świat +z, lokalne z (góra) → świat +y, lokalne x → świat −x; sworzeń (lokalne −x) w płaszczyźnie korbowodu
slG.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)));
slG.position.set(CR.x + slG.userData.pin.x, Y0, ZM); root.add(slG);
{ const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, Y0 - 0.035 - BED_TOP, 0.18), M.iron); st.position.set(slG.position.x, BED_TOP + (Y0 - 0.035 - BED_TOP) / 2, ZM); st.castShadow = true; root.add(st);
  const sf = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.26), M.iron); sf.position.set(slG.position.x + 0.01, BED_TOP + 0.004, ZM); root.add(sf); FX.slider = { objs: [st, sf], foot: sf }; }   // podstawa prowadnicy (obok płyty podpory śruby, śruby poza słupkiem)
const ZB = { m: 0.0015, z: 16 }, RK = slG.userData.rack, YS = Y0 + RK.z + ZB.m * ZB.z / 2;   // oś śruby nad listwą: linia podziałowa + r_p zębnika
const scrG = at(MK.leadScrew({ d: 0.02, lead: 0.02, len: 0.47, kind: 'ball', thread: [0.06, 0.39] }), 2.97, YS, ZM);
const pinion = MK.gear({ z: ZB.z, m: ZB.m, w: 0.012, bore: 0.008, name: 'Zębnik z = 16' }); pinion.position.x = CR.x - 0.028 - 2.97; scrG.userData.spin.add(pinion);
{ const stub = new THREE.Mesh(MK.cyl(0.008, pinion.position.x - 0.47 + 0.006, 20), M.steel); stub.position.x = (0.47 + pinion.position.x) / 2; scrG.userData.spin.add(stub); }   // czop pod zębnik
scrG.userData.ports = { ...scrG.userData.ports, mesh: { name: 'Zębnik — zazębienie', domain: MK.DOMAIN.rot, iface: 'zazębienie' } };
for (const x of [3.0, 3.4]) at(MK.pillowBlock({ h: YS - BED_TOP, r: scrG.userData.rj }), x, BED_TOP, ZM);   // łożyska na czopach śruby
const nutG = at(MK.screwNut({ d: 0.02, lead: 0.02, kind: 'ball', hc: YS - BED_TOP, travel: 0.04 }), 3.2, YS, ZM);
const eSl = element('slider', 'Suwak z listwą zębatą', 'slider', slG, { frame: { o: new THREE.Vector3(CR.x, Y0, ZM), axis: new THREE.Vector3(0, 0, 1), ref: Y.clone() },
  props: [['Ruch', 'posuwisto-zwrotny, skok 2·r = 100 mm'], ['Korbowód', `${CR.l * 1000} mm, korba r = ${CR.r * 1000} mm`], ['Listwa', `m ${RK.m * 1000}, ${RK.n} zębów, ${fmt(RK.L * 1000, 0)} mm`], ['Prowadnica', 'toczna, dwie szyny'], ['Masa', mass(slG)]],
  ports: [P('pin', 'Sworzeń korbowodu', 'przesuw'), P('mesh', 'Listwa — zazębienie', 'przesuw')] });
const eScr = element('screw', 'Śruba kulowa Ø 20 × 20 z zębnikiem', 'screw', scrG, { J: scrG.userData.J + pinion.userData.J, frame: { o: new THREE.Vector3(2.97, YS, ZM), axis: X.clone(), ref: Y.clone() },
  props: [['Śruba', 'kulowa Ø 20, skok 20 mm, gwint prawy'], ['Zębnik', `z = ${ZB.z}, m ${ZB.m * 1000}`], ['Ruch', 'wahadłowy (od suwaka przez listwę)'], ['Sprawność śruby', `${fmt(scrG.userData.phys.eta * 100)} %`], ['Masa', mass(scrG)]],
  ports: [P('mesh', 'Zębnik — zazębienie'), P('thread', 'Gwint')] });
const eNut = element('nut', 'Nakrętka kulowa z wózkiem', 'nut', nutG, { frame: { o: new THREE.Vector3(3.2, YS, ZM), axis: X.clone(), ref: Y.clone() },
  props: [['Ruch', `przesuw ±${fmt(CR.r / (ZB.m * ZB.z / 2) * 0.02 / TAU * 1000, 1)} mm (skok śruby × obrót zębnika)`], ['Prowadnica', 'szyna z wózkiem — nakrętka się nie obraca'], ['Masa', mass(nutG)]],
  ports: [P('thread', 'Gwint nakrętki', 'przesuw')] });
const C = drive.connect;
C('motor', 'out', 'jaw', 'a', 'coupling'); C('jaw', 'b', 's1', 'a', 'coupling');
C('s1', 'b', 'g1', 'bore', 'shaft'); C('g1', 'mesh', 'g2', 'mesh', 'mesh', { za: 20, zb: 40 }); C('g2', 'bore', 's2', 'a', 'shaft');
C('s2', 'b', 'g3', 'bore', 'shaft'); C('g3', 'mesh', 'g4', 'mesh', 'mesh', { za: 16, zb: 48 }); C('g4', 'bore', 's3', 'a', 'shaft');
C('s3', 'b', 'g5', 'bore', 'shaft'); C('g5', 'mesh', 'g6', 'mesh', 'mesh', { za: 24, zb: 40 }); C('g6', 'bore', 's4', 'a', 'shaft');
// łańcuch: faza koła 2 z drogi łańcucha (gniazda pod rolkami)
C('s4', 'b', 'c1', 'bore', 'shaft'); C('c1', 'chain', 'c2', 'chain', 'chain', { za: 18, zb: 27, phase: chainPath.seat.phase2 }); C('c2', 'bore', 's5', 'a', 'shaft');
C('s5', 'b', 'pu1', 'bore', 'shaft'); C('pu1', 'belt', 'pu2', 'belt', 'belt', { za: 0.16, zb: 0.08 }); C('pu2', 'bore', 's6', 'a', 'shaft');
C('s6', 'b', 'fl', 'a', 'coupling'); C('fl', 'b', 's7', 'a', 'coupling');
C('s7', 'b', 's8', 'a', 'ujoint', { pinA: Y.clone(), pinB: new THREE.Vector3(0, 0, 1).applyQuaternion(Q8), phys: cross1.userData.phys });   // sprawność z kąta łamania (ujointEta)
C('s8', 'b', 's9', 'a', 'ujoint', { pinA: new THREE.Vector3(0, 0, 1).applyQuaternion(Q8), pinB: Y.clone(), phys: cross2.userData.phys });
C('s9', 'b', 'sun', 'bore', 'shaft'); C('sun', 'mesh', 'car', 'sun', 'planetary', { zs: ZS, zr: ZR, eta: ring.userData.phys.eta }); C('car', 'carrier', 's10', 'a', 'shaft');
C('s10', 'b', 'disc', 'shaft', 'shaft');
C('s10', 'b', 'slider', 'pin', 'crank', { r: CR.r, l: CR.l, a0: 0 });
slG.updateWorldMatrix(true, true);
C('slider', 'mesh', 'screw', 'mesh', 'rack', { m: RK.m, z: ZB.z, y0: RK.y0, origin: slG.localToWorld(new THREE.Vector3(0, 0, RK.z)) });
C('screw', 'thread', 'nut', 'thread', 'screw', { lead: scrG.userData.lead });
const solved = drive.solve('motor', 'disc');
if (!solved.ok) console.warn(T('Napęd zakleszczony', 'Drive jammed'), solved.conflicts);
if (solved.unreached.length) console.warn(T('Elementy bez połączenia', 'Unconnected elements'), solved.unreached.map((e) => e.name));
// faza korony: wrąb korony naprzeciw zęba satelity 0 (punkt styku na zewnątrz satelity, kąt 0)
const PLANET = MK.planetPhase(ZS, ZPL, ZR, 3);   // ten sam wzór co w MechKit.planetary
ring.userData.spin.rotation.x = PLANET.ring;

/* ---------------- obrazowanie kątów ---------------- */
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3();
function applyAngles() {
  for (const e of parts) if (e.dof === 'lin') e.slide.position[e.slideAxis] = e.theta; else if (e.spin) e.spin.rotation.x = e.theta;
  // korbowód: od sworznia korby (na tarczy) do sworznia suwaka
  rod.userData.pose(crankPin.getWorldPosition(_pa).setX(CR.x), _pb.set(CR.x, Y0, ZM + eSl.theta));
  // satelity: obrót względem jarzma z zazębienia ze słonecznym (Willis), położenie z jarzmem
  const ts = eSun.theta - eCar.theta;
  planets.forEach((pl, k) => { pl.userData.spin.rotation.x = PLANET.planet(k, ts); });
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
// jeden krok symulacji (pętla klatek i MechanicsApi.simulate)
function simStep(dt) {
  if (S.mode === 'workshop') { WS.step(dt); tickLiquids(dt); return; }   // warsztat: własny napęd z wstawionych części
  if (S.mode === 'machine') { drive.step(dt, { rpm: S.rpm, brake: S.brake }); applyAngles(); }
  else if (S.mode === 'physics') { ELEC.tick(dt); reg.api.tick(dt); const on = reg.api.powered && (reg.api.run || Math.abs(reg.api.f) > 0.05); phys.step(dt, { w0: reg.api.f * 4 * Math.PI / 4, brake: FX.brakeLoose() ? 0 : S.brake, on }); ELEC.power(phys.state.Tm, phys.state.omega, on); applyAngles(); }
  tickLiquids(dt);   // falowanie powierzchni cieczy (LiquidKit)
  if (S.mode !== 'items') { fixtureStep(dt); bearingStep(dt); CLOCK.step(dt); if (AUTO) AUTO.step(dt); STATIONS.forEach((st) => st.step(dt)); }   // silnik 4-biegunowy: ω_syn = 4π f / p
  else if (item) { itemTheta += S.spin * TAU / 60 * dt; item.update(itemTheta); if (item.tick) item.tick(dt); }
}
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  simStep(dt);
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
const dirOf = (w) => (Math.abs(w) < 1e-3 ? '—' : w > 0 ? '↺' : '↻');   // patrząc od +x wzdłuż osi
// prędkość i obciążenie elementu: obrót — obr/min i N·m, przesuw — mm/s, położenie i N
const speedTxt = (e, d = 1) => (e.dof === 'lin' ? `${fmt(e.omega * 1000, d)} mm/s · x ${fmt(e.theta * 1000, 1)} mm` : `${dirOf(e.omega)} ${fmt(Math.abs(rpmOf(e.omega)), d)} obr/min`);
const loadTxt = (T, e) => (e.dof === 'lin' ? `${fmt(T, 1)} N` : `${fmt(T, 1)} N·m`);
function stats() {
  if (S.mode === 'workshop') return;   // warsztat ma własne okno
  if (S.mode === 'items') { itemStats(); return; }
  if (S.mode === 'physics') { physStats(); return; }
  const st = drive.state;
  const rows = [['Silnik', `${fmt(rpmOf(st.omega))} obr/min`], ['Moment silnika', `${fmt(st.Tm, 1)} N·m`], ['Moc silnika', `${fmt(st.P)} W`], ['Moc na hamulcu', `${fmt(st.Pout || 0)} W`],
    ['Sprawność całkowita', `${fmt(eDisc.eta * 100, 1)} %`], ['Przełożenie całkowite', `${fmt(Math.abs(1 / (eDisc.r || 1e-9)), 2)} : 1`], ['Bezwładność zredukowana', `${fmt(st.Jeff * 1e4, 1)} kg·cm²`], ['Wyjście', `${fmt(rpmOf(eDisc.omega), 1)} obr/min, ${fmt(eDisc.T, 1)} N·m`]];
  if (typeof boltRows === 'function' && FIXT.length) boltRows(rows);
  CLOCK.rows(rows); if (AUTO) AUTO.rows(rows); STATIONS.forEach((st) => st.rows(rows));
  $('bDrive').replaceChildren(...rows.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: b })]));
  $('bList').replaceChildren(...[...parts, ...CLOCK.parts, ...(AUTO ? AUTO.parts : []), ...STATIONS.flatMap((st) => st.parts)].flatMap((e) => { const s = el('span', { textContent: e.name }); s.onclick = () => select(e); return [s, el('b', { textContent: `${speedTxt(e)} · ${loadTxt(e.T, e)}` })]; }));
  if (sel) showSel();
  perfRows([['Elementy', String(parts.length)], ['Połączenia', String(drive.edges.length)], ['Ogniwa łańcucha', String(CH.N)]]);
}

/* ---------------- wybór elementu ---------------- */
function select(e) { sel = e; selBox.setFromObject(e.group); selBox.visible = !!e; showSel(); }
function showSel() {
  const e = sel; if (!e) return;
  $('selName').textContent = tr(e.name);
  const rows = [...e.props, ['Prędkość', speedTxt(e)], [e.dof === 'lin' ? 'Siła przenoszona' : 'Moment przenoszony', loadTxt(e.T, e)], ['Moc', `${fmt(Math.abs(e.T * e.omega))} W`], ['Sprawność od silnika', `${fmt(e.eta * 100, 1)} %`]];
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
  const bh = ray.intersectObject(boltG, true)[0];   // śruba mocująca — odkręć / dokręć
  if (bh) { let o = bh.object; while (o && !o.userData.bolt) o = o.parent; if (o) { toggleBolt(o); return; } }
  const hits = ray.intersectObjects([...parts, ...CLOCK.parts, ...(AUTO ? AUTO.parts : []), ...STATIONS.flatMap((st) => st.parts)].map((p) => p.group), true);
  for (const h of hits) { let o = h.object; while (o && !o.userData.el) o = o.parent; if (o) { select(o.userData.el); return; } }
  sel = null; selBox.visible = false; $('selName').textContent = tr('Kliknij element maszyny'); $('selProps').replaceChildren(); $('selPorts').replaceChildren();
}

/* ---------------- kamera ---------------- */
const orbit = { target: new THREE.Vector3(-1.4, 0.9, 0.2), dist: 9, yaw: 0.25, pitch: 0.38 };
const CAMS = { 'Zegar': { t: [4.6, 1.3, 0.25], dist: 1.5, yaw: 0.2, pitch: 0.12 }, 'Wychwyt zegara': { t: [4.6, 1.537, 0.225], dist: 0.22, yaw: 0.25, pitch: 0.15 }, 'Cała maszyna': { t: [-1.4, 0.9, 0.2], dist: 9.5, yaw: 0.25, pitch: 0.4 }, 'Zębatki': { t: [-5.3, 0.9, 0.06], dist: 1.5, yaw: 0.7, pitch: 0.35 }, 'Przekładnia': { t: [-4.1, 0.95, 0.12], dist: 1.3, yaw: 0.35, pitch: 0.3 },
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
const ctlTarget = () => (S.mode === 'items' ? (item && item.controls ? [{ group: item.group, api: item.api }] : null) : S.mode === 'physics' ? [...ELEC.devices, ...CLOCK.devices, ...(AUTO ? AUTO.devices : []), ...STATIONS.flatMap((st) => st.devices)] : null);
function controlAt(e) {
  const tgs = ctlTarget(); if (!tgs) return null;
  const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(tgs.map((t) => t.group), true)[0]; let o = h && h.object; while (o && !o.userData.control) o = o.parent;
  if (!o) return null;
  const tg = tgs.find((t) => { for (let p = o; p; p = p.parent) if (p === t.group) return true; return false; });
  return tg ? { name: o.userData.control, api: tg.api } : null;
}
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  if (S.mode === 'workshop' && WS.onPointer('down', e)) return;
  const c = e.button === 0 ? controlAt(e) : null;
  if (c) { ctl = { name: c.name, api: c.api, y: e.clientY }; c.api.press(c.name); stats(); return; }
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
});
cv.addEventListener('pointermove', (e) => {
  if (S.mode === 'workshop' && WS.onPointer('move', e)) return;
  if (ctl) { ctl.api.drag(ctl.name, e.clientY - ctl.y); ctl.y = e.clientY; return; }
  if (!drag) { cv.classList.toggle('grab', !!controlAt(e)); return; } const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true; if (drag.moved) { orbit.yaw -= dx * 0.005; orbit.pitch = Math.max(0.02, Math.min(1.52, orbit.pitch + dy * 0.004)); } });
// przerwany gest (pointercancel — np. dotyk, utrata przechwycenia, okno w tle): sterowanie zawsze puszczone
function endPointer() { if (ctl) { ctl.api.release(ctl.name); ctl = null; stats(); } drag = null; }
cv.addEventListener('pointercancel', endPointer); cv.addEventListener('lostpointercapture', () => { if (ctl) endPointer(); }); addEventListener('blur', endPointer);
cv.addEventListener('pointerup', (e) => { if (S.mode === 'workshop' && WS.onPointer('up', e)) { drag = null; return; } if (ctl) { ctl.api.release(ctl.name); ctl = null; stats(); return; } const click = drag && !drag.moved; drag = null; if (click && e.button === 0 && S.mode !== 'items') pick(e); });
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
/* ---------------- punkt 5 — obwód elektryczny ---------------- */
// Zasilanie silnika jak w prawdziwej maszynie: źródło 3 × 400/230 V (TN-S) → wyłącznik główny Q1 → stycznik K1 →
// falownik (zadawanie z potencjometru R1, wejście AI 0–10 V) → silnik. Sterowanie stycznikiem 230 V: L1 → grzybek
// S0 (NC) → STOP S1 (NC) → START S2 (NO) ∥ styk pomocniczy K1 13-14 (podtrzymanie) → cewka K1 → N; lampka H1
// „praca” równolegle do cewki. Elementy obsługiwane na modelach; kable z prawdziwymi przekrojami i długościami.
const elecG = new THREE.Group(); elecG.visible = false; scene.add(elecG);
reg.api.reference('ai'); reg.api.control('terminal'); reg.api.power(false);   // falownik zasilany dopiero przez stycznik K1
const ELEC = (() => {
  const put = (g, x, y, z) => { g.position.set(x, y, z); elecG.add(g); return { group: g, api: g.userData.api, name: '' }; };
  const X0 = put(CK.powerSource({ kind: 'AC', volts: 400, phases: 3, amps: 16 }), -6.5, BED_TOP, 0.4);
  const Q1 = put(CK.switchUnit({ kind: 'main', poles: 3, amps: 25 }), -6.16, BED_TOP, 0.42);
  // płyta montażowa z szyną DIN i stycznikiem (stoi na łożu, front w +z)
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.01), M.steel); board.position.set(-6.0, BED_TOP + 0.1, 0.415); board.castShadow = true; elecG.add(board);
  const K1 = put(CK.contactor({ amps: 12, coil: '230AC', aux: '1NO' }), -6.0, BED_TOP + 0.06, 0.42);
  const S0 = put(CK.eStop(), -6.52, BED_TOP, 0.62);
  const S1 = put(CK.pushButton({ color: 'red', contact: 'NC' }), -6.42, BED_TOP, 0.62);
  const S2 = put(CK.pushButton({ color: 'green', contact: 'NO' }), -6.33, BED_TOP, 0.62);
  const H1 = put(CK.pilotLamp({ color: 'green', volts: '230AC' }), -6.24, BED_TOP, 0.62);
  const R1 = put(CK.potentiometer({ ohms: 10000, taper: 'lin' }), -6.14, BED_TOP, 0.62);
  const S3 = put(CK.selector({ positions: 'I-0-II', handle: 'long' }), -6.04, BED_TOP, 0.62);   // praca: I — w przód, 0 — stop, II — wstecz
  Object.assign(X0, { name: 'Zasilanie X0' }); Object.assign(Q1, { name: 'Wyłącznik główny Q1' }); Object.assign(K1, { name: 'Stycznik K1' });
  Object.assign(S0, { name: 'Grzybek S0' }); Object.assign(S1, { name: 'STOP S1' }); Object.assign(S2, { name: 'START S2' }); Object.assign(H1, { name: 'Lampka H1' }); Object.assign(R1, { name: 'Potencjometr R1' }); Object.assign(S3, { name: 'Przełącznik kierunku S3' });
  X0.api.press('power'); Q1.api.press('toggle');   // na starcie: zasilanie i wyłącznik główny włączone, stycznik czeka na START
  // kable: dławik z tyłu urządzenia (albo od dołu), przez łoże do drugiego urządzenia
  elecG.updateWorldMatrix(true, true); reg.group.updateWorldMatrix(true, true);
  const back = (g, dx = 0) => { const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3()); return { p: new THREE.Vector3(c.x + dx, BED_TOP + 0.025, b.min.z - 0.002), n: new THREE.Vector3(0, 0, -1) }; };
  const under = (g, dx = 0) => { const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3()); return { p: new THREE.Vector3(c.x + dx, b.min.y + 0.006, b.max.z - 0.012), n: new THREE.Vector3(0, -1, 0) }; };
  motorG.updateWorldMatrix(true, true);
  const mb = motorG.userData, tbox = { p: motorG.localToWorld(new THREE.Vector3(-0.15, mb.H + 0.11, 0.052)), n: new THREE.Vector3(0, 0, 1) };
  const cables = {};
  const lay = (key, A, B, o) => {
    const D0 = 0.012, a1 = A.p.clone().addScaledVector(A.n, 0.04), b1 = B.p.clone().addScaledVector(B.n, 0.04);
    const mid = a1.clone().lerp(b1, 0.5); mid.y = BED_TOP + D0 / 2;
    const pts = [A.p, a1, mid, b1, B.p];
    if (a1.y > BED_TOP + 0.03) pts.splice(2, 0, new THREE.Vector3(a1.x, BED_TOP + D0 / 2, a1.z).lerp(mid, 0.3));
    if (b1.y > BED_TOP + 0.03) pts.splice(pts.length - 2, 0, new THREE.Vector3(b1.x, BED_TOP + D0 / 2, b1.z).lerp(mid, 0.3));
    const c = CK.cable({ points: pts, ...o }); elecG.add(c); cables[key] = c; return c;
  };
  lay('W1', back(X0.group), back(Q1.group), { cores: 5, mm2: 2.5, color: 'black', name: 'W1 — zasilanie 5G2,5' });
  lay('W2', back(Q1.group, 0.02), under(K1.group, -0.012), { cores: 5, mm2: 2.5, color: 'black', name: 'W2 — Q1 → K1 5G2,5' });
  lay('W3', under(K1.group, 0.012), back(reg.group, 0.02), { cores: 4, mm2: 2.5, color: 'black', name: 'W3 — K1 → falownik 4G2,5' });
  lay('W4', back(reg.group, -0.02), tbox, { cores: 4, mm2: 1.5, color: 'orange', name: 'W4 — falownik → silnik 4G1,5 (ekranowany)' });
  lay('W5', back(S2.group), under(K1.group, 0), { cores: 5, mm2: 1, color: 'grey', name: 'W5 — sterowanie 5×1' });
  lay('W6', back(R1.group), back(reg.group, 0), { cores: 3, mm2: 0.5, color: 'grey', name: 'W6 — potencjometr 3×0,5' });
  lay('W7', back(S3.group), back(reg.group, -0.035), { cores: 4, mm2: 0.5, color: 'grey', name: 'W7 — praca / kierunek 4×0,5 (24 V DC)' });
  for (const [a, b] of [[S0, S1], [S1, S2], [S2, H1]]) lay(`J${a.name}`, back(a.group, 0.02), back(b.group, -0.02), { cores: 2, mm2: 1, color: 'grey', name: 'mostek w kasecie 2×1' });
  // lista połączeń (schemat)
  // dane elektryczne z urządzeń (userData.elec — ControlKit.ELEC, MechKit.MOTOR_ELEC); tu tylko schemat połączeń
  const eX = X0.group.userData.elec, eK = K1.group.userData.elec, eH = H1.group.userData.elec, eV = reg.group.userData.elec, eM = motorG.userData.elec;
  const c = createCircuit(), Rw = (k) => cables[k].userData.R, UF = eX.Uph;   // napięcie fazowe (400 / √3 = 230,9 V)
  c.source('X0', { L1: [UF, 0], L2: [UF, -120], L3: [UF, 120], N: [0, 0], PE: [0, 0] }, () => X0.api.on);
  for (const [f, t] of [['L1', '1'], ['L2', '3'], ['L3', '5'], ['N', 'N1'], ['PE', 'PE']]) c.wire(`X0:${f}`, `Q1:${t}`, { R: Rw('W1'), name: 'W1' });
  for (const [a, b] of [['1', '2'], ['3', '4'], ['5', '6']]) c.contact(`Q1:${a}`, `Q1:${b}`, () => Q1.api.on, 'Q1');
  c.wire('Q1:N1', 'Q1:N2', { name: 'Q1 N (bez rozłączania)' }).wire('Q1:PE', 'K1:PE', { R: Rw('W2'), name: 'W2' });
  for (const [f, t] of [['2', '1'], ['4', '3'], ['6', '5']]) c.wire(`Q1:${f}`, `K1:${t}`, { R: Rw('W2'), name: 'W2' });
  c.wire('Q1:N2', 'K1:N', { R: Rw('W2'), name: 'W2' });
  for (const [a, b] of [['1', '2'], ['3', '4'], ['5', '6'], ['13', '14']]) c.contact(`K1:${a}`, `K1:${b}`, () => K1.api.on, 'K1');
  c.wire('K1:14', 'K1:A1', { name: 'mostek K1 14–A1' }).wire('K1:A2', 'K1:N', { name: 'mostek K1 A2–N' });
  c.wire('K1:14', 'KT1:A1', { name: 'mostek K1 14 — KT1 A1' }).wire('KT1:A2', 'K1:N', { name: 'mostek KT1 A2 — N' });   // przekaźnik czasowy zasilany razem z cewką K1
  for (const [f, t] of [['2', 'L1'], ['4', 'L2'], ['6', 'L3']]) c.wire(`K1:${f}`, `VFD:${t}`, { R: Rw('W3'), name: 'W3' });
  c.wire('K1:1', 'S0:11', { R: Rw('W5'), name: 'W5 żyła 1' }).wire('S1:12', 'K1:13', { R: Rw('W5'), name: 'W5 żyła 2' }).wire('S2:14', 'K1:A1', { R: Rw('W5'), name: 'W5 żyła 3' }).wire('K1:N', 'H1:X2', { R: Rw('W5'), name: 'W5 żyła 4' });
  c.wire('S0:12', 'S1:11', { name: 'mostek' }).wire('S1:12', 'S2:13', { name: 'mostek' }).wire('S2:14', 'H1:X1', { name: 'mostek' });
  c.contact('S0:11', 'S0:12', () => S0.api.closed, 'S0').contact('S1:11', 'S1:12', () => S1.api.closed, 'S1').contact('S2:13', 'S2:14', () => S2.api.closed, 'S2');
  // sterowanie falownikiem 24 V DC (zasilacz wewnętrzny falownika, działa przy zasilonym falowniku): +24 V → S3 → DI1 / DI2
  c.source('VFD24', { P: [eV.supply, 0], COM: [0, 0] }, () => reg.api.powered);
  c.wire('VFD24:P', 'VFD:+24', { name: 'falownik +24 V' }).wire('VFD24:COM', 'VFD:COM', { name: 'falownik COM' });
  c.wire('VFD:+24', 'KT1:15', { name: 'falownik +24 V → KT1 15' }).contact('KT1:15', 'KT1:18', () => !!AUTO && AUTO.kt.state.closed, 'KT1').wire('KT1:18', 'S3:C', { R: Rw('W7'), name: 'W7 żyła 1' }).wire('S3:13', 'VFD:DI1', { R: Rw('W7'), name: 'W7 żyła 2' }).wire('S3:23', 'VFD:DI2', { R: Rw('W7'), name: 'W7 żyła 3' });
  c.contact('S3:C', 'S3:13', () => S3.api.pos === 'I', 'S3 I').contact('S3:C', 'S3:23', () => S3.api.pos === 'II', 'S3 II');
  c.load('DI1', ['VFD:DI1', 'VFD:COM'], { Un: eV.supply }).load('DI2', ['VFD:DI2', 'VFD:COM'], { Un: eV.supply });
  c.load('KT1', ['KT1:A1', 'KT1:A2'], { Un: 230 });
  c.load('K1', ['K1:A1', 'K1:A2'], { Un: eK.coilU }).load('H1', ['H1:X1', 'H1:X2'], { Un: eH.U }).load('VFD', ['VFD:L1', 'VFD:L2', 'VFD:L3'], { Un: eV.Uin });
  const st = { kOn: false, kT: 0, r: null, uK: 0, uH: 0, uV: 0, Pin: 0, I: 0, Im: 0, Uout: 0, Pel: 0, dU: 0 };
  const In = eM.In, Rline = Rw('W1') + Rw('W2') + Rw('W3');
  // co klatkę: obwód → stycznik (zadziała przy ≥ 85 % Un po 20 ms, odpada < 60 % Un), lampka, zasilanie falownika
  function tick(dt) {
    if (AUTO) AUTO.ktTick(dt, st.uKT || 0);   // przekaźnik czasowy: napięcie A1–A2 z poprzedniej klatki
    const r = c.solve(); st.r = r; st.uKT = r.U('KT1'); st.uK = r.U('K1'); st.uH = r.U('H1'); st.uV = r.U('VFD');
    if (!st.kOn) { st.kT = st.uK >= eK.pullIn * eK.coilU ? st.kT + dt : 0; if (st.kT >= eK.tClose) st.kOn = true; } else if (st.uK < eK.dropOut * eK.coilU) { st.kOn = false; st.kT = 0; }
    K1.api.coil(st.kOn); H1.api.power(st.uH / eH.U);
    const was = reg.api.powered; reg.api.power(st.uV >= 0.85 * eV.Uin); reg.api.ai(AUTO ? AUTO.aiOut(eV.aiMax * R1.api.ratio(), dt) : eV.aiMax * R1.api.ratio());
    const r2 = was === reg.api.powered ? r : c.solve();   // zasilanie falownika się zmieniło — jego 24 V też
    st.uDI1 = r2.U('DI1'); st.uDI2 = r2.U('DI2'); reg.api.inputs(st.uDI1 >= eV.diOn, st.uDI2 >= eV.diOn);   // wejście aktywne ≥ 15 V (IEC 61131-2, typ 1)
    for (const d of [X0, Q1, K1, S0, S1, S2, H1, R1, S3]) d.api.tick(dt);
  }
  // moce i prądy z momentu silnika (sprawność i cos φ silnika, sprawność, pobór jałowy i cos φ wejścia falownika — z danych urządzeń)
  function power(Tm, omega, on) {
    const Pm = Tm * omega, Pel = on ? (Pm >= 0 ? Pm / eM.eta : Pm * eM.eta) + eM.p0 * eM.kW * 1000 * Math.min(1, Math.abs(reg.api.f) / eM.f) : 0;
    st.Pel = Pel; st.Pin = reg.api.powered ? eV.standby + Math.max(0, Pel) / eV.eta : 0;
    st.I = st.uV > 1 ? st.Pin / (Math.sqrt(3) * st.uV * eV.pfIn) : 0;
    const Tn = motorG.userData.Tn || 7.4, k0 = eM.k0; st.Im = on ? In * Math.sqrt(k0 * k0 + (1 - k0 * k0) * Math.min(4, (Tm / Tn) ** 2)) : 0;
    st.Uout = on ? Math.min(eM.U, eM.U * Math.abs(reg.api.f) / eM.f) : 0; st.dU = Math.sqrt(3) * st.I * Rline;
  }
  return { X0, Q1, K1, S0, S1, S2, H1, R1, S3, devices: [reg, X0, Q1, K1, S0, S1, S2, H1, R1, S3], circuit: c, cables, st, tick, power, In, Rline };
})();
reg.name = 'Falownik';
// punkt 4 — bryły zderzeń zębów (wielokąty wypukłe z zarysu, ten sam co model) i strefa swobody zazębienia z nich:
// luz i jego zmienność wzdłuż przyporu wychodzą ze zderzeń zębów, nie ze wzoru (oba koła cieńsze o 0,04·m → ok. 0,08·m)
const isGear = (u) => u && u.z && u.m && u.rf && u.rb && !u.internal;
const ZONES = new Map();
// listwa (a, przesuw x) → zębnik (b, kąt θ): strefa z brył liczona jak dla koła z listwą (zębnik obraca się, listwa
// przesuwa — contact.js, slideB), potem przeliczona na C = θ − f⁻¹(x) wiązania suwak → śruba
function rackZone(e) {
  const g = e.rel.geom, f = (t) => g.x0 + g.s * g.rp * t;
  const hullsB = MK.rackHulls(RK.m, RK.n).map((q) => q.map(([y, z]) => [y + RK.y0, z + RK.z]));
  const z = meshZone({ hullsA: MK.toothHulls(ZB.z, ZB.m), hullsB, za: ZB.z, zb: RK.n, map: planeMap(scrG.userData.spin, slG.userData.slide, { slideB: 'y' }), rel: f, slideB: true, pitchB: g.p });
  ZONES.set('rack', { z, rp: g.rp });
  if (z.pen) console.warn(T(`Listwa z zębnikiem: zęby przenikają się w ${z.pen} z ${z.samples} położeń nominalnych`, `Rack with pinion: teeth interpenetrate in ${z.pen} of ${z.samples} nominal positions`));
  const k = -1 / (g.s * g.rp), tmp = {};
  return { zone: (x, out) => { z.zone((x - g.x0) / (g.s * g.rp), tmp); const a = tmp.lo * k, b = tmp.hi * k; out.lo = Math.min(a, b); out.hi = Math.max(a, b); return out; } };
}
function BACKLASH(e) {
  if (e.type === 'rack') return rackZone(e);
  if (e.type === 'ujoint') { const q = cross1.userData.phys; return 2 * q.clear / q.R; }   // luz łożysk igiełkowych krzyżaka (dwie pary czopów)
  if (e.type !== 'mesh') return 0;
  const ua = e.a.group && e.a.group.userData, ub = e.b.group && e.b.group.userData;
  if (!isGear(ua) || !isGear(ub) || !e.a.spin || !e.b.spin) return 0;
  const map = planeMap(e.a.spin, e.b.spin);
  if (!map.parallel) return (ua.phys.luz + ub.phys.luz) / ub.rp;   // osie nierównoległe — bez brył płaskich
  const z = meshZone({ hullsA: MK.toothHulls(ua.z, ua.m, { alpha: ua.alpha }), hullsB: MK.toothHulls(ub.z, ub.m, { alpha: ub.alpha }), za: ua.z, zb: ub.z, map, rel: e.rel });
  ZONES.set(`${ua.z}:${ub.z}`, { z, ua, ub });
  if (z.pen) console.warn(T(`Zazębienie ${ua.z} : ${ub.z}: zęby przenikają się w ${z.pen} z ${z.samples} położeń nominalnych`, `Gear mesh ${ua.z} : ${ub.z}: teeth interpenetrate in ${z.pen} of ${z.samples} nominal positions`));
  return z.pen ? (ua.phys.luz + ub.phys.luz) / ub.rp : z;
}
// punkt 2 — sztywności skrętne połączeń (N·m/rad kąta koła b) i tłumienie ζ:
//   wał: G·J_p / L (stal G = 80 GPa, J_p = π d⁴ / 32); gwiazda sprzęgła kłowego — wg twardości (katalog, wielkość 19);
//   zazębienie: sztywność zęba c ≈ 20 N/(mm·µm) × szerokość, sprowadzona na koło zasadnicze (k = c·b·r_b²);
//   łańcuch i pas: sztywność cięgna EA / L (łańcuch 08A ≈ 2 MN, pas SPA ≈ 40 kN na pas) × r²
// dane z części (userData.phys — MechKit.PHYS); tu tylko geometria połączenia (szerokość wspólna, odległość osi, promienie)
function STIFF(e) {
  const ua = e.a.group && e.a.group.userData, ub = e.b.group && e.b.group.userData, pa = ua && ua.phys, pb = ub && ub.phys;
  if (e.type === 'shaft' && e.a.type === 'shaft' && pa && pa.k) { const d = ua.r * 2; return { k: pa.k, zeta: pa.zeta, name: `${e.a.name} (Ø ${Math.round(d * 1000)}, ${Math.round(ua.len * 1000)} mm)` }; }
  if (e.type === 'coupling' && e.a.id === 'jaw' && pa) return { k: pa.k, zeta: pa.zeta, name: `Gwiazda sprzęgła kłowego ${pa.spider.replace('A', ' Sh A').replace('D', ' Sh D')}` };
  if (e.type === 'coupling') return pa && pa.k ? { k: pa.k, zeta: pa.zeta, name: e.a.name } : null;   // sztywność ma połączenie wychodzące ze sprzęgła; wejście (piasta na wale) — sztywno
  if (e.type === 'mesh' && pb) { const b = Math.min(ua.w, ub.w), rb = ub.rb || ub.rp * Math.cos(20 * Math.PI / 180); return { k: pb.c * b * rb * rb, zeta: pb.zeta, name: `Zazębienie ${ua.z} : ${ub.z}` }; }
  if (e.type === 'chain') { const q = chain.userData.phys; return { k: q.EA / CH.D * CH.R2 * CH.R2, zeta: q.zeta, name: 'Łańcuch 08A' }; }
  if (e.type === 'belt') { const q = belt.userData.phys, r = ub.rp || 0.04; return { k: q.EA / Math.hypot(YS5 - Y0, 0) * r * r, zeta: q.zeta, name: 'Pas klinowy SPA' }; }
  if (e.type === 'ujoint') { const q = cross1.userData.phys; return { k: q.k, zeta: q.zeta, name: 'Przegub Cardana' }; }
  if (e.type === 'planetary') { const q = ring.userData.phys; return { k: q.k, zeta: q.zeta, name: 'Przekładnia planetarna' }; }
  // zamiana ruchu: C liczone na b — listwa → zębnik (rad): k = c·b·r_p²; korba → suwak, śruba → nakrętka (m): sztywność osiowa
  if (e.type === 'rack') { const q = slG.userData.phys, rp = ZB.m * ZB.z / 2, b = Math.min(RK.w, pinion.userData.w); return { k: q.c * b * rp * rp, zeta: q.zeta, name: 'Listwa zębata z zębnikiem' }; }
  if (e.type === 'crank') { const q = rod.userData.phys; return { k: q.k, zeta: q.zeta, name: 'Korbowód' }; }
  if (e.type === 'screw') { const q = scrG.userData.phys; return { k: q.k, zeta: q.zeta, name: 'Śruba kulowa — nakrętka' }; }
  return null;   // wpust (koło na wale) — sztywno
}
// punkt 3 — pas klinowy: moment graniczny na małym kole (Euler–Eytelwein): F1/F2 = e^(μ'θ), μ' = μ / sin(β/2) (rowek 36°),
// F1 + F2 = 2·F0 (napięcie wstępne) → T_maks = 2·F0·r·(e^(μ'θ) − 1)/(e^(μ'θ) + 1); ślizg — tarcie kinetyczne 0,85 T_maks;
// pełzanie sprężyste do 1,5 % przy T_maks. Łańcuch — efekt wielokąta: prędkość cięgna v = ω·R·cos φ, φ ∈ [−π/z, π/z]
const BP = belt.userData.phys, BELT_F0 = BP.F0, BELT_MU = BP.mu, BELT_WRAP = Math.PI - 2 * Math.asin((0.08 - 0.04) / Math.hypot(YS5 - Y0, 0));
const BELT_MUE = BELT_MU / Math.sin(BP.groove / 2 * Math.PI / 180), BELT_E = Math.exp(BELT_MUE * BELT_WRAP), BELT_TMAX = 2 * BELT_F0 * 0.04 * (BELT_E - 1) / (BELT_E + 1);
function polygon(z) { const p = TAU / z, s2 = 2 * Math.sin(p / 2); return (t) => { const n = Math.floor(t / p), u = t - n * p; return n * p + p * (Math.sin(u - p / 2) + Math.sin(p / 2)) / s2; }; }
const MODIFY = (e) => { if (e.type !== 'chain') return null; const G = polygon(18), k = 18 / 27, r0 = e.rel; return (ta, tb) => r0(ta, tb) + k * (G(ta) - ta); };
const BELT = (e) => (e.type === 'belt' ? { Tmax: BELT_TMAX, kinetic: BP.kinetic, creep: BP.creep } : null);
// wpusty wałów tylko pod piastami: części połączone z wałem przez wpust lub sprzęgło (koła, tarcze, piasty sprzęgieł)
{
  const box3 = new THREE.Box3(), inv = new THREE.Matrix4();
  for (const e of parts) if (e.type === 'shaft' && e.group.userData.setKeys) {
    e.group.updateWorldMatrix(true, true); inv.copy(e.group.matrixWorld).invert(); const segs = [];
    for (const d of drive.edges) {
      if (d.type !== 'shaft' && d.type !== 'coupling') continue;
      const o = d.a === e ? d.b : d.b === e ? d.a : null; if (!o || o.type === 'shaft' || !o.group) continue;
      box3.setFromObject(o.spin || o.group).applyMatrix4(inv); segs.push([box3.min.x, box3.max.x]);
    }
    e.group.userData.setKeys(segs);
  }
}
const phys = createPhysics(drive, { motorId: 'motor', brakeId: 'disc', backlash: BACKLASH, stiffness: STIFF, modify: MODIFY, belt: BELT, bearing: MK.PHYS.bearing.drag });
function physStats() {
  const st = phys.state, f1 = (v) => fmt(v, 1), a = reg.api;
  const rows = [['Regulator', `${a.run ? 'RUN' : 'STOP'} · ${a.dir > 0 ? 'FWD' : 'REV'} · ${f1(Math.abs(a.f))} Hz (zadana ${f1(a.set)} Hz)`], ['Silnik', `${dirOf(st.omega)} ${fmt(Math.abs(rpmOf(st.omega)))} obr/min (synchr. ${fmt(Math.abs(30 * a.f))})`], ['Moment silnika', `${f1(st.Tm)} N·m`],
    ['Wyjście', `${dirOf(eDisc.omega)} ${f1(Math.abs(rpmOf(eDisc.omega)))} obr/min`], ['Moment hamulca', `${f1(Math.abs(st.Tb))} N·m`]];
  boltRows(rows);
  { const be = phys.edges.find((c) => c.belt), ch = phys.edges.find((c) => c.e.type === 'chain');
    if (be && Math.abs(be.da || 0) > 1e-4) rows.push(['Pas — rozstaw osi', `${fmt((be.da || 0) * 1000, 1)} mm → napięcie wstępne ${fmt(SUP.F0)} N (było ${BELT_F0} N), moment graniczny ${fmt(be.belt.Tmax, 1)} N·m`]);
    if (ch && (SUP.broken.chain || Math.abs(ch.da || 0) > 1e-4)) rows.push(['Łańcuch — rozstaw osi', SUP.broken.chain ? 'ŁAŃCUCH PRZESKOCZYŁ po zębach — napęd przerwany (Reset mocowań)' : `${fmt((ch.da || 0) * 1000, 1)} mm (przeskok przy −4 mm)`]);
    for (const c of SUP.broken.mesh) rows.push([`Zazębienie ${c.e.a.group.userData.z} : ${c.e.b.group.userData.z}`, `ZĘBY WYSZŁY Z PRZYPORU — koła rozsunięte o ${fmt((c.da || 0) * 1000, 1)} mm (Reset mocowań)`]); }
  // punkt 5 — obwód elektryczny
  { const E = ELEC, es = E.st, onoff = (v) => (v ? 'zamknięty' : 'otwarty');
    rows.push(['Zasilanie X0', `${E.X0.api.on ? 'WŁ' : 'WYŁ'} · 3 × 400/230 V, 50 Hz (TN-S)${es.r && es.r.shorts.length ? ` · ZWARCIE: ${es.r.shorts.join(', ')}` : ''}`]);
    rows.push(['Wyłącznik główny Q1', E.Q1.api.on ? 'I (załączony)' : '0 (wyłączony)']);
    rows.push(['Sterowanie 230 V', `S0 grzybek ${E.S0.api.latched ? 'WCIŚNIĘTY (styk otwarty)' : onoff(true)} · S1 STOP ${onoff(E.S1.api.closed)} · S2 START ${onoff(E.S2.api.closed)}`]);
    rows.push(['Stycznik K1', `${E.K1.api.on ? 'załączony' : 'wyłączony'}${E.K1.api.test ? ' (test ręczny)' : ''} · cewka ${fmt(es.uK)} V (zadziała ≥ ${fmt(E.K1.group.userData.elec.pullIn * E.K1.group.userData.elec.coilU)} V, odpada < ${fmt(E.K1.group.userData.elec.dropOut * E.K1.group.userData.elec.coilU)} V) · podtrzymanie 13-14 ${onoff(E.K1.api.on)}`]);
    rows.push(['Lampka H1', `${es.uH > E.H1.group.userData.elec.on * E.H1.group.userData.elec.U ? 'świeci' : 'zgaszona'} (${fmt(es.uH)} V)`]);
    rows.push(['Falownik — zasilanie', reg.api.powered ? `${fmt(es.uV)} V · pobór ${fmt(es.Pin)} W · ${fmt(es.I, 2)} A na fazę` : `bez zasilania (${fmt(es.uV)} V) — silnik wybiega`]);
    rows.push(['Praca / kierunek (S3 → DI)', `S3 w położeniu ${E.S3.api.pos} · DI1 (w przód) ${fmt(es.uDI1 || 0)} V, DI2 (wstecz) ${fmt(es.uDI2 || 0)} V · ${reg.api.run ? (reg.api.dir > 0 ? 'praca w przód' : 'praca wstecz') : !reg.api.armed && (reg.api.di[0] || reg.api.di[1]) ? 'BLOKADA — przestaw S3 na 0 (ochrona przed samoczynnym startem)' : 'stop'}`]);
    rows.push(['Zadawanie (R1 → AI)', `${fmt(reg.api.ain, 2)} V → ${fmt(reg.api.set, 1)} Hz (potencjometr 10 kΩ liniowy, 0–10 V = 0–50 Hz)`]);
    rows.push(['Silnik — zasilanie', es.Uout ? `${fmt(es.Uout)} V (U/f) · ${fmt(es.Im, 2)} A (znam. ${fmt(E.In, 2)} A) · ${fmt(es.Pel)} W` : 'bez napięcia']);
    rows.push(['Spadek napięcia W1–W3', `${fmt(es.dU * 1000, 1)} mV (${fmt(es.dU / 4, 4)} %) · ${fmt(E.Rline * 1000, 1)} mΩ na żyłę (2,5 mm² Cu, ${fmt(['W1', 'W2', 'W3'].reduce((a, k) => a + E.cables[k].userData.len, 0), 2)} m)`]);
  }
  // sprężyste połączenia: skręcenie (poza luzem) i moment — miękkie na liście (sztywność poniżej 10⁵ N·m/rad)
  for (const c of phys.edges) if (c.soft) rows.push([`Sprężystość: ${c.name}`, `${fmt(c.twist * 180 / Math.PI, 3)}° · ${fmt(Math.abs(c.T), 2)} N·m · k = ${fmt(c.k)} N·m/rad`]);
  // punkt 3: straty, pas, łańcuch
  const loss = phys.edges.reduce((a, c) => a + Math.abs(c.Tl * c.e.b.omega), 0);
  rows.push(['Straty tarcia w połączeniach', `${fmt(loss, 1)} W (sprawność ${fmt(st.P > 0.5 ? (st.Pout || 0) / st.P * 100 : 0, 1)} %)`]);
  // poślizg pasa mierzony jak na prawdziwym napędzie: s = 1 − ω₂ / (ω₁·d₁/d₂) (średnie prędkości z klatki) — pełzanie
  // sprężyste i poślizg całkowity (pas chwyta i zrywa się co kilkadziesiąt ms) w jednej liczbie
  for (const c of phys.edges) if (c.belt) {
    const w1 = c.e.a.omega, w2 = c.e.b.omega, sl = Math.abs(w1) > 1 ? 1 - w2 / (w1 * 0.16 / 0.08) : 0, full = sl > 0.05;
    rows.push(['Pas — poślizg', `${full ? 'POŚLIZG ' : ''}${fmt(sl * 100, 2)} %${full ? ' — pas ślizga się w rowku (moment graniczny przekroczony)' : ' — pełzanie sprężyste'} · moment ${fmt(Math.abs(c.T), 1)} N·m, graniczny ${fmt(c.belt.Tmax, 1)} N·m (napięcie 2 × ${BELT_F0} N, opasanie ${Math.round(BELT_WRAP * 180 / Math.PI)}°)`]);
  }
  for (const c of phys.edges) if (c.e.type === 'chain') rows.push(['Łańcuch — efekt wielokąta', `prędkość koła biernego waha się o ±${fmt((1 - Math.cos(Math.PI / 18)) * 50, 2)} % (z = 18)${Math.abs(c.e.a.omega) > 0.5 ? ` · teraz ${fmt(c.e.b.omega / c.e.a.omega * 27 / 18 * 100 - 100, 2)} %` : ''}`]);
  // przeguby Cardana: kąt, sprawność od kąta, luz łożysk krzyżaka, kolizje w obrocie i kąt graniczny
  { const q = cross1.userData.phys, eta = ujointEta(BETA, q);
    rows.push(['Przeguby Cardana', `β = ${fmt(BETA * 180 / Math.PI)}° · sprawność ${fmt(eta * 100, 2)} % na przegub · luz ${fmt(2 * q.clear / q.R * 180 / Math.PI, 3)}° · ${CARDAN.length ? `KOLIZJE: ${CARDAN.map((h) => `${h.name} przy ${h.at}°`).join('; ')}` : 'bez kolizji w obrocie'} · największy kąt łamania ${fmt(CARDAN_MAX.beta, 1)}°`]); }
  // zamiana ruchu: suwak (korbowód), zębnik na śrubie (listwa), nakrętka (gwint) — położenie, prędkość, siła w połączeniu
  { const ce = (t) => phys.edges.find((c) => c.e.type === t), cr = ce('crank'), rk = ce('rack'), sc = ce('screw');
    rows.push(['Suwak (korbowód)', `x ${fmt(eSl.theta * 1000, 1)} mm · ${fmt(eSl.omega * 1000, 0)} mm/s · siła w korbowodzie ${fmt(Math.abs(cr ? cr.T : 0), 1)} N`]);
    rows.push(['Zębnik na śrubie (listwa)', `${fmt(eScr.theta * 180 / Math.PI, 1)}° · ${speedTxt(eScr)} · moment ${fmt(Math.abs(rk ? rk.T : 0), 2)} N·m`]);
    rows.push(['Nakrętka (gwint)', `x ${fmt(eNut.theta * 1000, 2)} mm · ${fmt(eNut.omega * 1000, 1)} mm/s · siła osiowa ${fmt(Math.abs(sc ? sc.T : 0), 1)} N`]); }
  for (const c of phys.edges) if (c.dead && c.e.type === 'rack') {
    const Z = ZONES.get('rack'), mm = (x) => fmt(Math.abs(x) * Z.rp * 1000, 3);
    rows.push(['Luz listwa : zębnik', `z brył zębów ${mm(c.hi - c.lo)} mm (wzdłuż przyporu ${fmt(Z.z.width.min * 1000, 3)}–${fmt(Z.z.width.max * 1000, 3)}) · ${c.contact > 0 ? 'przylega flanką przednią' : c.contact < 0 ? 'przylega flanką tylną' : 'w luzie'}`]);
  }
  for (const c of phys.edges) if (c.dead && c.e.type === 'ujoint') {   // luz kątowy łożysk igiełkowych krzyżaka (bez zębów)
    rows.push([`Luz przegubu: ${c.e.a.name} → ${c.e.b.name}`, `${fmt((c.hi - c.lo) * 180 / Math.PI, 3)}° (łożyska igiełkowe krzyżaka) · ${c.contact > 0 ? 'czopy dociśnięte w przód' : c.contact < 0 ? 'czopy dociśnięte w tył' : 'w luzie'}`]);
  }
  for (const c of phys.edges) if (c.dead && c.e.type === 'mesh') {
    const ga = c.e.a.group.userData, gb = c.e.b.group.userData, Z = ZONES.get(`${ga.z}:${gb.z}`), mm = (x) => fmt(x * gb.rp * 1000, 3);
    const zone = Z ? `z brył zębów ${mm(c.hi - c.lo)} mm (wzdłuż przyporu ${mm(Z.z.width.min)}–${mm(Z.z.width.max)})` : `${fmt((ga.phys.luz + gb.phys.luz) * 1000, 2)} mm`;
    rows.push([`Luz ${ga.z} : ${gb.z}`, `${zone} · ${c.contact > 0 ? 'przylega flanką przednią' : c.contact < 0 ? 'przylega flanką tylną' : 'w luzie — zęby się nie dotykają'}`]);
  }
  // bryły zderzeń bez wiązania (co 0,5 s): satelity, rolki łańcucha; zahaczenia części obrotowych (raz, przy starcie)
  const now = performance.now();
  if (!LIVE || now - LIVE.t > 500) LIVE = { t: now, ...liveChecks() };
  const mmS = (x) => fmt(Math.abs(x) * 1000, 3);
  LIVE.planets.forEach((p, k) => rows.push([`Satelita ${k + 1} — zęby`, ['sun', 'ring'].map((key) => `${key === 'sun' ? 'ze słonecznym' : 'z koroną'} ${p[key].pen ? 'PRZENIKANIE' : `luz −${mmS(p[key].lo)} / +${mmS(p[key].hi)} mm`}`).join(' · ')]));
  for (const r of LIVE.rollers) rows.push([`Rolki łańcucha — ${r.name}`, `${r.near} rolek na kole · ${r.pen ? `PRZENIKANIE ${r.pen} rolek` : 'bez przenikania (zarys ISO 606: gniazdo, bok r_e, głowa)'}`]);
  rows.push(['Zahaczenia o obudowy i łożyska', CLASHES.length ? CLASHES.map((c) => `${c.part} × ${c.fixed} ${mmS(c.depth)} mm`).join('; ') : `brak (sprawdzone ${parts.filter((e) => e.spin).length} części obrotowych, dla każdego kąta)`]);
  CLOCK.rows(rows); if (AUTO) AUTO.rows(rows); STATIONS.forEach((st) => st.rows(rows));
  $('bDrive').replaceChildren(...rows.flatMap(([x, y]) => [el('span', { textContent: x }), el('b', { textContent: y })]));
  $('bList').replaceChildren(...[...parts, ...CLOCK.parts, ...(AUTO ? AUTO.parts : []), ...STATIONS.flatMap((st) => st.parts)].flatMap((e) => { const sp = el('span', { textContent: e.name }); sp.onclick = () => select(e); return [sp, el('b', { textContent: `${speedTxt(e)} · ${loadTxt(e.T, e)}` })]; }));
  if (sel) showSel();
  perfRows([['Stopnie swobody', String(phys.nodes.length)], ['Wiązania', String(phys.edges.length)], ['Zazębienia z luzem', String(phys.edges.filter((c) => c.dead).length)], ['Bryły zderzeń zębów', `${[...ZONES.values()].reduce((a, v) => a + (v.ua ? v.ua.z + v.ub.z : ZB.z + RK.n), 0)} wielokątów wypukłych (${ZONES.size} zazębienia)`]]);
}
// hitboksy z geometrii (ogólnie, bez ręcznych wymiarów): zębatka — bryły zderzeń zębów (wielokąty wypukłe z zarysu),
// walec stóp i walce piast; inna część obrotowa — walec wzdłuż osi (obraca się z częścią); część nieruchoma —
// prostopadłościan; siatki druciane rysowane przez wszystko
const hitG = new THREE.Group(); scene.add(hitG); hitG.visible = false;
const HM = { clash: new THREE.LineBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.95, depthTest: false }), spin: new THREE.LineBasicMaterial({ color: 0x4ad2ff, transparent: true, opacity: 0.85, depthTest: false }), fixed: new THREE.LineBasicMaterial({ color: 0xffc14a, transparent: true, opacity: 0.7, depthTest: false }) };
let hitItems = null;
// wierzchołki siatek poddrzewa w układzie części wirującej `sp` (bez poddrzew innych zębatek — mają własne bryły)
function eachVert(sp, fn, skipGears) {
  const inv = new THREE.Matrix4().copy(sp.matrixWorld).invert(), v = new THREE.Vector3(), gears = [];
  const walk = (o) => {
    if (skipGears && o !== sp && isToothed(o.userData) && o.userData.spin) { gears.push(o); return; }
    if (o.isMesh && !o.isInstancedMesh && o.geometry.attributes.position) { const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i += 3) fn(v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv)); }
    for (const c of o.children) walk(c);
  };
  walk(sp); return gears;
}
function cylLines(r, x0, x1) { const c = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(r, r, x1 - x0, 20, 1).rotateZ(-Math.PI / 2), 1), HM.spin); c.position.x = (x0 + x1) / 2; c.renderOrder = 20; return c; }
// bryły zębów części z zębami: zębatka, koło łańcuchowe (ząb podzielony na części wypukłe), koło koronowe (zęby
// wewnętrzne); każda część wypukła — obie ściany i krawędzie przy skrajnych punktach zęba
const isToothed = (u) => isGear(u) || (u && u.sprocket) || (u && u.internal);
function hullsOf(u) {
  if (u.sprocket) return MK.sprocketHulls(u.z, u.p, u.d1);
  if (u.internal) return MK.ringHulls(u.z, u.m);
  return MK.toothHulls(u.z, u.m, { alpha: u.alpha });
}
function gearHit(g) {
  const u = g.userData, sp = u.spin, h = u.w / 2, pts = [], holder = new THREE.Group();
  for (const t of hullsOf(u)) {
    const parts = Array.isArray(t) ? [t] : t.parts, all = parts.flat();
    for (const q of parts) for (const x of [-h, h]) for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; pts.push(x, a[0], a[1], x, b[0], b[1]); }
    const ang = (p) => Math.atan2(p[1], p[0]), c = ang(all.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0])), d = (p) => Math.atan2(Math.sin(ang(p) - c), Math.cos(ang(p) - c));
    const ext = [all.reduce((a, p) => (d(p) < d(a) ? p : a)), all.reduce((a, p) => (d(p) > d(a) ? p : a)), all.reduce((a, p) => (Math.hypot(...p) > Math.hypot(...a) ? p : a))];
    for (const p of ext) pts.push(-h, p[0], p[1], h, p[0], p[1]);
    hitStat.parts += parts.length;
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const teeth = new THREE.LineSegments(lg, HM.spin); teeth.renderOrder = 20; holder.add(teeth);
  if (u.internal) holder.add(cylLines(u.ra + 0.5 * u.m, -h, h), cylLines(u.R, -h, h));   // wieniec korony
  else holder.add(cylLines(u.sprocket ? u.R - u.rs : u.rf, -h, h));   // walec pod zębami
  sp.updateWorldMatrix(true, true);
  const side = { [-1]: { r: 0, x: 0 }, [1]: { r: 0, x: 0 } };
  eachVert(sp, (v) => { if (Math.abs(v.x) <= h + 1e-4) return; const s = side[Math.sign(v.x)]; s.r = Math.max(s.r, Math.hypot(v.y, v.z)); s.x = Math.max(s.x, Math.abs(v.x)); }, true);
  for (const sg of [-1, 1]) if (side[sg].r > 0) holder.add(cylLines(side[sg].r, sg < 0 ? -side[sg].x : h, sg < 0 ? -h : side[sg].x));
  hitG.add(holder); hitItems.push({ holder, src: sp }); hitStat.teeth += u.z; hitStat.gears++;
}
const hitStat = { teeth: 0, gears: 0, parts: 0 };
// rolki łańcucha — walce (Ø d₁, szerokość wewnętrzna), położenia z fazy łańcucha, odświeżane z obrazem
let rollHit = null;
function chainHit() {
  const N = chain.userData.N, r = chain.userData.d1 / 2, seg = 12, hw = 0.0039, pos = new Float32Array(N * seg * 3 * 2 * 2);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(lg, HM.spin); lines.renderOrder = 20; lines.frustumCulled = false; lines.matrixAutoUpdate = false;
  hitG.add(lines);
  rollHit = () => {
    chain.updateWorldMatrix(true, false); lines.matrix.copy(chain.matrixWorld);
    let k = 0; const put = (x, y, z) => { pos[k++] = x; pos[k++] = y; pos[k++] = z; };
    for (const [x, y, z] of chain.userData.rollers(chainPhase())) for (const sx of [-hw, hw]) for (let i = 0; i < seg; i++) {
      const a = i * TAU / seg, b = (i + 1) * TAU / seg; put(x + sx, y + r * Math.cos(a), z + r * Math.sin(a)); put(x + sx, y + r * Math.cos(b), z + r * Math.sin(b));
    }
    lg.attributes.position.needsUpdate = true;
  };
  rollHit();
}

/* ---------------- punkt 4 — kontrole brył zderzeń (statyczne i na żywo) ---------------- */
const chainPhase = () => eC1.theta * 18 / TAU;
// zderzenia par bez wiązania: satelity ze słonecznym i z koroną (położenia z modelu), rolki łańcucha z zębami kół
const HULL = { sun: hullsOf(eSun.group.userData), ring: hullsOf(ring.userData), pl: hullsOf(planets[0].userData) }, PL_RP = planets[0].userData.rp;
const ROLLER_POLY = (() => { const r = chain.userData.d1 / 2, q = []; for (let i = 0; i < 24; i++) q.push([r * Math.cos(i * TAU / 24), r * Math.sin(i * TAU / 24)]); return q; })();
const SPROCKETS = parts.filter((e) => e.group.userData.sprocket).map((e) => ({ e, hulls: hullsOf(e.group.userData), u: e.group.userData }));
function liveChecks() {
  const out = { planets: [], rollers: [] };
  // satelity: odstęp w obie strony od położenia z modelu (obrót satelity do dotyku), przenikanie
  for (const pl of planets) {
    const tp = pl.userData.spin.rotation.x, res = {};
    for (const [key, A, ta] of [['sun', eSun.spin, eSun.spin.rotation.x], ['ring', ring.userData.spin, ring.userData.spin.rotation.x]]) {
      const pair = contactPair({ hullsA: HULL[key], hullsB: HULL.pl, za: key === 'sun' ? ZS : ZR, zb: ZPL, map: planeMap(A, pl.userData.spin) });
      const pen = pair.hit(ta, tp);
      res[key] = pen ? { pen } : { pen, lo: pair.gap(ta, tp, -1) * PL_RP, hi: pair.gap(ta, tp, 1) * PL_RP };
    }
    out.planets.push(res);
  }
  // rolki łańcucha: wielokąt rolki w płaszczyźnie koła łańcuchowego, z częściami wypukłymi zębów (SAT)
  chain.updateWorldMatrix(true, false);
  const v = new THREE.Vector3(), inv = new THREE.Matrix4();
  for (const S of SPROCKETS) {
    // faza łańcucha przy tym kole z jego kąta (łańcuch sprężysty: cięgno się wydłuża, rolki leżą w gniazdach każdego koła)
    const R = chain.userData.rollers(S.e === eC1 ? chainPhase() : (S.e.theta - chainPath.seat.phase2) * S.u.z / TAU), sp = S.e.spin; sp.updateWorldMatrix(true, false); inv.copy(sp.matrixWorld).invert();
    let near = 0, pen = 0;
    for (const [x, y, z] of R) {
      v.set(x, y, z).applyMatrix4(chain.matrixWorld).applyMatrix4(inv);
      if (Math.hypot(v.y, v.z) > S.u.R + S.u.d1) continue;
      near++;
      const pair = contactPair({ hullsA: S.hulls, hullsB: [ROLLER_POLY], za: S.u.z, zb: 1, map: { a00: 1, a01: 0, a10: 0, a11: 1, tx: v.y, ty: v.z } });
      if (pair.hit(0, 0)) pen++;
    }
    out.rollers.push({ name: S.e.name, near, pen });
  }
  return out;
}
// części obrotowe a nieruchome (obudowy, łożyska, podpory, łoże): część obrotowa zakreśla bryłę obrotową — jej obrys
// promieniowy po osi (co 1 mm, z krawędzi trójkątów) nie zależy od kąta, więc kontrola raz wystarcza dla każdego
// położenia. Trójkąt części nieruchomej przecięty płaszczyzną x = środek przedziału daje odcinek; jego odległość od osi
// mniejsza niż obrys o więcej niż 0,05 mm = zahaczenie. Pomijane: łańcuch i pas (cięgna — kontrola rolek), koło
// koronowe (zęby — kontrola satelitów), krzyżaki przegubów (ruchome).
const CLASH = new Map(), CLASH_TOL = 0.00005;
let LIVE = null;
function interference() {
  const isPart = (o) => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.el) return true; return false; };
  const fixed = [];
  for (const o of root.children) if (!isPart(o) && !o.isLight && o.visible && o !== chain && o !== belt && o !== ring && o !== cross1 && o !== cross2 && o !== rod) fixed.push({ o, name: o.name || 'podpora' });
  for (const e of parts) for (const c of e.group.children) if (c !== e.spin && c !== e.slide) fixed.push({ o: c, name: `${e.name} — część stała` });
  for (const o of [reg.group, ...elecG.children]) fixed.push({ o, name: o.name || (ELEC.devices.find((d) => d.group === o) || {}).name || 'instalacja elektryczna' });
  elecG.updateWorldMatrix(true, true); reg.group.updateWorldMatrix(true, true);
  root.updateWorldMatrix(true, true);
  const res = [], inv = new THREE.Matrix4(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), q = [A, B, C];
  for (const e of parts) {
    const sp = e.spin; if (!sp) continue;
    inv.copy(sp.matrixWorld).invert();
    // obrys promieniowy części (z krawędzi trójkątów, liniowo po x)
    let x0 = Infinity, x1 = -Infinity;
    const tris = [];
    sp.traverse((o) => { if (!o.isMesh || o.isInstancedMesh) return; const g = o.geometry, pa = g.attributes.position, ix = g.index, n = ix ? ix.count : pa.count;
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < n; i += 3) { const t = []; for (let k = 0; k < 3; k++) { const v = new THREE.Vector3().fromBufferAttribute(pa, ix ? ix.getX(i + k) : i + k).applyMatrix4(m); t.push(v); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); } tris.push(t); } });
    if (!(x1 > x0)) continue;
    const BIN = 0.001, nb = Math.ceil((x1 - x0) / BIN) + 1, env = new Float64Array(nb);
    for (const t of tris) for (let k = 0; k < 3; k++) {
      const a = t[k], b = t[(k + 1) % 3], ra = Math.hypot(a.y, a.z), rb = Math.hypot(b.y, b.z);
      const i0 = Math.round((Math.min(a.x, b.x) - x0) / BIN), i1 = Math.round((Math.max(a.x, b.x) - x0) / BIN);
      for (let i = i0; i <= i1; i++) { const u = b.x === a.x ? 0 : Math.min(1, Math.max(0, (x0 + i * BIN - a.x) / (b.x - a.x))); env[i] = Math.max(env[i], ra + (rb - ra) * u); }
    }
    const rmax = Math.max(...env);
    for (const f of fixed) {
      let depth = 0;
      f.o.traverse((o) => { if (!o.isMesh || o.isInstancedMesh) return; const g = o.geometry, pa = g.attributes.position, ix = g.index, n = ix ? ix.count : pa.count;
        const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        for (let i = 0; i < n; i += 3) {
          for (let k = 0; k < 3; k++) q[k].fromBufferAttribute(pa, ix ? ix.getX(i + k) : i + k).applyMatrix4(m);
          const tx0 = Math.min(A.x, B.x, C.x), tx1 = Math.max(A.x, B.x, C.x);
          if (tx1 < x0 || tx0 > x1) continue;
          if (Math.min(A.y, B.y, C.y) > rmax || Math.max(A.y, B.y, C.y) < -rmax || Math.min(A.z, B.z, C.z) > rmax || Math.max(A.z, B.z, C.z) < -rmax) continue;
          const i0 = Math.max(0, Math.ceil((tx0 - x0) / BIN)), i1 = Math.min(nb - 1, Math.floor((tx1 - x0) / BIN));
          for (let bi = i0; bi <= i1; bi++) {
            if (!env[bi]) continue;
            const X = x0 + bi * BIN, P = [];
            for (let k = 0; k < 3; k++) { const a = q[k], b = q[(k + 1) % 3]; if ((a.x - X) * (b.x - X) <= 0 && a.x !== b.x) { const u = (X - a.x) / (b.x - a.x); P.push([a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u]); } }
            if (P.length < 2) continue;
            // odległość osi (początek układu) od odcinka P0–P1
            const [p0, p1] = P, dy = p1[0] - p0[0], dz = p1[1] - p0[1], L = dy * dy + dz * dz, u = L ? Math.max(0, Math.min(1, -(p0[0] * dy + p0[1] * dz) / L)) : 0;
            const d = Math.hypot(p0[0] + dy * u, p0[1] + dz * u), pen = env[bi] - d;
            if (pen > depth) depth = pen;
          }
        } });
      if (depth > CLASH_TOL) { res.push({ part: e.name, fixed: f.name, depth }); CLASH.set(f.o, Math.max(CLASH.get(f.o) || 0, depth)); }
    }
  }
  return res;
}
// przeguby Cardana: kolizje widełek i krzyżaków w pełnym obrocie wału 7 (bryły modeli, contact.js meshClash) — raz przy starcie
function cardanSweep(samples = 16) {
  const e1 = drive.edges.find((d) => d.type === 'ujoint' && d.a === eS7), e2 = drive.edges.find((d) => d.type === 'ujoint' && d.a === eS8), keep = [eS7.theta, eS8.theta, eS9.theta], hits = [];
  const P8 = new THREE.Vector3(0, 0, 1).applyQuaternion(Q8);
  for (let k = 0; k < samples; k++) {
    const t7 = k * TAU / samples, t8 = e1.rel(t7, eS8.theta), t9 = e2.rel(t8, eS9.theta);
    eS7.spin.rotation.x = t7; eS8.spin.rotation.x = t8; eS9.spin.rotation.x = t9; eS8.theta = t8; eS9.theta = t9;
    crossPose(cross1, Y, t7, X, P8, t8, DIR); crossPose(cross2, P8, t8, DIR, Y, t9, X); root.updateWorldMatrix(true, true);
    for (const [A, B, name] of [[YK.a1, YK.b1, 'przegub 1: widełki z widełkami'], [cross1, YK.a1, 'przegub 1: krzyżak z widełkami wału 7'], [cross1, YK.b1, 'przegub 1: krzyżak z widełkami wału przegubowego'],
      [YK.a2, YK.b2, 'przegub 2: widełki z widełkami'], [cross2, YK.a2, 'przegub 2: krzyżak z widełkami wału przegubowego'], [cross2, YK.b2, 'przegub 2: krzyżak z widełkami wału 9']]) {
      if (!hits.some((h) => h.name === name) && meshClash(A, B)) hits.push({ name, at: Math.round(t7 * 180 / Math.PI) });
    }
  }
  [eS7.theta, eS8.theta, eS9.theta] = keep; applyAngles();
  return hits;
}
const CARDAN = cardanSweep(), CARDAN_MAX = cardanMax();
// wiersz okna Opis: śruby i części luźne (z momentem reakcji — czy przewróci; bez — stoi)
function boltRows(rows) {
  const all = boltG.children.length, out = boltG.children.filter((b) => b.userData.target).length;
  rows.push(['Mocowania', `${all - out} ${T('z', 'of')} ${all} śrub dokręconych${out ? ' — kliknij śrubę, żeby ją dokręcić, albo „Reset mocowań”' : ' — kliknij śrubę, żeby ją odkręcić'}`]);
  for (const f of FIXT) {
    if (!f.loose && !f.phi && !(f.phys && f.bolts.some((b) => b.userData.target))) continue;
    if (!f.phys) {
      if (!f.loose) continue;
      let sp = null; for (const [, S0] of SUP.shafts) for (const q of S0.sup) if (q.fix === f) sp = q;
      if (!sp) { rows.push([`Luźna: ${f.name}`, 'stoi — nic jej nie obciąża']); continue; }
      const m = sp.obj.userData.mass || 1, N = m * G - sp.L.y, moved = sp.d.length();
      rows.push([`Luźna: ${f.name}`, `${moved > 0.0005 ? `PRZESUNIĘTA ${fmt(moved * 1000, 1)} mm${sp.d.y > 0.0005 ? ' (uniesiona)' : ''}` : 'stoi'} · siła z łożyska: w bok ${fmt(Math.abs(sp.L.z), 0)} N, w górę ${fmt(Math.max(0, sp.L.y), 0)} N · trzyma: tarcie ${fmt(Math.max(0, 0.2 * N), 0)} N, ciężar ${fmt(m * G, 0)} N`]);
      continue;
    }
    const P = f.phys, tl = f.tilt || 0, txt = P.axis && Math.abs(f.om) > 0.5 ? `OBRACA SIĘ na wałach (${fmt(Math.abs(f.om) * 60 / TAU)} obr/min) — ${P.what}` : tl > P.limit ? `${P.axis ? 'WYCHYLONA' : 'PRZEWRÓCONA'} ${fmt(tl * 180 / Math.PI, 1)}° — ${P.what}` : tl > 0 ? `przechyla się ${fmt(tl * 180 / Math.PI, 2)}°` : f.loose ? 'stoi' : `${f.bolts.filter((b) => !b.userData.target).length} śrub trzyma`;
    rows.push([`${f.loose ? 'Luźna' : 'Mocowanie'}: ${f.name}`, `${txt} · moment reakcji ${fmt(Math.abs(f.tau || 0), 1)} N·m, ciężar trzyma do ${fmt(P.axis ? P.m * G * P.d : (f.resist || P.m * G * P.b), 1)} N·m${S.mode === 'physics' ? '' : ' (siły — w trybie Fizyka)'}`]);
  }
}

/* ---------------- mocowania: śruby i luźne części ---------------- */
// Każda część stała stoi na łożu i trzyma się śrubami (MechKit.bolt, M6…M12, 8.8). Kliknięcie śruby — odkręca / dokręca;
// „Reset mocowań” — wszystkie z powrotem. Fizyka luźnych części (tryb Fizyka): część z momentem reakcji przewraca się
// wokół krawędzi podstawy, gdy moment przekroczy moment ciężaru m·g·b (b — odległość krawędzi od środka masy):
//   silnik — moment stojana −T_m (przewrócony > 3° rozłącza sprzęgło kłowe), wspornik zacisku — moment hamowania
//   (uniesiony > 2° — zacisk schodzi z tarczy), obudowa przekładni planetarnej — moment korony 0,75·T_jarzma
//   (> 1° — korona się obraca, jarzmo nie dostaje momentu). Ze śrubami trzyma tarcie złącza μ·F_p.
// Części bez momentu reakcji (oprawy łożysk, podpory) po odkręceniu stoją — sił promieniowych w łożyskach (pasy, łańcuch,
// rozpór zębów) fizyka jeszcze nie liczy.
const boltG = new THREE.Group(); root.add(boltG);
const FIXT = [];
function boltsOn(obj, list, d = 0.01, len = 0.03) {   // list: punkty lokalne obiektu (płaszczyzna pod łbem)
  obj.updateWorldMatrix(true, false);
  return list.map((m) => { const b = MK.bolt({ d: m.d || d, len }); b.position.copy(obj.localToWorld(m.p ? m.p.clone() : m.clone())); b.userData.home = b.position.clone(); b.userData.out = 0; b.userData.target = 0; b.userData.set = m.set || 'all'; boltG.add(b); return b; });
}
const cornerPts = (o, dx, dz) => { const g = o.geometry.parameters, y = g.height / 2; return [-1, 1].flatMap((sx) => [-1, 1].map((sz) => new THREE.Vector3(sx * (g.width / 2 - dx), y, sz * (g.depth / 2 - dz)))); };
function fixture(name, objs, bolts, phys = null) {
  const f = { name, objs, bolts, phys, phi: 0, om: 0, side: 0, base: objs.map((o) => ({ o, p: o.position.clone(), q: o.quaternion.clone() })) };
  for (const b of bolts) b.userData.fix = f;
  FIXT.push(f); return f;
}
{
  // oprawy łożysk i inne modele z miejscami śrub (userData.mounts)
  for (const o of root.children) if (o.userData.mounts && !o.userData.el) fixture(o.name || 'Oprawa łożyska', [o], boltsOn(o, o.userData.mounts, 0.01, 0.04));
  fixture('Nakrętka — szyna prowadnicy', [nutG], boltsOn(nutG, nutG.userData.mounts, 0.006, 0.02));
  // silnik na podstawie (4 śruby w łapach) — moment reakcji stojana
  const mU = motorG.userData;
  fixture('Silnik', [motorG], boltsOn(motorG, mU.mounts, 0.01, 0.03), { tau: () => -phys.state.Tm, m: mU.mass, b: 0.09, h: mU.H + 0.01, z: motorG.position.z, y: motorG.position.y, limit: 0.05,
    effect: (loose) => phys.setBroken((e) => e.type === 'coupling' && e.a.id === 'motor', loose), what: 'sprzęgło kłowe rozłączone' });
  fixture('Podstawa silnika', [FX.riser], boltsOn(FX.riser, cornerPts(FX.riser, 0.02, 0.02), 0.012, 0.04));
  FX.gbFeet.forEach((f, k) => fixture(`Stopa obudowy przekładni ${k + 1}`, [f], boltsOn(f, [new THREE.Vector3(0, 0.006, -0.135), new THREE.Vector3(0, 0.006, 0.135)], 0.008, 0.02)));
  // przekładnia planetarna: korona w obudowie na podporze — moment korony
  const pc = FX.planet, ringT = () => { const c = phys.edges.find((q) => q.e.type === 'planetary'); return c ? 0.75 * c.T * Math.sign(eCar.omega || 1) : 0; };
  // obudowa wisi na wałach (łożyska w deklach): luźna obraca się wokół osi wałów jak wahadło (podpora pod osią)
  fixture('Obudowa przekładni planetarnej', pc.objs, boltsOn(pc.foot, cornerPts(pc.foot, 0.012, 0.02), 0.008, 0.02), { axis: true, tau: ringT, m: 3.2, d: (Y0 - BED_TOP) * 0.45, b: 0, h: 0, z: ZP, y: Y0, limit: 0.017,
    effect: (loose) => phys.setBroken((e) => e.type === 'planetary', loose), what: 'korona się obraca — jarzmo bez momentu' });
  // wspornik zacisku hamulca (zacisk przechodzi na wspornik — obraca się z nim)
  const bc = FX.brake; for (const c of [...disc.children]) if (c !== disc.userData.spin) { root.attach(c); bc.objs.push(c); }
  let brakeLoose = false;
  fixture('Wspornik zacisku hamulca', bc.objs, boltsOn(bc.foot, cornerPts(bc.foot, 0.012, 0.012), 0.008, 0.02), { tau: () => phys.state.Tb, m: 1.6, b: 0.035, h: Y0 - BED_TOP, z: ZP + 0.07, y: BED_TOP, limit: 0.035,
    effect: (loose) => { brakeLoose = loose; }, what: 'zacisk zszedł z tarczy — hamulec nie działa' });
  FX.brakeLoose = () => brakeLoose;
  fixture('Podstawa prowadnicy suwaka', FX.slider.objs, boltsOn(FX.slider.foot, cornerPts(FX.slider.foot, 0.012, 0.015), 0.008, 0.02));
  fixture('Wskaźnik tarczy', FX.post.objs, boltsOn(FX.post.foot, cornerPts(FX.post.foot, 0.01, 0.01), 0.006, 0.015));
}
const G = 9.81;

/* ---------------- siły promieniowe w łożyskach i luźne oprawy ---------------- */
// Siły na kołach z fizyki napędu (moment w połączeniu c.T): zazębienie — obwodowa F_t = T / r_p i rozpór F_r = F_t·tg 20°
// (odpycha koła od siebie), łańcuch — cięgno czynne T / R ciągnie koła ku sobie, pas — 2·F0 (napięcie wstępne)
// ciągnie koła ku sobie; do tego ciężar wału i kół. Siła na kole przechodzi na łożyska jego wału (dźwignia między dwoma
// najbliższymi podporami). Oprawa luźna: trzyma ją ciężar i tarcie o łoże (μ = 0,2); siła większa — przesuwa się
// (albo unosi, gdy ciągnie w górę mocniej, niż waży), a z nią wał i koła. Skutki: pas — mniejszy rozstaw osi zmniejsza
// napięcie (EA·2Δa / L), a z nim moment graniczny (poślizg); łańcuch — luz cięgna ponad 4 mm — przeskakuje po zębach;
// zazębienie — rozsunięcie ponad 1,2·m — zęby wychodzą z przyporu.
const SUP = (() => {
  const shaftOf = new Map();   // element (koło) → wał, na którym siedzi
  for (const d of drive.edges) if (d.type === 'shaft') { const [sh, o] = d.a.type === 'shaft' ? [d.a, d.b] : d.b.type === 'shaft' ? [d.b, d.a] : [null, null]; if (sh && o.type !== 'shaft' && !shaftOf.has(o)) shaftOf.set(o, sh); }
  const shafts = new Map();   // wał → { supports: [{ x, fix | null, obj }], mass }
  const axisX = (e, P) => P.clone().sub(e.frame.o).dot(e.frame.axis), off = (e, P) => { const v = P.clone().sub(e.frame.o); return v.addScaledVector(e.frame.axis, -v.dot(e.frame.axis)).length(); };
  const cands = [];
  for (const f of FIXT) { const o = f.objs[0]; if (!f.phys && o.userData.mounts && o.userData.h) cands.push({ fix: f, obj: o, P: o.position.clone().add(new THREE.Vector3(0, o.userData.h, 0)) }); }
  for (const o of root.children) if (/^Łożysko 6205/.test(o.name || '')) cands.push({ fix: null, obj: o, P: o.position.clone() });
  for (const e of parts) if (e.type === 'shaft' && e.group.userData.len) {
    const L = e.group.userData.len, sup = cands.filter((c) => off(e, c.P) < 0.004 && axisX(e, c.P) > -0.01 && axisX(e, c.P) < L + 0.01).map((c) => ({ ...c, x: axisX(e, c.P), d: new THREE.Vector3(), v: new THREE.Vector3(), L: new THREE.Vector3() }));
    if (sup.length) { shafts.set(e, { sup, mass: e.group.userData.mass || 0 }); sup.filter((q) => q.fix).sort((p, q) => p.x - q.x).forEach((q, k) => { q.fix.name = `Oprawa łożyska ${k + 1} — ${e.name}`; }); }
  }
  for (const [o, sh] of shaftOf) { const S0 = shafts.get(sh); if (S0) S0.mass += o.group.userData.mass || 0; }
  // grupy przesuwane z wałem (wał, koła na nim) — położenia bazowe
  const movers = new Map();
  for (const [sh] of shafts) movers.set(sh, [sh, ...[...shaftOf].filter(([, s2]) => s2 === sh).map(([o]) => o)].map((el) => ({ el, p: el.group.position.clone(), x: axisX(sh, el.group.position) })));
  const belt0 = { F0: BELT_F0, L: belt.userData.L || 1.2 };
  return { shaftOf, shafts, movers, axisX, belt0, broken: { chain: false, mesh: new Set() }, F0: BELT_F0 };
})();
const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _t = new THREE.Vector3();
function bearingStep(dt) {
  if (S.mode !== 'physics') return;
  for (const [, S0] of SUP.shafts) for (const sp of S0.sup) sp.L.set(0, 0, 0);
  // siła na kole → łożyska jego wału (dźwignia), w płaszczyźnie ⟂ osi
  const apply = (el, F) => {
    const sh = SUP.shaftOf.get(el), S0 = sh && SUP.shafts.get(sh); if (!S0) return;
    const sup = S0.sup, x = SUP.axisX(sh, el.group.position);
    if (sup.length === 1) { sup[0].L.add(F); return; }
    const srt = [...sup].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x)), [p1, p2] = srt;
    const w2 = (x - p1.x) / ((p2.x - p1.x) || 1e-9); p1.L.addScaledVector(F, 1 - w2); p2.L.addScaledVector(F, w2);
  };
  const posOf = (el) => el.group.position;
  for (const c of phys.edges) {
    if (c.broken) continue;
    const A = c.e.a, B = c.e.b, T = c.T || 0;
    if (c.e.type === 'mesh') {
      const ub = B.group.userData; _u.subVectors(posOf(B), posOf(A)); _u.x = 0; _u.normalize(); _t.crossVectors(X, _u).negate();
      const Ft = T / ub.rp; _f.copy(_t).multiplyScalar(Ft).addScaledVector(_u, Math.abs(Ft) * Math.tan(20 * Math.PI / 180)); apply(B, _f.clone()); apply(A, _f.clone().negate());
    } else if (c.e.type === 'chain' || c.e.type === 'belt') {
      _u.subVectors(posOf(B), posOf(A)); _u.x = 0; _u.normalize();
      const F = c.e.type === 'chain' ? Math.abs(T) / (B.group.userData.R || 0.05) : 2 * SUP.F0;
      apply(A, _u.clone().multiplyScalar(F)); apply(B, _u.clone().multiplyScalar(-F));
    }
  }
  // ciężar wału z kołami — po połowie na skrajne podpory
  for (const [, S0] of SUP.shafts) { const w = S0.mass * G / S0.sup.length; for (const sp of S0.sup) sp.L.y -= w; }
  // luźne oprawy: ruch pełzający (tłumienie C_D — tarcie i opory przesuwu duże w stosunku do mas): v = F_wypadkowa / C_D,
  // F_wypadkowa = siła z łożyska + ciężar oprawy, na łożu pomniejszona o tarcie μ·N (μ = 0,2); wał przesuwa się za podporami
  const MU = 0.2, C_D = 4000, n = 6, h = dt / n;
  for (const [sh, S0] of SUP.shafts) {
    for (const sp of S0.sup) {
      if (!sp.fix || !sp.fix.loose) { sp.d.set(0, 0, 0); sp.v.set(0, 0, 0); continue; }
      const mb = sp.obj.userData.mass || 1;
      for (let k = 0; k < n; k++) {
        const Fy = sp.L.y - mb * G;
        if (sp.d.y <= 1e-6 && Fy <= 0) { const fr = MU * -Fy; sp.v.set(0, 0, Math.abs(sp.L.z) > fr ? (sp.L.z - fr * Math.sign(sp.L.z)) / C_D : 0); }   // leży: tarcie
        else sp.v.set(0, Fy / C_D, sp.L.z / C_D);   // uniesiona: bez tarcia
        sp.d.addScaledVector(sp.v, h); if (sp.d.y < 0) sp.d.y = 0; sp.d.clampLength(0, 0.05);
      }
    }
    // położenia: oprawa, wał i koła (interpolacja przesunięcia po osi między podporami)
    const sup = S0.sup, dAt = (x) => { if (sup.length === 1) return sup[0].d; const srt = [...sup].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x)), [p1, p2] = srt, w = (x - p1.x) / ((p2.x - p1.x) || 1e-9); return p1.d.clone().multiplyScalar(1 - w).addScaledVector(p2.d, w); };
    for (const sp of sup) if (sp.fix) { const b0 = sp.fix.base[0]; sp.obj.position.copy(b0.p).add(sp.d); }
    for (const mv of SUP.movers.get(sh)) mv.el.group.position.copy(mv.p).add(mv.el.type === 'shaft' ? dAt((sup[0].x + sup[sup.length - 1].x) / 2) : dAt(mv.x));
  }
  // skutki: rozstaw osi pasa, łańcucha i zazębień z przesunięć kół
  const shift = (el) => el.group.position.clone().sub(SUP.movers.get(SUP.shaftOf.get(el)) ? SUP.movers.get(SUP.shaftOf.get(el)).find((q) => q.el === el).p : el.group.position);
  for (const c of phys.edges) {
    const A = c.e.a, B = c.e.b; if (!['mesh', 'chain', 'belt'].includes(c.e.type)) continue;
    _u.subVectors(B.group.position, A.group.position); _u.x = 0; const a1 = _u.length();
    const da = shift(B).sub(shift(A)); da.x = 0; const a0 = _u.clone().sub(da).length(), dA = a1 - a0;
    c.da = dA;
    if (c.e.type === 'belt') { SUP.F0 = Math.max(0, BELT_F0 + BP.EA * 2 * dA / SUP.belt0.L); const E = Math.exp(BELT_MUE * BELT_WRAP); c.belt.Tmax = 2 * SUP.F0 * 0.04 * (E - 1) / (E + 1); }
    if (c.e.type === 'chain' && dA < -0.004 && !SUP.broken.chain) { SUP.broken.chain = true; phys.setBroken((e) => e.type === 'chain', true); }
    if (c.e.type === 'mesh' && dA > 1.2 * B.group.userData.m && !SUP.broken.mesh.has(c)) { SUP.broken.mesh.add(c); c.broken = true; }
  }
}
function bearingReset() {
  for (const [sh, S0] of SUP.shafts) { for (const sp of S0.sup) { sp.d.set(0, 0, 0); sp.v.set(0, 0, 0); } for (const mv of SUP.movers.get(sh)) mv.el.group.position.copy(mv.p); }
  SUP.F0 = BELT_F0; for (const c of phys.edges) if (c.belt) c.belt.Tmax = BELT_TMAX;
  if (SUP.broken.chain) phys.setBroken((e) => e.type === 'chain', false);
  for (const c of SUP.broken.mesh) phys.setBroken((e) => e === (c.e.base || c.e), false);
  SUP.broken.chain = false; SUP.broken.mesh.clear();
}
// odkręcenie / dokręcenie śruby (animacja: obrót i wysunięcie na długość gwintu)
function toggleBolt(b) { b.userData.target = b.userData.target ? 0 : 1; }
function resetBolts() {
  for (const b of boltG.children) { b.userData.target = 0; b.userData.out = 0; b.position.copy(b.userData.home); b.rotation.set(0, 0, 0); }
  bearingReset();
  for (const f of FIXT) { f.phi = 0; f.om = 0; f.side = 0; f.tilt = 0; for (const s0 of f.base) { s0.o.position.copy(s0.p); s0.o.quaternion.copy(s0.q); } if (f.phys) f.phys.effect(false); }
  stats();
}
const _R = new THREE.Quaternion(), _v = new THREE.Vector3(), XA = new THREE.Vector3(1, 0, 0);
function fixtureStep(dt) {
  for (const b of boltG.children) {   // animacja śrub
    const u = b.userData; if (u.out === u.target) continue;
    u.out = u.target ? Math.min(1, u.out + dt * 1.5) : Math.max(0, u.out - dt * 1.5);
    b.position.copy(u.home); b.position.y += u.out * (u.len + 0.004); b.rotation.y = -u.out * TAU * (u.len / 0.0015) / 6;   // gwint 1,5 mm — obroty skrócone ×6
  }
  for (const f of FIXT) {
    // luźna, gdy odkręcony jest cały jeden zestaw śrub (np. oprawa od słupka albo słupek od łoża)
    const sets = new Set(f.bolts.map((b) => b.userData.set)), loose = [...sets].some((st) => f.bolts.filter((b) => b.userData.set === st).every((b) => b.userData.target === 1 && b.userData.out === 1));
    f.loose = loose;
    if (!f.phys) continue;
    const P = f.phys, tau = S.mode === 'physics' ? P.tau() : 0, resist = P.axis ? 0 : P.m * G * P.b;
    f.tau = tau; f.resist = resist;
    if (!loose && f.phi === 0 && !f.om) continue;
    if (P.axis) {   // wahadło na osi wałów: I·φ'' = τ − m·g·d·sin φ − tłumienie łożysk; obraca się bez końca, gdy τ > m·g·d
      const I = P.m * (P.d * P.d * 1.5 + 0.004), n = 8, h = dt / n;
      for (let k = 0; k < n; k++) { const tq = (loose ? tau : 0) - P.m * G * P.d * Math.sin(f.phi) - 0.05 * f.om; f.om += tq / I * h; f.phi += f.om * h; }
      if (!loose) { const back = Math.round(f.phi / TAU) * TAU; if (Math.abs(f.phi - back) < 0.002 && Math.abs(f.om) < 0.05) { f.phi = 0; f.om = 0; } }
      _R.setFromAxisAngle(XA, f.phi);
      for (const s0 of f.base) { _v.copy(s0.p); _v.y -= P.y; _v.z -= P.z; _v.applyQuaternion(_R); s0.o.position.set(_v.x, _v.y + P.y, _v.z + P.z); s0.o.quaternion.copy(_R).multiply(s0.q); }
      for (const b of f.bolts) { b.position.copy(b.userData.home).add(new THREE.Vector3(0, b.userData.out * (b.userData.len + 0.004), 0)); if (b.userData.out < 1) { _v.copy(b.position); _v.y -= P.y; _v.z -= P.z; _v.applyQuaternion(_R); b.position.set(_v.x, _v.y + P.y, _v.z + P.z); } }
      const ang = Math.abs(Math.atan2(Math.sin(f.phi), Math.cos(f.phi)));
      P.effect(ang > P.limit || Math.abs(f.om) > 0.5); f.tilt = ang;
      continue;
    }
    // przewracanie wokół krawędzi: I·φ'' = τ − m·g·(b·cos φ − h·sin φ); I ≈ m·(b² + h²)·1,2 (bryła)
    const I = P.m * (P.b * P.b + P.h * P.h) * 1.2, n = 8, h = dt / n;
    if (f.phi === 0) { if (!loose || Math.abs(tau) <= resist) continue; f.side = Math.sign(tau); }
    for (let k = 0; k < n; k++) {
      const a = Math.abs(f.phi), tq = (loose ? f.side * tau : 0) - P.m * G * (P.b * Math.cos(a) - P.h * Math.sin(a));
      f.om += tq / I * h; f.phi = Math.max(0, Math.min(Math.PI / 2, a + f.om * h)) * 1;
      if (f.phi <= 0) { f.phi = 0; f.om = Math.abs(f.om) > 0.3 ? -f.om * 0.2 : 0; if (!f.om) break; }   // opada na stopę (odbicie 0,2)
      if (f.phi >= Math.PI / 2) { f.phi = Math.PI / 2; f.om = 0; }   // leży na boku
    }
    // położenie: obrót wokół krawędzi podstawy (oś x przez punkt (·, y, z ± b))
    const ang = f.side * f.phi, pz = P.z + f.side * P.b, py = P.y;
    _R.setFromAxisAngle(XA, ang);
    for (const s0 of f.base) { _v.copy(s0.p); _v.y -= py; _v.z -= pz; _v.applyQuaternion(_R); s0.o.position.set(_v.x, _v.y + py, _v.z + pz); s0.o.quaternion.copy(_R).multiply(s0.q); }
    for (const b of f.bolts) b.position.copy(b.userData.home).add(new THREE.Vector3(0, b.userData.out * (b.userData.len + 0.004), 0));
    P.effect(f.phi > P.limit); f.tilt = f.phi;
  }
}
if (CARDAN.length) console.warn(`Przeguby Cardana: kolizje — ${CARDAN.map((h) => `${h.name} przy ${h.at}°`).join('; ')}`);
const t0Clash = performance.now(), CLASHES = interference();
console.info(tr(`Kontrola zahaczeń: ${CLASHES.length ? CLASHES.map((c) => `${c.part} × ${c.fixed} ${(c.depth * 1000).toFixed(2)} mm`).join('; ') : 'brak'}`) + ` (${Math.round(performance.now() - t0Clash)} ms)`);

function buildHit() {
  hitItems = [];
  for (const e of parts) {   // walec: zasięg wzdłuż osi (x lokalne) i największy promień w płaszczyźnie (y, z) części wirującej
    if (isToothed(e.group.userData) && e.spin) { gearHit(e.group); continue; }
    if (e.dof === 'lin') {   // część przesuwna: prostopadłościan w układzie wózka (przesuwa się z nim)
      e.slide.updateWorldMatrix(true, true); const bb = new THREE.Box3(); eachVert(e.slide, (v) => bb.expandByPoint(v), false);
      const bx = new THREE.Box3Helper(bb, 0x4ad8ff); bx.material = HM.spin; bx.renderOrder = 20; const holder = new THREE.Group(); holder.add(bx); hitG.add(holder); hitItems.push({ holder, src: e.slide }); continue;
    }
    const sp = e.spin || e.group; sp.updateWorldMatrix(true, true);
    let x0 = Infinity, x1 = -Infinity, r = 0;
    const gears = eachVert(sp, (v) => { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); r = Math.max(r, Math.hypot(v.y, v.z)); }, true);
    for (const g of gears) gearHit(g);
    if (!(x1 > x0)) continue;
    const holder = new THREE.Group(); holder.add(cylLines(r, x0, x1)); hitG.add(holder); hitItems.push({ holder, src: sp });
  }
  const isPart = (o) => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.el) return true; return false; };
  for (const o of root.children) {   // nieruchome: łożyska, obudowy, silnik (korpus), podpory, łoże
    if (isPart(o) || o.isLight || !o.visible) continue;
    if (isToothed(o.userData) && o.userData.spin) { gearHit(o); continue; }   // koło koronowe — bryły zębów wewnętrznych
    if (o === chain) { chainHit(); continue; }
    const bb = new THREE.Box3().setFromObject(o); if (bb.isEmpty()) continue;
    const bx = new THREE.Box3Helper(bb, 0xffc14a); bx.material = CLASH.has(o) ? HM.clash : HM.fixed; bx.renderOrder = 20; hitG.add(bx);
  }
  { const bb = new THREE.Box3().setFromObject(motorG.children.find((c) => c !== motorG.userData.spin) || motorG); const bx = new THREE.Box3Helper(bb, 0xffc14a); bx.material = HM.fixed; hitG.add(bx); }
  for (const o of [reg.group, ...elecG.children]) { if (o.isGroup && o.userData.cores) continue; const bb = new THREE.Box3().setFromObject(o); const bx = new THREE.Box3Helper(bb, 0xffc14a); bx.material = CLASH.has(o) ? HM.clash : HM.fixed; bx.userData.reg = true; hitG.add(bx); }
}
function syncHit() { if (rollHit) rollHit(); for (const h of hitItems) { h.src.updateWorldMatrix(true, false); h.holder.matrixAutoUpdate = false; h.holder.matrix.copy(h.src.matrixWorld); } for (const c of hitG.children) if (c.userData.reg) c.visible = S.mode === 'physics'; }
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
  // kategorie planu (CATS) → grupy → przedmioty; kategoria bez przedmiotów — pokazana jako „w planie”
  const groupEl = (gname) => [el('h4', { textContent: gname }), el('div', { className: 'btns' }, ...ITEMS.filter((i) => i.group === gname).map((i) => {
    const b = el('button', { type: 'button', textContent: i.name, className: i.id === S.item ? 'on' : '' }); b.onclick = () => { S.item = i.id; save(); itemList(); itemSettings(); buildItem(); frameItem(); }; return b;
  }))];
  const used = new Set(CATS.flatMap(([, gs]) => gs)), rest = [...new Set(ITEMS.map((i) => i.group))].filter((g) => !used.has(g));
  $('itemList').replaceChildren(...CATS.flatMap(([cat, gs], k) => {
    const have = gs.filter((g) => ITEMS.some((i) => i.group === g)), extra = k === 0 ? rest : [];
    return [el('h3', { className: 'cat', textContent: `${k + 1}. ${cat}` }), ...(have.length + extra.length ? [...have, ...extra].flatMap(groupEl) : [el('p', { className: 'plan', textContent: 'w planie' })])];
  }));
}
function itemSettings() {
  const def = ITEMS.find((i) => i.id === S.item) || ITEMS[0], p = itemParams(def), box0 = $('itemSet');
  const fmtV = (q, v) => (q.unit === 'mm.1' ? `${fmt(v * 1000, 1)} mm` : q.unit === 'mm.2' ? `${fmt(v * 1000, 2)} mm` : q.unit === 'mm' ? `${Math.round(v * 1000)} mm` : q.unit === 'mm×2' ? `${Math.round(v * 1000)} mm` : q.unit === '°' ? `${v}°` : q.unit ? `${(EN ? String(v) : String(v).replace('.', ','))} ${q.unit}` : String(v));
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
    r.oninput = () => { out.textContent = tr(fmtV(q, +r.value)); }; r.onchange = () => set(+r.value);
    return el('div', { className: 'row' }, el('span', { textContent: q.label }), r, out);
  });
  const sp = el('input', { type: 'range', min: 0, max: 120, step: 1, value: S.spin }), spo = el('output', { textContent: `${S.spin} ${T('obr/min', 'rpm')}` });
  sp.oninput = () => { S.spin = +sp.value; spo.textContent = `${S.spin} ${T('obr/min', 'rpm')}`; save(); };
  const reset = el('button', { type: 'button', textContent: 'Domyślne' }); reset.onclick = () => { delete S.items[def.id]; save(); itemSettings(); buildItem(); };
  // sterowanie i zasilanie — bez obrotu podglądu; sterowanie obsługuje się na modelu
  const preview0 = def.group === 'Zasilanie i przewody' && def.id === 'wire' ? [] : (['Sterowanie', 'Zasilanie i przewody', 'Optyka', 'Przekaźniki', 'Regulatory'].includes(def.group) || ['latch', 'battery', 'dirValve'].includes(def.id)) ? def.group === 'Optyka' || ['governor', 'battery'].includes(def.id) ? [] : [el('p', { className: 'note', textContent: 'Obsługa na modelu: klik — dźwignia, przycisk, wyłącznik, RUN / STOP; przytrzymanie — przycisk chwilowy, krańcówka; przeciąganie w górę / w dół — pokrętło.' })] : [el('h3', { textContent: 'Podgląd' }), el('div', { className: 'row' }, el('span', { textContent: 'Obrót wejścia' }), sp, spo)];
  box0.replaceChildren(el('h3', { textContent: def.name }), ...rows, ...preview0, el('div', { className: 'btns' }, reset));
}
function itemStats() {
  if (!item) return;
  $('selName').textContent = tr(itemDef.name);
  const rows = [...item.info, ...(item.live ? item.live() : [])];   // wartości na żywo zastępują te same pola z opisu
  const uniq = []; const seen = new Set(); for (const r of rows) { if (seen.has(r[0])) { uniq[uniq.findIndex((u) => u[0] === r[0])] = r; continue; } seen.add(r[0]); uniq.push(r); }
  $('selProps').replaceChildren(...uniq.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: String(b) })]), ...(item.warn || []).map((w) => el('p', { className: 'warn', textContent: '⚠ ' + w })));
  $('selPorts').replaceChildren(...item.ports.map((pt) => el('li', {}, el('b', { textContent: pt.name }), el('span', { textContent: ` · ${pt.kind}` }))));
  perfRows([['Przedmiot', itemDef.name], ['Ustawienia', String(itemDef.params.length)], ['Porty', String(item.ports.length)]]);
}
function setMode(m) {
  const was = S.mode;
  S.mode = ['machine', 'physics', 'workshop'].includes(m) ? m : 'items'; save();
  for (const b of document.querySelectorAll('#modes button')) b.classList.toggle('on', b.dataset.mode === S.mode);
  const ws = S.mode === 'workshop', mach = S.mode !== 'items' && !ws, phy = S.mode === 'physics';
  WS.setActive(ws);
  root.visible = mach || ws; for (const c of [cross1, cross2]) c.visible = mach || ws; itemRoot.visible = !mach && !ws; selBox.visible = mach && !!sel;
  reg.group.visible = phy; elecG.visible = phy; $('rpmCtl').hidden = phy; hitG.visible = mach && S.hit;
  if (phy && was !== 'physics') phys.sync();   // fizyka startuje z bieżącego położenia części
  $('mBar').hidden = !mach;
  $('info').textContent = ws ? $('info').dataset.workshop : phy ? $('info').dataset.physics : mach ? $('info').dataset.machine : $('info').dataset.items;
  if (mach) { sel = null; $('selName').textContent = tr('Kliknij element maszyny'); $('selProps').replaceChildren(); $('selPorts').replaceChildren(); if (was === 'items' || !was) setCam(CAMS['Cała maszyna']); }
  else if (!ws) { buildItem(); frameItem(); }
  cams(); stats();
}
for (const b of document.querySelectorAll('#modes button')) b.onclick = () => setMode(b.dataset.mode);

/* ---------------- UI ---------------- */
const bind = (id, key, fmtV, after) => { $(id).value = S[key]; $(id + 'V').textContent = tr(fmtV(S[key])); $(id).oninput = () => { S[key] = +$(id).value; $(id + 'V').textContent = tr(fmtV(S[key])); if (after) after(); save(); }; };
bind('rpm', 'rpm', (v) => (v ? `${v} ${T('obr/min', 'rpm')}` : 'stop'));
bind('brake', 'brake', (v) => `${v} N·m`);
bind('alpha', 'alpha', (v) => `${Math.round(v * 100)} %`, applyAlpha);
function applyAlpha() { M.acrylic.opacity = S.alpha; for (const p of panes) p.visible = S.alpha > 0.01; }
$('weather').replaceChildren(...Object.entries(WEATHER).map(([k, w]) => el('option', { value: k, textContent: T(WEATHER_PL[k] || w.label || k, w.label || k) })));
$('weather').value = S.weather; $('weather').onchange = () => { S.weather = $('weather').value; sky(); save(); };
for (const k of ['sunEl', 'sunAz']) { $(k).value = S[k]; $(k + 'V').textContent = S[k] + '°'; $(k).oninput = () => { S[k] = +$(k).value; $(k + 'V').textContent = S[k] + '°'; sky(); save(); }; }
function sky() { stage.setSky({ weather: S.weather, sunEl: S.sunEl, sunAz: S.sunAz }); }
addEventListener('keydown', (e) => {
  if (e.target.closest('input,select,textarea')) return;
  if (S.mode === 'workshop' && WS.onKey(e)) { e.preventDefault(); return; }
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) held.add(e.code);
  if (e.code === 'KeyH') document.querySelectorAll('[data-window]').forEach((p) => p.classList.toggle('hidden-panel'));
});

/* ---------------- zegar — regulator (js/labs/mechanics/clock.js) ---------------- */
CLOCK = createClock({ root, S, fmt });
/* ---------------- etap 3: czujniki, przekaźnik czasowy, regulator PID (js/labs/mechanics/automation.js) ---------------- */
AUTO = createAutomation({ root, elecG, S, fmt, BED_TOP, Y0, motorG, eMotor, g1: eG1.group, eG1, disc, eDisc });
WS = createWorkshop({ scene, camera, dom: renderer.domElement, M, fmt, el, view: (t, d, y, p) => window.MechanicsApi && window.MechanicsApi.view(t, d, y, p) });
TRIG = createTrigger({ root, S, fmt, BED_TOP });
/* ---------------- etap 4: płyny — hydraulika z podajnikiem i fontanna (js/labs/mechanics/hydraulic-station.js, fountain-station.js) ---------------- */
STATIONS.push(TRIG, createHydraulicStation({ root, S, fmt, BED_TOP }), createFountainStation({ root, S, fmt, BED_TOP }));
/* ---------------- etap 5: stół optyczny — laser, soczewka, lustro, fotodioda; LED, pryzmat, ekran (js/labs/mechanics/optics-station.js) ---------------- */
STATIONS.push(createOpticsStation({ root, S, fmt, BED_TOP }));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), RUN_MAX = 120;
// MechanicsApi.mode('items' | 'machine'), item(id, ustawienia), items(), rpm(v), brake(Nm), alpha(0–1), state(), elements(), select(id), view(…), run(sekundy)
// scena dla doktora modeli (python3 tools/doctor.py --scene labs/mechanics.html): każdy model maszyny osobno — śruby,
// stopy, urządzenia, kable pominięte (wchodzą w dławiki z założenia); doktor sprawdza, czy modele nie wchodzą jeden w drugi
window.LabScene = {
  prepare: async () => { setMode('machine'); applyAngles(); elecG.visible = true; reg.group.visible = true; scene.updateMatrixWorld(true); },   // położenia z kinematyki (dokładne fazy zazębień)
  root: () => scene,
  components: () => [...root.children.filter((c) => c !== boltG), ...boltG.children, cross1, cross2, reg.group, ...elecG.children.filter((o) => !(o.userData && o.userData.cores))],
};
window.MechanicsApi = {
  clock() { const c = CLOCK.state, e = CLOCK.esc.state; return { time: CLOCK.hms(), amp: +(c.amp * 180 / Math.PI).toFixed(3), period: +(+c.period).toFixed(4), wind: +c.wind.toFixed(3), contact: e.contact, face: e.face, escRev: +(-c.te / TAU).toFixed(3) }; },
  runClock(sec = 10) { const n = Math.round(clamp(sec, 0, 600) * 60); for (let i = 0; i < n; i++) CLOCK.step(1 / 60); return this.clock(); },
  windClock(n = 1) { for (let i = 0; i < n * 4; i++) CLOCK.devices[0].api.press('wind'); return CLOCK.state.wind; },
  mode(m) { setMode(m); return S.mode; },
  get ws() { return WS && WS.api; },   // warsztat: ws.example(), ws.add(typ, ustawienia, x, z), ws.link(a, b), ws.run(), ws.state()
  // regulator(nazwa) — obsługa regulatora przy silniku w trybie Fizyka: 'run' | 'stop' | 'dir' | liczba (przeciągnięcie pokrętła, px)
  // circuit(nazwa) — obsługa instalacji w trybie Fizyka: circuit('dir', 'I' | '0' | 'II') — przełącznik S3, 'power' (X0), 'main' (Q1), 'start' / 'stop' (chwilowe), 'estop' (zatrzask / odblokowanie), 'test' (K1 ręcznie); circuit('pot', 0–1)
  circuit(c, v) {
    const E = ELEC; if (c === 'dir') { E.S3.api.pos = v; return E.S3.api.pos; }
    const map = { power: [E.X0, 'power'], main: [E.Q1, 'toggle'], start: [E.S2, 'button'], stop: [E.S1, 'button'], estop: [E.S0, 'estop'], test: [E.K1, 'test'] };
    if (c === 'pot') { E.R1.api.pos = Number(v) || 0; } else if (map[c]) { const [d, n] = map[c]; d.api.press(n); if (c === 'start' || c === 'stop') setTimeout(() => d.api.release(n), 150); }
    const es = E.st; return { power: E.X0.api.on, main: E.Q1.api.on, k1: E.K1.api.on, estop: E.S0.api.latched, vfd: reg.api.powered, Ucoil: es.uK, Uvfd: es.uV, shorts: es.r ? es.r.shorts : [] };
  },
  // boltsScreen() — położenia łbów śrub na ekranie (px, względem okna) — do klikania (testy, AI)
  boltsScreen() { const r = renderer.domElement.getBoundingClientRect(), v = new THREE.Vector3(); return boltG.children.map((b, i) => { b.children[1].getWorldPosition(v); v.project(camera); return { i, fix: b.userData.fix && b.userData.fix.name, x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, vis: v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1, out: b.userData.target }; }); },
  // bolts('reset') — wszystkie śruby dokręcone; bolts('unscrew', nazwa) — odkręca śruby części o nazwie zawierającej tekst; bolts() — stan
  bolts(c, name) {
    if (c === 'reset') resetBolts();
    if (c === 'unscrew' || c === 'screw') for (const f of FIXT) if (!name || f.name.toLowerCase().includes(String(name).toLowerCase())) for (const b of f.bolts) b.userData.target = c === 'unscrew' ? 1 : 0;
    return FIXT.map((f) => ({ name: f.name, bolts: f.bolts.length, out: f.bolts.filter((b) => b.userData.target).length, loose: !!f.loose, tilt: +((f.tilt || 0) * 180 / Math.PI).toFixed(2), spin: f.phys && f.phys.axis ? +(f.om * 60 / TAU).toFixed(1) : undefined, tau: f.tau !== undefined ? +f.tau.toFixed(2) : undefined }));
  },
  regulator(c) { if (typeof c === 'number') reg.api.drag('knob', c); else reg.api.press(c); return { run: reg.api.run, dir: reg.api.dir, f: reg.api.f, set: reg.api.set }; },
  // ratios() — przełożenia ω_element / ω_silnika w fizyce i w kinematyce (sprawdzenie zgodności)
  ratios() { return parts.filter((e) => phys.nodes.includes(e)).slice(-4).map((e) => [e.name, +(phys.state.omega ? e.omega / phys.state.omega : 0).toFixed(4)]); },
  item(id, params = {}) { S.item = id; S.items[id] = { ...(S.items[id] || {}), ...params }; itemList(); itemSettings(); buildItem(); frameItem(); return { name: itemDef.name, info: item.info, warn: item.warn || [], ports: item.ports.map((p) => p.name) }; },
  items: () => ITEMS.map((i) => ({ id: i.id, name: i.name, group: i.group, params: i.params.map((q) => q.key) })),
  // control(nazwa, 'press' | 'release' | dy) — obsługa części sterującej przedmiotu (jak myszą); zwraca stan na żywo
  // stanowiska na łożu (tryb Fizyka): device('HY-button') — klik przycisku, device('HY-valve', 'a') / device('HY-valve', 'a', 'release')
  device(id, name = 'button', act = 'press') { const e = STATIONS.flatMap((st) => st.parts).find((p) => p.id === id), d = e && STATIONS.flatMap((st) => st.devices).find((v) => v.group === e.group); if (!d) return false; if (act === 'release') d.api.release(name); else { d.api.press(name); if (act === 'click') d.api.release(name); } return true; },
  control(name, act = 'press') { if (!item || !item.api) return null; if (act === 'press') item.api.press(name); else if (act === 'release') item.api.release(name); else item.api.drag(name, act); return item.live ? Object.fromEntries(item.live()) : null; },
  // liczby spoza zakresu przycinane do zakresu suwaka; nie-liczby pomijane (zostaje obecna wartość)
  rpm(v) { if (Number.isFinite(v)) { S.rpm = clamp(v, 0, 1500); $('rpm').value = S.rpm; $('rpmV').textContent = S.rpm ? `${S.rpm} ${T('obr/min', 'rpm')}` : 'stop'; save(); } return S.rpm; },
  brake(v) { if (Number.isFinite(v)) { S.brake = clamp(v, 0, 300); $('brake').value = S.brake; $('brakeV').textContent = `${S.brake} N·m`; save(); } return S.brake; },
  alpha(a) { if (Number.isFinite(a)) { S.alpha = clamp(a, 0, 1); $('alpha').value = S.alpha; $('alphaV').textContent = `${Math.round(S.alpha * 100)} %`; applyAlpha(); save(); } return S.alpha; },
  state: () => ({ ...drive.state, ok: solved.ok }),
  elements: () => parts.map((e) => ({ id: e.id, name: e.name, dof: e.dof, rpm: e.dof === 'lin' ? undefined : +rpmOf(e.omega).toFixed(2), v: e.dof === 'lin' ? +e.omega.toFixed(5) : undefined, T: +e.T.toFixed(3), eta: +e.eta.toFixed(4), theta: +e.theta.toFixed(4) })),
  select(id) { const e = [...parts, ...CLOCK.parts, ...(AUTO ? AUTO.parts : []), ...STATIONS.flatMap((st) => st.parts)].find((p) => p.id === id); if (e) select(e); return !!e; },
  view(t = [-1.4, 0.9, 0.2], dist = 9, yaw = 0.25, pitch = 0.38) { orbit.target.set(...t); Object.assign(orbit, { dist, yaw, pitch }); },
  // run: najwyżej RUN_MAX sekund na wywołanie (Infinity / NaN nie zawieszą strony)
  // simulate(s) — bieżący tryb (Maszyna, Fizyka, Przedmioty) krokami 1/60 s, bez rysowania (testy, AI)
  simulate(sec = 1) { const n = Math.round(clamp(Number.isFinite(sec) ? sec : 0, 0, RUN_MAX) * 60); for (let i = 0; i < n; i++) simStep(1 / 60); stats(); return { mode: S.mode, k1: ELEC.K1.api.on, kt1: AUTO.kt.state, run: reg.api.run, f: +reg.api.f.toFixed(2), rpm: +AUTO.B2.state.rpm.toFixed(1), pid: { auto: AUTO.pid.state.auto, sv: AUTO.pid.state.sv, out: +AUTO.pid.state.out.toFixed(3) }, b1: AUTO.B1.state.edges, b3: AUTO.B3.state.count }; },
  pid(c, v) { const P = AUTO.pid.state; if (c === 'auto') P.auto = !!v; if (c === 'sv') P.sv = clamp(+v, 0, 1500); return { ...P }; },
  run(sec = 1) { const n = Math.round(clamp(Number.isFinite(sec) ? sec : 0, 0, RUN_MAX) * 60); for (let i = 0; i < n; i++) drive.step(1 / 60, { rpm: S.rpm, brake: S.brake }); applyAngles(); stats(); return this.state(); },
  drive,
};

$('resetBolts').onclick = () => resetBolts();
sky(); applyAlpha(); applyAngles(); itemList(); itemSettings(); setMode(S.mode); if (S.hit) setHit(true);
if (window.LabLoad) window.LabLoad.step(T('Maszyna złożona', 'Machine assembled'), 1);
requestAnimationFrame(loop);
