// Model doctor (kopia z GameLaboratory: tools/doctor/modeldoctor.js) — modele Tornado.io: StreetKit (ulice, skrzyżowania,
// sygnalizatory, latarnie, znaki, słupki, barierki, ekrany, pikietaż, parkingi, wiadukty, tunele, rampy, kładki,
// przejście podziemne), HouseKit (budynki z części DestructKit, każda część jako osobna siatka) i MechKit (przedmioty
// laboratorium mechaniki z katalogu js/labs/mechanics/items.js — ustawienia domyślne i warianty skrajne), beczka JunkKit
// z laboratorium deformacji (każdy wariant, obie wersje szczegółów).
// Każdy model: { id, label, family, build() → { root, measured, opts } }.
import * as THREE from '../../vendor/three/three.module.js';
import { countDraw } from './common.js';
import * as K from '../../js/models/streets/streetkit.js';
import { HOUSE_IDS, HOUSE_TYPES, buildHouse } from '../../js/models/houses/housekit.js';
import { extrude } from '../../js/destruct/extrude.js';
import { MATS, tileOf } from '../../js/destruct/materials.js';
import { ITEMS } from '../../js/labs/mechanics/items.js';
import * as BARREL from '../../js/models/junkyard/items/barrel.js';

const done = (root, opts = {}) => { root.updateMatrixWorld(true); return { root, measured: countDraw(root), opts: { planeEps: 0.01, ...opts } }; };
const G = (...objs) => { const g = new THREE.Group(); objs.forEach((o) => g.add(o)); return g; };
const LINE = [[-20, 0], [20, 0]], CURVE = [[-20, -8], [0, -4], [14, 8], [18, 22]];
const V3 = [[-95, 0, 0.3], [-65, 0, 2.6], [-38, 0, 6.4], [-16, 0, 7.7], [0, 0, 7.9], [16, 0, 7.7], [38, 0, 6.4], [65, 0, 2.6], [95, 0, 0.3]];
// modele stojące na ziemi (y = 0) — nikt ich nie ogląda spod gruntu; pod ziemią (rampa, przejście podziemne) — bez tego
const st = (id, label, fam, fn, opts = { ground: 0 }) => ({ id: 'streets/' + id, label, family: fam, build: () => done(fn(), opts) });

