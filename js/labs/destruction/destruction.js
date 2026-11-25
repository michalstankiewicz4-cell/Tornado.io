// Laboratorium zniszczeń: budynek HouseKit (js/models/houses/housekit.js) w świecie DestructKit (js/destruct/world.js)
// na kawałku trawy pod niebem SkyKit. Narzędzia: uderzenie w punkcie (impuls, promień), rzut przedmiotem z kamery
// (prawdziwa masa i prędkość — zderzenie liczy świat), trąba powietrzna (wiatr niszczy części i unosi lekkie odłamki).
// Dla AI: DestructionApi.
import * as THREE from '../../../vendor/three/three.module.js';
import { createStage, WEATHER } from '../../core/stage.js';
import { createWorld } from '../../destruct/world.js';
import { MATS } from '../../destruct/materials.js';
import { HOUSE_TYPES as HK_TYPES, buildHouse as buildHK } from '../../models/houses/housekit.js';
import { LANDMARKS, landmarkHouse } from '../../models/houses/landmark-house.js';
// rodzaje: budynki HouseKit i budynki Warszawy z laboratorium miasta (CityKit, OpenStreetMap) przeliczone na części
const HOUSE_TYPES = { ...HK_TYPES, ...Object.fromEntries(Object.entries(LANDMARKS).map(([id, name]) => ['lm:' + id, { name: 'Warszawa: ' + name, note: 'Budynek z laboratorium miasta (CityKit, dane © współtwórcy OpenStreetMap): obrysy części, wysokości, piętra i styl z mapy przeliczone na części, które pękają według materiału.' }])) };
const buildHouse = (type, o) => (type.startsWith('lm:') ? landmarkHouse(type.slice(3)) : buildHK(type, o));
import { createTornado, tornadoWind } from '../../envs/sky/tornado.js';
import { groundDisc } from '../../world/ground.js';
import { loadState } from '../shared/saved.js';
import { ITEMS, loadItems, makeItem } from '../../world/items.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach((k) => e.append(k)); return e; };
const KEY = 'tornado.destruction.v1';
const DEFAULTS = { type: 'cottage', seed: 1, village: false, tool: 'hit', impulse: 2500, radius: 0.6, missile: 'barrel', speed: 30, wind: 75, core: 4, slow: 1, maxFrag: 2500, pause: false,
  showMats: false, weather: 'fair', sunEl: 34, sunAz: 215 };
const S = loadState(KEY, DEFAULTS, { type: Object.keys(HOUSE_TYPES), seed: (v) => Number.isInteger(v) && v >= 1, weather: Object.keys(WEATHER) });
if (!HOUSE_TYPES[S.type]) S.type = 'cottage';
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* prywatny tryb */ } };
const status = (t) => { $('status').textContent = t || ''; };

/* ---------------- scena ---------------- */
const stage = createStage($('view'));
const { scene, camera, renderer } = stage;
scene.add(groundDisc(420));
const tornado = createTornado(scene);
let twist = null;   // trąba: { x, z, vx, vz, until }
const world = createWorld(scene, { ground: () => 0, wind: (x, y, z, out) => (twist && tornado.state ? tornadoWind(tornado.state, x, y, z, out) : (out[0] = out[1] = out[2] = 0, out)) });
let itemsReady = false;
loadItems().then(() => { itemsReady = true; });

/* ---------------- budynek ---------------- */
let house = null;
function rebuild() {
  world.clear();
  const t0 = performance.now();
  if (S.village) {
    const lay = [['cottage', -14, 6, 0.1], ['kostka', 6, 8, -0.05], ['barn', -8, -16, 0.02], ['garage', 18, -4, 1.57], ['shed', -26, -4, 0.4], ['block', 14, -26, 0]];
    lay.forEach(([t, x, z, r], i) => world.addHouse(buildHouse(t, { seed: S.seed + i }), { x, z, rot: r }));
    house = buildHouse(S.type, { seed: S.seed });
  } else {
    house = buildHouse(S.type, { seed: S.seed });
    world.addHouse(house, { x: 0, z: 0 });
  }
  world.maxFragments = S.maxFrag;
  info(performance.now() - t0);
  recolor();
  save();
}
const MAT_COL = { brick: '#b0503a', plaster: '#e8dcc0', blocks: '#9a9890', concrete: '#a8a8a2', panel: '#c9c2b0', wood: '#8a6a44', floor: '#a08058', beam: '#6e5136', frame: '#f0f0f0',
  door: '#5d3e26', glass: '#7fc4e0', tiles: '#9a3a22', metal: '#7a6e64', tin: '#5f6b72', felt: '#333' };
