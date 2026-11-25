// Laboratorium deformacji: stalowe beczki 200 l (JunkKit, js/models/junkyard/items/barrel.js) jako powłoki DeformKit
// (js/deform/shell.js) pod stalowymi blokami prasy. Pięć beczek na jednej planszy: pionowo, pochylone o 23°, 45° i 68°
// (oparte bokiem o betonowe podpory) i bokiem (zablokowana klinami). Suwak opuszcza wszystkie bloki z jedną prędkością.
// Druga scena: kontener bez dachu z beczkami w dwóch warstwach (stojące, leżące, pochylone — górne spadają i układają
// się same), jedna prasa na cały kontener, suwak przezroczystości ścian. Beczki odpychają się nawzajem (DeformKit others).
// Dla AI: DeformationApi.
import * as THREE from '../../../vendor/three/three.module.js';
import { createStage, WEATHER } from '../../core/stage.js';
import { groundDisc } from '../../world/ground.js';
import { makeMaterial, PRESETS } from '../../render/materials/matkit.js';
import * as barrel from '../../models/junkyard/items/barrel.js';
import { applyTextures } from '../../models/junkyard/textures.js';
import { createShell, makeBox } from '../../deform/shell.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach((k) => e.append(k)); return e; };
const KEY = 'tornado.deformation.v1';
let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { saved = null; }
const S = { speed: 0, scene: 'board', alpha: 0.35, weather: 'fair', sunEl: 38, sunAz: 215, ...(saved || {}) };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* prywatny tryb */ } };
const status = (t) => { $('status').textContent = t || ''; };

const stage = createStage($('view'));
const { scene, camera, renderer } = stage;
scene.add(groundDisc(120));
const holder = new THREE.Group(); scene.add(holder);

// beczka: wymiary z modelu (Ø rąbków 585 mm, obręcze toczne do 297 mm promienia, wys. 880 mm)
const HT = 0.88, R_MAX = 0.2968, LID_R = 0.24, LID_Y = 0.0142;
// ustawienia: kąt odchylenia osi od pionu (stopnie), odstęp 3 m
const SETS = [{ deg: 0, label: 'Pionowo' }, { deg: 23, label: '23°' }, { deg: 45, label: '45°' }, { deg: 68, label: '68°' }, { deg: 90, label: 'Bokiem' }];
const GAP = 3.0;

/* ---------------- materiały ---------------- */
const steel = makeMaterial(PRESETS.plate, { res: 512 }).material;
const concrete = makeMaterial(PRESETS.concrete || { kind: 'concrete', color: '#9a9890', tile: 2, roughness: 0.9 }, { res: 512 }).material;

/* ---------------- siatka fizyczna beczki ---------------- */
// rzadka bryła obrotowa (32 segmenty, 16 rzędów ściany, dno i wieko po 3 pierścienie) — w niej osadzony szczegółowy
// model JunkKit (obręcze toczne, rąbki, korki, farba z rdzą)
const R_WALL = 0.2858;
function simBarrel() {
  const pts = [], rings = 3, rows = 16;
  for (let k = 0; k <= rings; k++) pts.push(new THREE.Vector2(Math.max(1e-4, LID_R * k / rings), LID_Y));
  pts.push(new THREE.Vector2(R_WALL, 0.0));
  for (let i = 1; i < rows; i++) pts.push(new THREE.Vector2(R_WALL, HT * i / rows));
  pts.push(new THREE.Vector2(R_WALL, HT));
  for (let k = rings; k >= 0; k--) pts.push(new THREE.Vector2(Math.max(1e-4, LID_R * k / rings), HT - LID_Y));
  return new THREE.LatheGeometry(pts, 32).translate(0, -HT / 2, 0);
}
// w kontenerze: siatka fizyczna cofnięta o promień styku (beczki stykają się cząstkami na odległość 2 × CR — osadzony
// model wychodzi z powrotem na prawdziwy obrys, więc beczki dotykają się blachą)
const CR = 0.025;
function simBarrelInset() {
  const pts = [], rings = 6, rows = 16, r = R_WALL - CR, y0 = LID_Y + CR, lr = LID_R - CR;
  for (let k = 0; k <= rings; k++) pts.push(new THREE.Vector2(Math.max(1e-4, lr * k / rings), y0));
  pts.push(new THREE.Vector2(r, CR));
  for (let i = 1; i < rows; i++) pts.push(new THREE.Vector2(r, CR + (HT - 2 * CR) * i / rows));
  pts.push(new THREE.Vector2(r, HT - CR));
  for (let k = rings; k >= 0; k--) pts.push(new THREE.Vector2(Math.max(1e-4, lr * k / rings), HT - y0));
  return new THREE.LatheGeometry(pts, 32).translate(0, -HT / 2, 0);
}