export const models = [
  ...Object.entries(K.PROFILES).map(([k, p]) => st('street-' + k, 'Ulica: ' + p.label, 'street', () => K.buildStreet(LINE, p).group)),
  st('street-curve', 'Ulica na łuku', 'street', () => K.buildStreet(CURVE, K.PROFILES.city).group),
  st('crossing-4', 'Skrzyżowanie 4 wloty', 'street', () => K.buildCrossing(K.PROFILES.city, { arms: 4 }).group),
  st('crossing-3', 'Skrzyżowanie T', 'street', () => K.buildCrossing(K.PROFILES.city, { arms: 3 }).group),
  st('signal', 'Sygnalizator', 'furniture', () => K.buildTrafficLight().group),
  st('signal-arm', 'Sygnalizator na wysięgniku', 'furniture', () => K.buildTrafficLight({ arm: 4 }).group),
  ...Object.entries(K.LAMPS).map(([k, v]) => st('lamp-' + k, 'Latarnia: ' + v.label, 'furniture', () => K.buildLamp(k).group)),
  ...Object.keys(K.SIGNS).map((k) => st('sign-' + k, 'Znak ' + k, 'furniture', () => K.buildSign(k).group)),
  st('sign-D-18-T-29', 'Znak D-18 z T-29', 'furniture', () => K.buildSign('D-18', { tab: 'T-29' }).group),
  ...Object.entries(K.BOLLARDS).map(([k, v]) => st('bollards-' + k, 'Słupki: ' + v.label, 'furniture', () => K.buildBollards([[0, 0], [8, 0]], k, { every: k === 'delineator' ? 4 : undefined }).group)),
  ...Object.entries(K.RAILS).map(([k, v]) => st('rail-' + k, 'Barierka: ' + v.label, 'furniture', () => K.buildRail([[0, 0], [10, 0]], k, { offset: 2 }).group)),
  ...Object.entries(K.NOISE).map(([k, v]) => st('noise-' + k, 'Ekran: ' + v.label, 'furniture', () => K.buildNoiseWall([[0, 0], [12, 0]], k).group)),
  st('milepost-hm', 'Słupek hektometrowy', 'furniture', () => K.buildMilepost(12, 3).group),
  st('milepost-km', 'Słupek kilometrowy', 'furniture', () => K.buildMilepost(12, 0).group),
  ...Object.entries(K.PARKING).map(([k, v]) => st('parking-' + k, 'Parking: ' + v.label, 'street', () => K.buildParking(LINE, k, { inner: 3.25, side: 1, disabled: 2 }).group)),
  st('viaduct', 'Wiadukt prosty', 'structure', () => K.buildViaduct(V3).group),
  st('viaduct-curve', 'Wiadukt na łuku', 'structure', () => K.buildViaduct([[-95, -35, 0.3], [-62, -32, 4.2], [-32, -20, 8.4], [-8, 2, 9.2], [10, 28, 9.4], [34, 46, 8.8], [64, 52, 4.4], [96, 50, 0.3]]).group),
  st('tunnel-arch', 'Tunel łukowy', 'structure', () => K.buildTunnel([[-30, 0], [30, 0]], K.TUNNEL_PROFILE, { ground: () => 12 }).group),
  st('tunnel-box', 'Tunel z podporami', 'structure', () => K.buildTunnel([[-30, 0], [30, 0]], K.TUNNEL_BOX_PROFILE, { type: 'box', ground: () => 7 }).group),
  st('trough', 'Rampa w korycie', 'structure', () => K.buildTrough([[0, 0, -6], [30, 0, -3], [60, 0, 0]]).group, {}),
  st('footbridge', 'Kładka ze schodami', 'structure', () => K.buildFootbridge().group),
  st('footbridge-back', 'Kładka ze schodami naprzemiennymi', 'structure', () => K.buildFootbridge({ stairs: 'switchback' }).group),
  st('footbridge-lift', 'Kładka ze schodami i windą', 'structure', () => K.buildFootbridge({ lift: true }).group),
  st('subway', 'Przejście podziemne', 'structure', () => K.buildSubway().group, {}),
];
// budynki HouseKit: każda część (wielokąt wyciągnięty na grubość) jako osobna siatka, jak w DestructKit przed zniszczeniem
const matCache = {};
const houseMat = (m) => (matCache[m] ||= new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((Object.keys(MATS).indexOf(m) * 0.137) % 1, 0.4, 0.55), name: m }));
for (const id of HOUSE_IDS) models.push({
  id: 'houses/' + id, label: HOUSE_TYPES[id].name, family: 'house',
  build: () => {
    const h = buildHouse(id), root = new THREE.Group();
    h.parts.forEach((sp, i) => {
      const g = extrude(sp.poly, { t: sp.t, orig: sp.poly, tile: tileOf(sp.mat), frac: MATS[sp.mat].frac }), c = g.userData.c;
      const m = new THREE.Mesh(g, houseMat(sp.mat)); m.name = (sp.name || sp.mat) + ' #' + i;
      m.matrixAutoUpdate = false;
      m.matrix.compose(new THREE.Vector3(...sp.pos), new THREE.Quaternion(...sp.quat), new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(c[0], c[1], 0));
      root.add(m);
    });
    return done(root, { ground: 0 });
  },
});