const FALSE = { brick: '#e05a3a', plaster: '#ffe08a', blocks: '#b0b0b0', concrete: '#66aaff', panel: '#5588ee', wood: '#c8902a', floor: '#e0b060', beam: '#a06a20', frame: '#ffffff', door: '#8a4a10', glass: '#40ffff', tiles: '#ff3a8a', metal: '#b060ff', tin: '#8040c0', felt: '#40ff60' };
function recolor() {
  const c = new THREE.Color();
  for (const b of world.buildings) for (const p of b.parts) {
    const col = S.showMats ? c.set(FALSE[p.mat] || '#fff') : (b.tint && (p.mat === 'plaster' || p.mat === 'panel') ? c.copy(b.tint) : c.set(1, 1, 1));
    if (p.handle) world.batches.color(p.handle, col);
    if (p.cells) for (const cl of p.cells) if (cl.on) world.batches.color(cl.h, col);
  }
}
function info(ms) {
  $('bName').textContent = S.village ? 'Wioska' : house.name;
  $('bNote').textContent = S.village ? 'Sześć różnych budynków obok siebie — do sprawdzenia rzutów i przejścia trąby.' : HOUSE_TYPES[S.type].note;
  const counts = {};
  for (const b of world.buildings) for (const p of b.parts) counts[p.mat] = (counts[p.mat] || 0) + 1;
  $('mats').replaceChildren(...Object.entries(counts).flatMap(([m, n]) => {
    const sw = el('i'); sw.style.background = (S.showMats ? FALSE : MAT_COL)[m] || '#888';
    return [sw, el('span', { textContent: MATS[m].name }), el('b', { textContent: String(n) })];
  }));
  if (ms != null) builtMs = ms;
}
let builtMs = 0;
function stats() {
  const s = world.stats();
  const rows = [['Części', `${s.intact} / ${s.parts}`], ['Zniszczone', `${Math.round(s.destroyed * 100)} %`], ['Odłamki', s.fragments.toLocaleString('pl')],
    ['W ruchu', s.active], ['W spoczynku', s.sleep], ['Rozmiar', house.size.map((v) => v.toFixed(1)).join(' × ') + ' m']];
  $('bStats').replaceChildren(...rows.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: String(b) })]));
  window.LabPerf.modelRows([['Siatki w batchach', s.geoms.toLocaleString('pl')], ['Wierzchołki', s.verts.toLocaleString('pl')], ['Batche (materiały)', s.draws], ['Zbudowany w', Math.round(builtMs) + ' ms']]);
}

/* ---------------- narzędzia ---------------- */
const TOOLS = { hit: 'Uderzenie', throw: 'Rzut', wind: 'Trąba' };
function setTool(t) { S.tool = TOOLS[t] ? t : 'hit'; [...$('tools').children].forEach((b) => b.classList.toggle('on', b.dataset.t === S.tool)); save(); }
$('tools').replaceChildren(...Object.entries(TOOLS).map(([k, v], i) => { const b = el('button', { type: 'button', textContent: v, title: `${v} (${i + 1})` }); b.dataset.t = k; b.onclick = () => setTool(k); return b; }));
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function pick(e) {
  const v = stage.size(), r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / v.w) * 2 - 1, -((e.clientY - r.top) / v.h) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(world.batches.meshes(), false);
  if (hits.length) return hits[0].point;
  return ray.ray.intersectPlane(groundPlane, new THREE.Vector3());
}
function act(e) {
  const p = pick(e); if (!p) return;
  if (S.tool === 'hit') {
    const n = world.hit(p, ray.ray.direction.clone().multiplyScalar(S.impulse), { radius: S.radius });
    status(n ? `Pękło: ${n}` : 'Część wytrzymała — uderz mocniej albo jeszcze raz');
  } else if (S.tool === 'throw') {
    if (!itemsReady) { status('Przedmioty jeszcze się budują…'); return; }
    const it = makeItem(S.missile, { variant: Math.floor(Math.random() * 4) });
    const from = camera.position.clone().addScaledVector(ray.ray.direction, 2);
    it.obj.position.copy(from); scene.add(it.obj);
    const b = world.addObject(it.obj, { ...it, sleep: false });
    // tor balistyczny: celujemy nieco wyżej, żeby trafić w punkt mimo grawitacji
    const d = p.clone().sub(from), tFlight = d.length() / S.speed;
    b.v.copy(d).divideScalar(tFlight); b.v.y += 0.5 * 9.81 * tFlight;
    b.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6);
    status(`${it.name}: ${it.m < 1 ? it.m.toFixed(2) : Math.round(it.m)} kg × ${S.speed} m/s = ${Math.round(it.m * S.speed)} N·s`);
  } else {
    twist = { x: p.x, z: p.z, vx: 0, vz: 0, until: Infinity };
    status('Trąba w punkcie — Zatrzymaj, żeby ją wyłączyć');
  }
}
$('sweep').onclick = () => { const r = Math.max(30, house.size[0] + 25); twist = { x: -r, z: (Math.random() - 0.5) * 4, vx: 5, vz: 0, until: r }; status('Trąba idzie przez budynek'); };
$('stop').onclick = () => { twist = null; tornado.set(null); status(''); };