/* ---------------- plansza ---------------- */
let rigs = [], presses = [], walls = [];
// kołyska w kształcie L pochylona razem z beczką: płyta pod dnem (prostopadle do osi) i płyta wzdłuż boku od dołu do
// nieco ponad środek ciężkości — beczka nie wraca do pionu ani nie zsuwa się, a prasa wgniata ją w kołyskę; → [[half, Matrix4]]
function cradle(th, a, n, c) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -th), qs = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2 - th), one = new THREE.Vector3(1, 1, 1);
  const hb = [R_MAX + 0.12, 0.15, 0.42], hs = [0.45, 0.25, 0.42];   // grube płyty — cienkie blacha przy zgniataniu przechodziła na wylot
  return [
    [hb, new THREE.Matrix4().compose(c.clone().addScaledVector(a, -(HT / 2 + 0.006 + hb[1])).addScaledVector(n, 0.06), q, one)],
    [hs, new THREE.Matrix4().compose(c.clone().addScaledVector(n, R_MAX + 0.006 + hs[1]).addScaledVector(a, -HT / 2 - 0.16 + hs[0]), qs, one)],
  ];
}
function placement(deg) {
  const th = deg * Math.PI / 180, a = new THREE.Vector3(Math.sin(th), Math.cos(th), 0), n = new THREE.Vector3(Math.cos(th), -Math.sin(th), 0);
  // pionowo i bokiem: na ziemi; pochylone: w kołysce — najniższy narożnik płyty pod dnem na ziemi
  let cy = (HT / 2) * Math.cos(th) + (deg ? R_MAX : 0.2928) * Math.sin(th) + 0.003;
  if (deg > 0 && deg < 90) {   // pochylone: w kołysce — najniższy narożnik kołyski na ziemi
    let lo = Infinity;
    for (const [half, m4] of cradle(th, a, n, new THREE.Vector3(0, cy, 0))) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) lo = Math.min(lo, new THREE.Vector3(sx * half[0], sy * half[1], sz * half[2]).applyMatrix4(m4).y);
    cy -= lo;
  }
  return { th, a, n, cy };
}
function build() {
  for (const r of rigs) { r.shell.dispose(); }
  holder.clear(); rigs = []; presses = []; walls = []; lifting = false; grab = null;
  if (S.scene === 'container') buildContainer(); else buildBoard();
  applyAlpha(); stats();
}
function buildBoard() {
  SETS.forEach((set, k) => {
    const x = (k - (SETS.length - 1) / 2) * GAP, { th, a, n, cy } = placement(set.deg);
    const M = new THREE.Matrix4().compose(new THREE.Vector3(x, cy, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -th), new THREE.Vector3(1, 1, 1));
    const model = barrel.build(0, k % barrel.VARIANTS.length);
    const sim = simBarrel().applyMatrix4(M);
    const shell = createShell([sim], { mass: 18, worker: true });   // każda beczka w swoim wątku — liczą się równolegle
    model.matrixAutoUpdate = false; model.matrix.copy(M); holder.add(model);
    shell.embed(model);
    sim.dispose();
    // podpory: betonowy blok pod bokiem pochylonej beczki (górna ściana styczna do obręczy), kliny pod leżącą
    const supports = [];
    const addBox = (half, m4, mat) => { const b = makeBox(half, m4, 0.7); supports.push(b); const mesh = new THREE.Mesh(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2), mat); mesh.matrixAutoUpdate = false; mesh.matrix.copy(m4); mesh.castShadow = mesh.receiveShadow = true; holder.add(mesh); };
    if (set.deg > 0 && set.deg < 90) {
      for (const [half, m4] of cradle(th, a, n, new THREE.Vector3(x, cy, 0))) addBox(half, m4, concrete);
    } else if (set.deg >= 90) {
      for (const sz of [-1, 1]) addBox([0.42, 0.09, 0.09], new THREE.Matrix4().compose(new THREE.Vector3(x, 0, sz * 0.25), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 4), new THREE.Vector3(1, 1, 1)), concrete);
    }
    // prasa: stalowy blok 1,5 × 0,4 × 1,2 m nad beczką; zatrzymuje się na podporze albo 2 cm nad ziemią
    // pochylone: węższy blok nad górną połową beczki (nad dolną stoi kołyska); zatrzymuje się na podporze (próbki na
    // krawędziach prostopadłościanów pod blokiem) albo 2 cm nad ziemią
    const tilted = set.deg > 0 && set.deg < 90, [, hi] = shell.bounds(), pressHalf = tilted ? [0.45, 0.2, 0.6] : [0.75, 0.2, 0.6], px = tilted ? x + a.x * 0.3 : x;
    let stop = 0.02;
    for (const b of supports) {
      const h = b.half;
      for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) for (let t = -1; t <= 1.0001; t += 0.125) {
        const v = [0, 0, 0]; v[i] = s1 * h[i]; v[j] = s2 * h[j]; const k = 3 - i - j; v[k] = t * h[k];
        const p = new THREE.Vector3(...v).applyMatrix4(b.matrix);
        if (Math.abs(p.x - px) < pressHalf[0] && Math.abs(p.z) < pressHalf[2]) stop = Math.max(stop, p.y + 0.01);
      }
    }
    const press = addPress(px, hi + 0.08, stop, pressHalf);
    rigs.push({ set, shell, supports, press, ground: 0, h0: hi, model });
  });
}
function addPress(x, y0, stop, half) {
  const press = { y0, y: y0, stop, x, half };
  press.box = makeBox(half, pressMatrix(press), 0.8); press.box.plastic = true;
  press.mesh = new THREE.Mesh(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2), steel);
  press.mesh.castShadow = press.mesh.receiveShadow = true; press.mesh.matrixAutoUpdate = false; press.mesh.matrix.copy(press.box.matrix); holder.add(press.mesh);
  presses.push(press);
  return press;
}
function pressMatrix(p) { return new THREE.Matrix4().makeTranslation(p.x, p.y + p.half[1], 0); }

