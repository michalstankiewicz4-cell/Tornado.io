// Laboratorium deformacji: stalowe beczki 200 l (JunkKit, js/models/junkyard/items/barrel.js) jako powłoki DeformKit
// (js/deform/shell.js) pod stalowymi blokami prasy. Pięć beczek na jednej planszy: pionowo, pochylone o 23°, 45° i 68°
// (oparte bokiem o betonowe podpory) i bokiem (zablokowana klinami). Suwak opuszcza wszystkie bloki z jedną prędkością.
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
const S = { speed: 0, weather: 'fair', sunEl: 38, sunAz: 215, ...(saved || {}) };
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

/* ---------------- plansza ---------------- */
let rigs = [];
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
  holder.clear(); rigs = [];
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
    const press = { y0: hi + 0.08, y: hi + 0.08, stop, x: px, half: pressHalf };
    press.box = makeBox(pressHalf, pressMatrix(press), 0.8); press.box.plastic = true;
    press.mesh = new THREE.Mesh(new THREE.BoxGeometry(pressHalf[0] * 2, pressHalf[1] * 2, pressHalf[2] * 2), steel);
    press.mesh.castShadow = press.mesh.receiveShadow = true; press.mesh.matrixAutoUpdate = false; press.mesh.matrix.copy(press.box.matrix); holder.add(press.mesh);
    rigs.push({ set, shell, supports, press, h0: hi });
  });
  stats();
}
function pressMatrix(p) { return new THREE.Matrix4().makeTranslation(p.x, p.y + p.half[1], 0); }

/* ---------------- krok ---------------- */
let last = performance.now(), statT = 0, acc = 0;
const H = 1 / 60;   // stały krok fizyki (blacha liczy się tak samo przy każdej liczbie klatek)
function simStep(h) {
  const v = S.speed / 100;   // cm/s → m/s
  for (const r of rigs) {
    const P = r.press;
    if (v > 0 && P.y > P.stop) {
      P.y = Math.max(P.stop, P.y - v * h);
      P.box.set(pressMatrix(P)); P.mesh.matrix.copy(P.box.matrix);
      const [, hi] = r.shell.bounds();
      if (P.y < hi + 0.02) r.shell.wake();
    } else P.box.set(P.box.matrix);   // prasa stoi: poprzednie położenie = obecne (tarcie bez przesunięcia)
    r.shell.step(h, { ground: 0, boxes: [P.box, ...r.supports] });
  }
}
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  acc += dt; let n = 0;
  while (acc >= H && n < 3) { simStep(H); acc -= H; n++; }
  if (n === 3) acc = 0;   // nie nadąża — zwalnia zamiast się zapętlić
  if ((statT += dt) > 0.25) { statT = 0; stats(); }
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
  if (window.LabPerf && s0) window.LabPerf.modelRows([['Cząstki na beczkę', s0.particles.toLocaleString('pl')], ['Więzy na beczkę', s0.constraints.toLocaleString('pl')], ['Liczone teraz', rigs.filter((r) => r.shell.awake).length + ' / ' + rigs.length]]);
  status(S.speed > 0 ? (rigs.every((r) => r.press.y <= r.press.stop) ? 'Prasy na dole — „Od nowa” stawia nowe beczki' : 'Prasy zjeżdżają') : 'Prasy stoją — przesuń suwak prędkości');
}

/* ---------------- kamera ---------------- */
const orbit = { target: new THREE.Vector3(0, 0.6, 0), dist: 13, yaw: 0.35, pitch: 0.32 };
const CAMS = { Plansza: { yaw: 0.35, pitch: 0.32, dist: 13, t: [0, 0.6, 0] }, Pionowo: { yaw: 0.6, pitch: 0.2, dist: 3.4, t: [-6, 0.5, 0] }, '23°': { yaw: 0.6, pitch: 0.2, dist: 3.4, t: [-3, 0.5, 0] },
  '45°': { yaw: 0.6, pitch: 0.2, dist: 3.4, t: [0, 0.5, 0] }, '68°': { yaw: 0.6, pitch: 0.2, dist: 3.4, t: [3, 0.5, 0] }, Bokiem: { yaw: 0.6, pitch: 0.2, dist: 3.4, t: [6, 0.4, 0] } };
const setCam = (v) => { Object.assign(orbit, { yaw: v.yaw, pitch: v.pitch, dist: v.dist }); orbit.target.set(...v.t); };
$('cams').replaceChildren(...Object.entries(CAMS).map(([k, v]) => { const b = el('button', { type: 'button', textContent: k }); b.onclick = () => setCam(v); return b; }));
const cv = renderer.domElement; let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; orbit.yaw -= dx * 0.005; orbit.pitch = Math.max(0.01, Math.min(1.52, orbit.pitch + dy * 0.004)); });
cv.addEventListener('pointerup', () => { drag = null; });
cv.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.min(60, Math.max(1.2, orbit.dist * Math.exp(e.deltaY * 0.0011))); }, { passive: false });

/* ---------------- UI ---------------- */
const fmtSpeed = (v) => (v ? `${v.toFixed(1)} cm/s` : 'stop');
$('speed').value = S.speed; $('speedV').textContent = fmtSpeed(S.speed);
$('speed').oninput = () => { S.speed = +$('speed').value; $('speedV').textContent = fmtSpeed(S.speed); save(); };
$('reset').onclick = () => build();
$('weather').replaceChildren(...Object.entries(WEATHER).map(([k, w]) => el('option', { value: k, textContent: w.label || k })));
$('weather').value = S.weather; $('weather').onchange = () => { S.weather = $('weather').value; sky(); save(); };
for (const k of ['sunEl', 'sunAz']) { $(k).value = S[k]; $(k + 'V').textContent = S[k] + '°'; $(k).oninput = () => { S[k] = +$(k).value; $(k + 'V').textContent = S[k] + '°'; sky(); save(); }; }
function sky() { stage.setSky({ weather: S.weather, sunEl: S.sunEl, sunAz: S.sunAz }); }
addEventListener('keydown', (e) => {
  if (e.target.closest('input,select,textarea')) return;
  if (e.code === 'KeyH') document.querySelectorAll('[data-window]').forEach((p) => p.classList.toggle('hidden-panel'));
  if (e.code === 'KeyR') build();
});

// DeformationApi.speed(cm/s), reset(), state(), run(sekundy) → Promise — kroki prasy i blachy
window.DeformationApi = {
  speed(v) { S.speed = v; $('speed').value = v; $('speedV').textContent = fmtSpeed(v); return v; },
  reset() { build(); return this.state(); },
  state: () => rigs.map((r) => ({ set: r.set.label, press: +r.press.y.toFixed(3), stop: +r.press.stop.toFixed(3), ...r.shell.stats(), awake: r.shell.awake })),
  get rigs() { return rigs; },
  // run(sekundy) → Promise: kroki po kolei, każdy czeka na wątki beczek
  async run(sec = 1) { for (let t = 0; t < sec; t += H) { simStep(H); await Promise.all(rigs.map((r) => r.shell.settled())); } return this.state(); },
  view(target = [0, 0.6, 0], dist = 13, yaw = 0.35, pitch = 0.32) { orbit.target.set(...target); Object.assign(orbit, { dist, yaw, pitch }); },
};

sky(); build(); applyTextures();
requestAnimationFrame(loop);