/* ---------------- kamera ---------------- */
const orbit = { target: new THREE.Vector3(0, 3, 0), dist: 30, yaw: 0.6, pitch: 0.32 };
const CAMS = { Orbita: { yaw: 0.6, pitch: 0.32 }, Nisko: { yaw: 0.35, pitch: 0.08 }, Bok: { yaw: Math.PI / 2, pitch: 0.15 }, 'Z góry': { yaw: 0.3, pitch: 1.3 } };
$('cams').replaceChildren(...Object.entries(CAMS).map(([k, v]) => { const b = el('button', { type: 'button', textContent: k }); b.onclick = () => Object.assign(orbit, v); return b; }));
const cv = renderer.domElement; let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 4) { orbit.yaw -= dx * 0.005; orbit.pitch = Math.max(0.02, Math.min(1.5, orbit.pitch + dy * 0.004)); } });
cv.addEventListener('pointerup', (e) => { if (drag && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) <= 4 && e.button === 0) act(e); drag = null; });
cv.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.min(400, Math.max(3, orbit.dist * Math.exp(e.deltaY * 0.0011))); }, { passive: false });
function frameCam() { const r = Math.max(...house.size) * (S.village ? 3.5 : 1); orbit.dist = r * 2.2 + 6; orbit.target.set(0, house.size[1] * 0.35, 0); }

/* ---------------- panele ---------------- */
$('type').replaceChildren(...Object.entries(HOUSE_TYPES).map(([k, v]) => el('option', { value: k, textContent: v.name })));
$('type').value = S.type; $('type').onchange = () => { S.type = $('type').value; S.village = false; rebuild(); frameCam(); };
$('seed').value = S.seed; $('seed').onchange = () => { S.seed = Math.max(1, Math.round(+$('seed').value || 1)); $('seed').value = S.seed; rebuild(); };
$('another').onclick = () => { S.seed = 1 + Math.floor(Math.random() * 99998); $('seed').value = S.seed; S.village = false; rebuild(); };
$('village').onclick = () => { S.village = true; rebuild(); frameCam(); };
$('rebuild').onclick = () => { twist = null; tornado.set(null); rebuild(); };
$('showMats').checked = S.showMats; $('showMats').onchange = () => { S.showMats = $('showMats').checked; recolor(); info(); save(); };
$('missile').replaceChildren(...Object.entries(ITEMS).map(([k, v]) => el('option', { value: k, textContent: `${v.name}` })));
$('missile').value = S.missile; $('missile').onchange = () => { S.missile = $('missile').value; save(); };
const fmt = { impulse: (v) => `${(+v).toLocaleString('pl')} N·s`, radius: (v) => `${(+v).toFixed(2)} m`, speed: (v) => `${v} m/s`, wind: (v) => `${v} m/s`, core: (v) => `${(+v).toFixed(1)} m`,
  slow: (v) => `× ${(+v).toFixed(2)}`, maxFrag: (v) => (+v).toLocaleString('pl') };