/* ---------------- kontener ---------------- */
// kontener bez dachu (wnętrze 2,2 × 1,3 m, ściany 1,6 m) na dwóch płozach; dno na wysokości FLOOR. Beczki: dolna
// warstwa — dwie stojące, leżąca w poprzek, leżąca wzdłuż, stojąca; górna — leżąca na stojących i pochylona nad
// leżącymi (zaczynają nieco wyżej i spadają, układając się same). Prasa 2,17 × 1,27 m (szczelina przy ścianach 1,5 cm) zjeżdża do 8 cm nad dno.
const CW = 1.1, CD = 0.65, CH = 1.6, FLOOR = 0.14, WALL_T = 0.004;
const paint = makeMaterial({ ...PRESETS.hull, color: '#2f5d8a', color2: '#1d3a57', tile: 2 }, { res: 512 }).material;
const BARRELS = [
  // [x, y nad dnem (środek), z, oś: obrót wokół z (pochylenie), wokół x, wokół y (stopnie)]
  { label: 'Stojąca 1', p: [-0.78, HT / 2, -0.33], r: [0, 0, 0] },
  { label: 'Stojąca 2', p: [-0.78, HT / 2, 0.33], r: [0, 0, 0] },
  { label: 'Leżąca w poprzek', p: [-0.16, R_WALL, 0], r: [0, 90, 0] },
  { label: 'Leżąca wzdłuż', p: [0.59, R_WALL, -0.33], r: [90, 0, 0] },
  { label: 'Stojąca 3', p: [0.8, HT / 2, 0.33], r: [0, 0, 0] },
  { label: 'Na stojących', p: [-0.78, HT + R_WALL + 0.03, 0], r: [0, 90, 8] },
  { label: 'Pochylona', p: [0.22, R_WALL * 2 + 0.36, 0.05], r: [62, 0, 25] },
];
function buildContainer() {
  // dno i ściany: rysowane cienko (blacha), zderzenia grubymi bryłami za wewnętrzną ścianą
  const T = 0.2, one = new THREE.Vector3(1, 1, 1), q0 = new THREE.Quaternion();
  const wall = (cx, cy, cz, hx, hy, hz, vis) => {
    walls.push(makeBox([hx, hy, hz], new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), q0, one), 0.6));
    const m = new THREE.Mesh(new THREE.BoxGeometry(...vis.size), vis.mat || paint); m.position.set(...vis.pos); m.receiveShadow = true; m.userData.wall = true; holder.add(m);
  };
  const yc = FLOOR + CH / 2;
  wall(-CW - T, yc, 0, T, CH / 2, CD + 2 * T, { size: [WALL_T, CH, CD * 2 + WALL_T * 2], pos: [-CW - WALL_T / 2, yc, 0] });
  wall(CW + T, yc, 0, T, CH / 2, CD + 2 * T, { size: [WALL_T, CH, CD * 2 + WALL_T * 2], pos: [CW + WALL_T / 2, yc, 0] });
  wall(0, yc, -CD - T, CW, CH / 2, T, { size: [CW * 2, CH, WALL_T], pos: [0, yc, -CD - WALL_T / 2] });
  wall(0, yc, CD + T, CW, CH / 2, T, { size: [CW * 2, CH, WALL_T], pos: [0, yc, CD + WALL_T / 2] });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(CW * 2 + 0.01, 0.01, CD * 2 + 0.01), paint); floor.position.set(0, FLOOR - 0.005, 0); floor.receiveShadow = true; floor.userData.wall = true; holder.add(floor);
  for (const sz of [-1, 1]) { const sk = new THREE.Mesh(new THREE.BoxGeometry(CW * 2 + 0.2, FLOOR - 0.01, 0.16), steel); sk.position.set(0, (FLOOR - 0.01) / 2, sz * (CD - 0.15)); sk.castShadow = sk.receiveShadow = true; holder.add(sk); }
  const press = addPress(0, FLOOR + CH + 0.05, FLOOR + 0.08, [CW - 0.015, 0.2, CD - 0.015]);   // szczelina 1,5 cm — węższa niż średnica styku cząstek (5 cm)
  // ustawianie: beczka podnoszona po 1 cm, aż jej siatka fizyczna jest co najmniej 1 cm ponad stykiem (2 × CR) z już
  // postawionymi — żadna nie zaczyna wciśnięta w inną (wcisk na starcie wgniatał blachę i mieszał warstwy)
  const placed = [], clear = 2 * CR + 0.01;
  const gap = (P) => { let m = Infinity; for (const Q of placed) for (let i = 0; i < P.length; i += 3) for (let j = 0; j < Q.length; j += 3) { const dx = P[i] - Q[j], dy = P[i + 1] - Q[j + 1], dz = P[i + 2] - Q[j + 2], d = dx * dx + dy * dy + dz * dz; if (d < m) m = d; } return Math.sqrt(m); };
  BARRELS.forEach((b, k) => {
    const d = Math.PI / 180, q = new THREE.Quaternion().setFromEuler(new THREE.Euler(b.r[1] * d, b.r[2] * d, b.r[0] * d, 'YXZ'));
    const at = new THREE.Vector3(b.p[0], FLOOR + b.p[1] + 0.004, b.p[2]);
    let M = new THREE.Matrix4().compose(at, q, one), sim = simBarrelInset().applyMatrix4(M);
    for (let n = 0; n < 60 && gap(sim.attributes.position.array) < clear; n++) { sim.translate(0, 0.01, 0); at.y += 0.01; }
    M = new THREE.Matrix4().compose(at, q, one);
    placed.push(sim.attributes.position.array);
    const model = barrel.build(0, k % barrel.VARIANTS.length);
    const shell = createShell([sim], { mass: 18, radius: CR, worker: true });
    model.matrixAutoUpdate = false; model.matrix.copy(M); holder.add(model);
    shell.embed(model);
    rigs.push({ set: { label: b.label }, shell, supports: walls, press, ground: FLOOR, h0: shell.bounds()[1], model });
  });
}
function applyAlpha() {
  const a = S.alpha, see = a < 0.999;
  if (paint.transparent !== see) { paint.transparent = see; paint.needsUpdate = true; }
  paint.opacity = a; paint.depthWrite = !see;
  holder.traverse((o) => { if (o.userData.wall) o.castShadow = a > 0.5; });
}