// przedmioty mechaniczne: ustawienia domyślne i warianty (krańce zakresów, inne rodzaje); kąt podglądu 0,4 rad
const MECH_VARIANTS = {
  gear: [{}, { z: 9, m: 0.001 }, { z: 120, m: 0.008, w: 0.08 }, { alpha: 14.5, holes: false, hub: false }],
  pair: [{}, { z1: 10, z2: 120, m: 0.005 }], planet: [{}, { n: 4, zp: 18 }, { zs: 12, zp: 60, n: 2 }], ring: [{}, { z: 160, m: 0.003 }],
  sprocket: [{}, { z: 9, type: '06B' }, { z: 60, type: '12A' }], chain: [{}, { z1: 9, z2: 80, type: '12A', a: 0.8 }],
  pulley: [{}, { d: 0.05, profile: 'SPZ' }, { d: 0.4, profile: 'SPB', grooves: 5 }], belt: [{}, { d1: 0.063, d2: 0.4, profile: 'SPB', grooves: 4, a: 0.2 }],
  shaft: [{}, { len: 0.1, d: 0.05, key: false }], bearing: [{}, { d: 0.04, h: 0.6 }], jaw: [{}, { r: 0.12, spider: '64D' }], flange: [{}, { d: 0.2, bolts: 8 }],
  cardan: [{}, { beta: 0 }, { beta: 45, double: true }],
  rackpinion: [{}, { m: 0.003, z: 12, n: 20 }, { m: 0.001, z: 40, n: 80 }], crank: [{}, { r: 0.02, l: 0.1 }, { r: 0.08, l: 0.4 }], leadscrew: [{}, { kind: 'trap', d: 0.032, lead: 0.004, len: 1 }],
  rolling: [{}, { type: 'roller' }, { type: 'taper', d: 0.04 }, { type: 'thrust' }, { type: 'needle', d: 0.02 }, { type: 'plain' }],
  camera: [{}, { f: 0.004, H: 1 }, { f: 0.025, H: 1.7 }], monitor: [{}, { stand: 'desk' }],
  mirror: [{}, { shape: 'flat', D: 0.0127 }, { shape: 'convex', D: 0.0508, R: 0.1, angle: 45 }, { coating: 'au', substrate: 'zerodur', R: 1 }],
  cspring: [{}, { d: 0.0005, D: 0.006, n: 20, L0: 0.2 }], mainspring: [{}, { h: 0.0008, L: 0.3 }], flywheel: [{}, { D: 1.2, mat: 'steel' }], ratchet: [{}, { z: 60, R: 0.08 }], escapement: [{}, { L: 0.994, mb: 3 }],
  inductive: [{}, { size: 'M30', flush: false, target: 'aluminium' }], encoder: [{}], barrier: [{}], timer: [{}], pid: [{}], governor: [{}, { n: 300, L: 0.2 }],
  tspring: [{}, { d: 0.005, D: 0.05, n: 3 }], battery: [{}, { chem: 'nmc', series: 7, Ah: 20 }, { chem: 'lfp', series: 8 }], lever: [{}, { cls: 2 }, { cls: 3 }], latch: [{}], relay: [{}],
  pipe: [{}, { d: 0.025 }], rotameter: [{}, { Qmax: 2, rhoF: 1380 }], lens: [{}, { kind: 'planoconcave', f: 0.05, D: 0.0127 }, { kind: 'biconcave' }, { kind: 'planoconvex', f: 0.3, glass: 'sf11' }], prism: [{}, { type: 'rightangle', glass: 'bk7', rot: 0 }], laser: [{}, { nm: 405, mW: 5 }], ledSource: [{}, { color: 630 }], photodiode: [{}], clearHose: [{}, { di: 0.006, fluid: 'oil', full: false }], fluidSource: [{}, { kind: 'gravity' }], bucket: [{}, { mat: 'plastic', V: 0.005, fill: 0 }], floatGauge: [{}, { R: 0.02 }], revCounter: [{}], hose: [{}, { dn: 6, std: '1SN' }], gearPump: [{}, { z: 16, m: 0.003, b: 0.02, cut: false }], pistonPump: [{}, { z: 1, cut: false }, { z: 5 }], centrifugal: [{}, { D2: 0.12, cut: false }],
  ballValve: [{}, { dn: 25, cut: true, ang: 90 }], checkValve: [{}, { cut: true }], throttleValve: [{}, { check: false }], hydCylinder: [{}, { D: 0.063, stroke: 0.5, cut: true }], reservoir: [{}, { V: 100 }], accumulator: [{}, { V0: 2.5e-3 }], nozzle: [{}, { d: 0.002 }],
  switch: [{}, { kind: 'main' }, { kind: 'lever', poles: 1 }], estop: [{}], lamp: [{}, { color: 'red' }], selector: [{}, { positions: '0-I', handle: 'long' }], limit: [{}, { actuator: 'plunger' }], contactor: [{}, { amps: 32, coil: '24DC' }],
  wire: [{}, { mm2: 16, color: 'pe', len: 3 }, { mm2: 0.5, color: 'black', len: 0.1 }], ac: [{}, { phases: 3, volts: 400 }], dc: [{}, { volts: 60, amps: 20 }], pot: [{}, { taper: 'log', knob: 'red' }], button: [{}, { lit: true, mode: 'latch' }, { mushroom: true, color: 'red', contact: 'NC' }], vfd: [{}, { kW: 7.5 }, { kW: 0.18 }], motor: [{}, { kW: 0.18, poles: 2 }, { kW: 7.5, poles: 6, paint: 'paintRed' }], brake: [{}, { d: 0.35, t: 0.02, vents: 24 }],
};
for (const def of ITEMS) (MECH_VARIANTS[def.id] || [{}]).forEach((v, k) => models.push({
  id: `mech/${def.id}${k ? '-' + k : ''}`, label: def.name + (k ? ' (' + Object.entries(v).map(([a, b]) => `${a}=${b}`).join(', ') + ')' : ''), family: 'mech',
  build: () => {
    const p = {}; for (const q of def.params) p[q.key] = v[q.key] ?? q.def;
    const it = def.build(p); it.update(0.4);
    // próg „tej samej płaszczyzny” w skali przedmiotów (mm), nie ulic (domyślne 0,01 m łączyło ścianki odległe o kilka mm)
    const o = { planeEps: 0.0002 }; if (it.rest) o.ground = new THREE.Box3().setFromObject(it.group).min.y;
    return done(G(it.group), o);
  },
}));

// laboratorium deformacji: beczka 200 l (JunkKit) — stoi na ziemi (y = 0)
BARREL.VARIANTS.forEach((v, k) => [0, 1].forEach((lod) => models.push({
  id: `deform/barrel-${k}${lod ? '-lod' + lod : ''}`, label: `Beczka 200 l: ${v.name || v.label || 'wariant ' + k}${lod ? ' (daleka)' : ''}`, family: 'deform',
  build: () => { const g = BARREL.build(lod, k); g.position.y -= new THREE.Box3().setFromObject(g).min.y; return done(G(g), { ground: 0, planeEps: 0.0002 }); },
})));