for (const [k, f] of Object.entries(fmt)) {
  $(k).value = S[k]; $(k + 'V').textContent = f(S[k]);
  $(k).oninput = () => { S[k] = +$(k).value; $(k + 'V').textContent = f(S[k]); if (k === 'maxFrag') world.maxFragments = S.maxFrag; save(); };
}
$('pause').checked = S.pause; $('pause').onchange = () => { S.pause = $('pause').checked; save(); };
$('weather').replaceChildren(...Object.entries(WEATHER).map(([k, w]) => el('option', { value: k, textContent: w.label || k })));
$('weather').value = S.weather; $('weather').onchange = () => { S.weather = $('weather').value; sky(); save(); };
for (const k of ['sunEl', 'sunAz']) { $(k).value = S[k]; $(k + 'V').textContent = S[k] + '°'; $(k).oninput = () => { S[k] = +$(k).value; $(k + 'V').textContent = S[k] + '°'; sky(); save(); }; }
function sky() { stage.setSky({ weather: S.weather, sunEl: S.sunEl, sunAz: S.sunAz }); }
addEventListener('keydown', (e) => {
  if (e.target.closest('input,select,textarea')) return;
  if (e.code === 'KeyH') document.querySelectorAll('[data-window]').forEach((p) => p.classList.toggle('hidden-panel'));
  if (e.code === 'Digit1') setTool('hit'); if (e.code === 'Digit2') setTool('throw'); if (e.code === 'Digit3') setTool('wind');
  if (e.code === 'KeyB') { twist = null; tornado.set(null); rebuild(); }
});

/* ---------------- pętla ---------------- */
let last = performance.now(), statT = 0;
const W3 = [0, 0, 0];
function simStep(dt) {
  // trąba: wir na miarę z suwaków, idzie po prostej albo stoi
  if (twist) {
    twist.x += twist.vx * dt; twist.z += twist.vz * dt;
    if (twist.x > twist.until) { twist = null; tornado.set(null); }
    else tornado.set({ strength: Math.min(1, S.wind / 100), rc: S.core, top: 30 + S.core * 12, vmax: S.wind, kind: 'land' });
  }
  tornado.update(dt, camera, { at: twist ? [twist.x, twist.z] : null, groundAt: () => 0, isWater: () => false, light: stage.light ? Math.min(1, stage.light.day + 0.2) : 1 });
  if (twist && tornado.state && dt > 0) {
    const T = tornado.state;
    world.windDamage(T.x, T.z, T.rc * 3, (x, y, z) => { tornadoWind(T, x, y, z, W3); return Math.hypot(W3[0], W3[1], W3[2]); }, dt);
    // śpiące odłamki w zasięgu wiatru budzą się
    for (const b of world.bodies) if (b.state === 'sleep' && Math.hypot(b.p.x - T.x, b.p.z - T.z) < T.rc * 3) world.wake(b);
  }
  if (dt > 0) world.update(dt); else world.sync();
}
function frame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  const dt = S.pause ? 0 : rdt * S.slow;
  simStep(dt);
  const c = Math.cos(orbit.pitch);
  camera.position.set(orbit.target.x + Math.sin(orbit.yaw) * c * orbit.dist, orbit.target.y + Math.sin(orbit.pitch) * orbit.dist, orbit.target.z + Math.cos(orbit.yaw) * c * orbit.dist);
  camera.lookAt(orbit.target);
  stage.follow(orbit.target, Math.max(30, Math.max(...house.size) * (S.village ? 3.5 : 1.6)));
  stage.render();
  if ((statT += rdt) > 0.25) { statT = 0; stats(); }
  requestAnimationFrame(frame);
}

/* ---------------- dla AI ---------------- */
// DestructionApi.build(type, seed), village(), hit([x, y, z], [jx, jy, jz], radius), throw(item, [x, y, z], speed),
// sweep(), stats(), types
window.DestructionApi = {
  types: Object.fromEntries(Object.entries(HOUSE_TYPES).map(([k, v]) => [k, v.name])),
  build(type, seed) { if (type && HOUSE_TYPES[type]) S.type = type; if (Number.isInteger(seed) && seed >= 1) S.seed = seed; S.village = false; $('type').value = S.type; $('seed').value = S.seed; rebuild(); frameCam(); return world.stats(); },
  village() { S.village = true; rebuild(); frameCam(); return world.stats(); },
  hit(p, j, radius = 0.6) { return world.hit(new THREE.Vector3(...p), new THREE.Vector3(...j), { radius }); },
  sweep() { $('sweep').onclick(); },
  tornadoAt(x, z) { twist = { x, z, vx: 0, vz: 0, until: Infinity }; },
  // symulacja bez rysowania: sekundy czasu gry krokami 1/30 s (trąba, wiatr, odłamki)
  simulate(sec = 1) { for (let t = 0; t < sec; t += 1 / 30) simStep(1 / 30); return world.stats(); },
  stats: () => world.stats(),
  world,
};

sky(); setTool(S.tool); rebuild(); frameCam();
requestAnimationFrame(frame);