/* ---------------- krok ---------------- */
let last = performance.now(), statT = 0, acc = 0, lifting = false;
const LIFT = 0.2;   // podnoszenie pras: 20 cm/s
const overlap = (a, b, e) => a[0] - e < b[3] && b[0] - e < a[3] && a[1] - e < b[4] && b[1] - e < a[4] && a[2] - e < b[5] && b[2] - e < a[5];
const H = 1 / 60;   // stały krok fizyki (blacha liczy się tak samo przy każdej liczbie klatek)
function simStep(h) {
  const v = S.speed / 100;   // cm/s → m/s
  for (const P of presses) {
    P.moving = lifting ? P.y < P.y0 : v > 0 && P.y > P.stop;
    if (P.moving) {
      P.y = lifting ? Math.min(P.y0, P.y + LIFT * h) : Math.max(P.stop, P.y - v * h);
      P.box.set(pressMatrix(P)); P.mesh.matrix.copy(P.box.matrix);
    } else P.box.set(P.box.matrix);   // prasa stoi: poprzednie położenie = obecne (tarcie bez przesunięcia)
  }
  if (lifting && presses.every((P) => P.y >= P.y0)) { lifting = false; api.speed(0); }   // na górze — stoją, aż suwak ruszy
  const many = rigs.length > 1 && rigs[0].press === rigs[1].press;   // kontener: beczki stykają się ze sobą
  const boxes = many ? rigs.map((r) => r.shell.box()) : null, e = CR * 2 + 0.02;
  rigs.forEach((r, i) => {
    const P = r.press;
    if (P.moving && P.y < r.shell.bounds()[1] + 0.02) r.shell.wake();
    let others = null;
    if (many) {
      others = [];
      rigs.forEach((o, j) => { if (j !== i && overlap(boxes[i], boxes[j], e)) { others.push(o.shell.particles); if (o.shell.awake && !r.shell.awake) r.shell.wake(); } });
    }
    // w kontenerze prasa naciska przez inne beczki — plastyczność, gdy zjeżdża i jest już na beczkach
    const pin = grab && grab.rig === r ? { ids: grab.ids, off: grab.off, target: grab.target, k: 0.5 } : null;
    if (pin) r.shell.wake();
    r.shell.step(h, { ground: r.ground, boxes: [P.box, ...r.supports], others, yield: many && P.moving && !lifting && P.y < topY() + 0.02, pin });
  });
}
const topY = () => Math.max(...rigs.map((r) => r.shell.bounds()[1]));
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // krok w zgodzie z wątkami: nowy krok dopiero, gdy wszystkie beczki skończyły poprzedni (prasa i sąsiedzi widziani przez
  // beczkę są zawsze sprzed jednego kroku); gdy wątki nie nadążają — symulacja zwalnia zamiast się rozjeżdżać
  acc += dt; let n = 0;
  while (acc >= H && n < 3 && !rigs.some((r) => r.shell.pending)) { simStep(H); acc -= H; n++; }
  if (acc > H) acc = H;   // zaległości nie nadrabia
  if ((statT += dt) > 0.25) { statT = 0; stats(); }
  moveKeys(dt);
  const c = Math.cos(orbit.pitch);
  camera.position.set(orbit.target.x + Math.sin(orbit.yaw) * c * orbit.dist, orbit.target.y + Math.sin(orbit.pitch) * orbit.dist, orbit.target.z + Math.cos(orbit.yaw) * c * orbit.dist);
  camera.lookAt(orbit.target);
  stage.follow(orbit.target, 14);
  stage.render();
  requestAnimationFrame(loop);
}
function stats() {
  const rows = rigs.map((r) => { const s = r.shell.stats(); return [r.set.label, `${Math.round(s.crush * 100)} % · prasa ${(r.press.y * 100).toFixed(0)} cm`]; });
  $('bStats').replaceChildren(...rows.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: b })]));
  const s0 = rigs[0] ? rigs[0].shell.stats() : null;
  if (window.LabPerf && s0) window.LabPerf.modelRows([['Beczki', String(rigs.length)], ['Cząstki na beczkę', s0.particles.toLocaleString('pl')], ['Więzy na beczkę', s0.constraints.toLocaleString('pl')], ['Liczone teraz', rigs.filter((r) => r.shell.awake).length + ' / ' + rigs.length]]);
  status(grab ? 'Beczka przyklejona do kursora — kliknij, by puścić' : lifting ? 'Prasy jadą do góry' : S.speed > 0 ? (presses.every((P) => P.y <= P.stop) ? 'Prasy na dole — „Podnieś prasy” albo „Od nowa”' : 'Prasy zjeżdżają') : 'Prasy stoją — przesuń suwak prędkości');
}

/* ---------------- kamera ---------------- */
const orbit = { target: new THREE.Vector3(0, 0.6, 0), dist: 13, yaw: 0.35, pitch: 0.32 };
const CAMS_C = { Kontener: { yaw: 0.55, pitch: 0.42, dist: 5.2, t: [0, 0.8, 0] }, 'Z boku': { yaw: 0, pitch: 0.12, dist: 4.6, t: [0, 0.8, 0] }, 'Z góry': { yaw: 0, pitch: 1.35, dist: 4.4, t: [0, 0.6, 0] } };
const CAMS_B = { Plansza: { yaw: 0.35, pitch: 0.32, dist: 13, t: [0, 0.6, 0] }, Pionowo: { yaw: 0.6, pitch: 0.2, dist: 3.4, t: [-6, 0.5, 0] }, '23°': { yaw: 0.6, pitch: 0.2, dist: 3.4, t: [-3, 0.5, 0] },
  '45°': { yaw: 0.6, pitch: 0.2, dist: 3.4, t: [0, 0.5, 0] }, '68°': { yaw: 0.6, pitch: 0.2, dist: 3.4, t: [3, 0.5, 0] }, Bokiem: { yaw: 0.6, pitch: 0.2, dist: 3.4, t: [6, 0.4, 0] } };
const setCam = (v) => { Object.assign(orbit, { yaw: v.yaw, pitch: v.pitch, dist: v.dist }); orbit.target.set(...v.t); };
function cams() {
  const C = S.scene === 'container' ? CAMS_C : CAMS_B;
  $('cams').replaceChildren(...Object.entries(C).map(([k, v]) => { const b = el('button', { type: 'button', textContent: k }); b.onclick = () => setCam(v); return b; }));
  setCam(Object.values(C)[0]);
}
const cv = renderer.domElement; let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (grab) aim(e);
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
  if (drag.moved) { orbit.yaw -= dx * 0.005; orbit.pitch = Math.max(0.01, Math.min(1.52, orbit.pitch + dy * 0.004)); }
});
cv.addEventListener('pointerup', (e) => { const click = drag && !drag.moved; drag = null; if (click && e.button === 0) clickPick(e); });

/* ---------------- chwytanie beczki myszą ---------------- */
// kliknięcie na beczkę przykleja ją do kursora w punkcie trafienia (cząstki w promieniu 8 cm ciągnięte do celu), kursor
// prowadzi ten punkt po płaszczyźnie pionowej zwróconej do kamery — w górę podnosi; kolejne kliknięcie puszcza
let grab = null;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane();
function pointer(e) { const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
function clickPick(e) {
  if (grab) { grab = null; cv.classList.remove('grabbing'); status('Puszczona'); return; }
  pointer(e);
  const hits = ray.intersectObjects(rigs.map((r) => r.model), true);
  if (!hits.length) return;
  const p = hits[0].point, rig = rigs.find((r) => { let o = hits[0].object; while (o && o !== r.model) o = o.parent; return !!o; });
  if (!rig) return;
  const X = rig.shell.particles, ids = [], off = [];
  let best = -1, bd = Infinity;
  for (let i = 0; i < X.length / 3; i++) {
    const d = Math.hypot(X[i * 3] - p.x, X[i * 3 + 1] - p.y, X[i * 3 + 2] - p.z);
    if (d < bd) { bd = d; best = i; }
    if (d < 0.08) { ids.push(i); off.push(X[i * 3] - p.x, X[i * 3 + 1] - p.y, X[i * 3 + 2] - p.z); }
  }
  if (!ids.length) { ids.push(best); off.push(X[best * 3] - p.x, X[best * 3 + 1] - p.y, X[best * 3 + 2] - p.z); }
  const n = new THREE.Vector3(camera.position.x - p.x, 0, camera.position.z - p.z).normalize();
  plane.setFromNormalAndCoplanarPoint(n, p);
  grab = { rig, ids, off, target: [p.x, p.y, p.z] };
  rig.shell.wake(); cv.classList.add('grabbing'); status('Beczka przyklejona do kursora — kliknij, by puścić');
}
const hitP = new THREE.Vector3();
function aim(e) {
  pointer(e);
  if (!ray.ray.intersectPlane(plane, hitP)) return;
  grab.target[0] = hitP.x; grab.target[1] = Math.max(grab.rig.ground + 0.02, Math.min(3, hitP.y)); grab.target[2] = hitP.z;
}

/* ---------------- WSAD: przesuwanie kamery ---------------- */
const held = new Set();
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());
const fwd = new THREE.Vector3(), side = new THREE.Vector3();
function moveKeys(dt) {
  if (!held.size) return;
  const f = (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0), s = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
  if (!f && !s) return;
  fwd.set(-Math.sin(orbit.yaw), 0, -Math.cos(orbit.yaw)); side.set(-fwd.z, 0, fwd.x);
  const v = Math.max(1, orbit.dist) * 0.8 * dt;   // szybciej z daleka
  orbit.target.addScaledVector(fwd, f * v).addScaledVector(side, s * v);
}
cv.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.min(60, Math.max(1.2, orbit.dist * Math.exp(e.deltaY * 0.0011))); }, { passive: false });

/* ---------------- UI ---------------- */
const fmtSpeed = (v) => (v ? `${v.toFixed(1)} cm/s` : 'stop');
$('speed').value = S.speed; $('speedV').textContent = fmtSpeed(S.speed);
$('speed').oninput = () => { S.speed = +$('speed').value; $('speedV').textContent = fmtSpeed(S.speed); save(); };
$('reset').onclick = () => build();
$('lift').onclick = () => lift();
function lift() { lifting = true; rigs.forEach((r) => r.shell.wake()); }
const fmtAlpha = (a) => `${Math.round(a * 100)} %`;
$('alpha').value = S.alpha; $('alphaV').textContent = fmtAlpha(S.alpha);
$('alpha').oninput = () => { S.alpha = +$('alpha').value; $('alphaV').textContent = fmtAlpha(S.alpha); applyAlpha(); save(); };
function setScene(sc) {
  S.scene = sc; save();
  for (const b of document.querySelectorAll('#scenes button')) b.classList.toggle('on', b.dataset.scene === sc);
  $('alphaBox').hidden = sc !== 'container';
  $('info').textContent = sc === 'container' ? $('info').dataset.container : $('info').dataset.board;
  build(); cams();
}
for (const b of document.querySelectorAll('#scenes button')) b.onclick = () => setScene(b.dataset.scene);
$('weather').replaceChildren(...Object.entries(WEATHER).map(([k, w]) => el('option', { value: k, textContent: w.label || k })));
$('weather').value = S.weather; $('weather').onchange = () => { S.weather = $('weather').value; sky(); save(); };
for (const k of ['sunEl', 'sunAz']) { $(k).value = S[k]; $(k + 'V').textContent = S[k] + '°'; $(k).oninput = () => { S[k] = +$(k).value; $(k + 'V').textContent = S[k] + '°'; sky(); save(); }; }
function sky() { stage.setSky({ weather: S.weather, sunEl: S.sunEl, sunAz: S.sunAz }); }
addEventListener('keydown', (e) => {
  if (e.target.closest('input,select,textarea')) return;
  if (e.code === 'KeyH') document.querySelectorAll('[data-window]').forEach((p) => p.classList.toggle('hidden-panel'));
  if (e.code === 'KeyR') build();
  if (e.code === 'KeyU') lift();
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) held.add(e.code);
});

// DeformationApi.speed(cm/s), lift(), scene('board' | 'container'), alpha(0–1), reset(), state(),
// run(sekundy) → Promise — kroki prasy i blachy
const api = window.DeformationApi = {
  speed(v) { S.speed = v; $('speed').value = v; $('speedV').textContent = fmtSpeed(v); save(); return v; },
  lift() { lift(); },
  scene(sc) { setScene(sc); return this.state(); },
  alpha(a) { S.alpha = a; $('alpha').value = a; $('alphaV').textContent = fmtAlpha(a); applyAlpha(); return a; },
  reset() { build(); return this.state(); },
  state: () => rigs.map((r) => ({ set: r.set.label, press: +r.press.y.toFixed(3), stop: +r.press.stop.toFixed(3), ...r.shell.stats(), awake: r.shell.awake })),
  get rigs() { return rigs; },
  // run(sekundy) → Promise: kroki po kolei, każdy czeka na wątki beczek
  async run(sec = 1) { for (let t = 0; t < sec; t += H) { simStep(H); await Promise.all(rigs.map((r) => r.shell.settled())); } return this.state(); },
  view(target = [0, 0.6, 0], dist = 13, yaw = 0.35, pitch = 0.32) { orbit.target.set(...target); Object.assign(orbit, { dist, yaw, pitch }); },
};

sky(); setScene(S.scene === 'container' ? 'container' : 'board'); applyTextures();
requestAnimationFrame(loop);
