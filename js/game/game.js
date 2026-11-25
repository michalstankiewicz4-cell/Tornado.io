// Tornado.io — gra. Teren z wioską (js/game/terrain.js), budynki HouseKit w świecie zniszczeń DestructKit
// (js/destruct/world.js), drzewa PlantKit (js/game/trees.js), przedmioty JunkKit i RockKit (js/world/items.js),
// trąba gracza (js/game/player.js). Kamera za trąbą, celowanie myszą, rzut lewym przyciskiem. Dla AI: TornadoApi.
import * as THREE from '../../vendor/three/three.module.js';
import { createStage, WEATHER } from '../core/stage.js';
import { createWorld } from '../destruct/world.js';
import { buildHouse } from '../models/houses/housekit.js';
import { landmarkHouse } from '../models/houses/landmark-house.js';
import { build as buildCity, setNight } from '../models/city/citykit.js';
import DATA from '../models/city/landmarks/osm-data.js';
import { createTerrain, cityPaving, heightAt, roadZ, onRoad, CITY } from './terrain.js';
import { createTrees } from './trees.js';
import { loadItems, createItemPool } from '../world/items.js';
import { createPlayer } from './player.js';
import { createFire } from '../render/effects/fire/firekit.js';
import { createBurning } from '../destruct/burn.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach((k) => e.append(k)); return e; };
const KEY = 'tornado.game.v1';
let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { saved = null; }
const S = { weather: 'fair', sunEl: 36, zoom: 1, ...(saved || {}) };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* prywatny tryb */ } };
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const step = (name, f) => (window.LabLoad ? window.LabLoad.step(name, f) : Promise.resolve());

/* ---------------- scena ---------------- */
const stage = createStage($('view'), { far: 3000 });
const { scene, camera, renderer } = stage;
camera.near = 0.3; camera.updateProjectionMatrix();
const sky = () => stage.setSky({ weather: S.weather, sunEl: S.sunEl, sunAz: 215 });
sky();

/* ---------------- mapa: wioska wzdłuż drogi ---------------- */
// [rodzaj, x, strona drogi (1 północ, −1 południe), odsunięcie od drogi] — front budynku zawsze do drogi
const HOUSES = [
  ['cottage', -112, 1, 13], ['garage', -100, 1, 14], ['shed', -120, -1, 18], ['kostka', -78, 1, 16], ['cottage', -60, -1, 13], ['shed', -48, 1, 26],
  ['barn', -30, 1, 32], ['kostka', -18, -1, 16], ['garage', -6, -1, 15], ['cottage', 8, 1, 13], ['shed', 20, 1, 24], ['kostka', 36, -1, 16],
  ['cottage', 52, 1, 13], ['garage', 64, 1, 14], ['barn', 70, -1, 36], ['kostka', 88, 1, 16], ['cottage', 104, -1, 13], ['shed', 116, 1, 22],
  ['block', 146, 1, 24], ['block', 150, -1, 26],
];
// miasto na wschodzie: budynki Warszawy z laboratorium miasta (CityKit, OpenStreetMap) — Pałac Kultury i wieżowce
// w układzie jak w mapie (na zachód od Pałacu), odległości ściśnięte do 70 %; [id, x, z względem Pałacu]
const PX = 692;
const LANDMARK_LAYOUT = [['defilad-1', 0, 0], ['zlota-44', -178, 43], ['emilii-plater-49', -177, -46], ['chmielna-69', -292, 229], ['jerozolimskie-54', -143, 230],
  ['rondo-onz-1', -300, -88], ['twarda-2-4', -216, -287], ['europejski-1', -420, -32], ['chlodna-51', -440, -283]];
const START = { x: -175, z: roadZ(-175) };
const WIND = [2.6, 1.2];   // lekki wiatr z zachodu [x, z] m/s: kładzie płomienie, niesie dym i ogień

async function build() {
  await step('Teren', 0.05);
  const terrain = createTerrain(); scene.add(terrain.mesh); scene.add(cityPaving());
  const world = createWorld(scene, { ground: heightAt, maxFragments: 3000, physicsWorker: new URL('./physics-env.js', import.meta.url).href });   // fizyka odłamków w osobnym wątku
  await step('Budynki', 0.15);
  const spots = [];   // zajęte miejsca: [x, z, promień]
  HOUSES.forEach(([type, x, side, set], i) => {
    const h = buildHouse(type, { seed: 17 + i * 13 });
    const z = roadZ(x) + side * (set + h.size[2] / 2);
    world.addHouse(h, { x, z, rot: side > 0 ? Math.PI : 0 });
    spots.push([x, z, Math.hypot(h.size[0], h.size[2]) / 2 + 1.5, h]);
  });
  const rects = [];   // zajęte prostokąty (obrysy budynków z mapy)
  const visuals = [];
  for (const [k, [id, dx, dz]] of LANDMARK_LAYOUT.entries()) {
    await step('Miasto: ' + DATA[id].name, 0.18 + 0.12 * k / LANDMARK_LAYOUT.length);
    const x = PX + dx, z = dz;
    // wygląd: model z laboratorium miasta; części do zniszczenia z tych samych danych czekają ukryte
    const vis = buildCity({ landmark: id }, { detail: 0.5 });   // wersja daleka CityKit: wypalone fasady z paralaksą
    vis.group.position.set(x, heightAt(x, z), z); scene.add(vis.group); vis.group.updateMatrixWorld(true);
    const bld = world.addHouse(landmarkHouse(id), { x, z, hidden: true });
    bld.visual = vis; visuals.push(vis.group);
    const o = DATA[id].outer; rects.push([x + Math.min(...o.map((q) => q[0])) - 3, z + Math.min(...o.map((q) => q[1])) - 3, x + Math.max(...o.map((q) => q[0])) + 3, z + Math.max(...o.map((q) => q[1])) + 3]);
  }
  world.onReveal((bld) => { if (bld.visual) { scene.remove(bld.visual.group); const i = visuals.indexOf(bld.visual.group); if (i >= 0) visuals.splice(i, 1); bld.visual.dispose(); bld.visual = null; } });
  setNight(0);
  const free = (x, z, r) => !onRoad(x, z) && Math.abs(z - roadZ(x)) > 4 + r && spots.every(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) > sr + r)
    && rects.every(([a, b, c, d]) => x < a - r || x > c + r || z < b - r || z > d + r);

  await step('Drzewa', 0.3);
  const r = rng(42), list = [];
  const plant = (x, z, species, scale = 0.7 + r() * 0.4) => { if (free(x, z, 2.5)) { list.push({ x, z, species, seed: Math.floor(r() * 1000), scale }); spots.push([x, z, 2.5]); } };
  // sady i drzewa za domami
  for (const [hx, hz, hr, h] of spots.slice(0, HOUSES.length)) {
    if (!h || h.type === 'block') continue;
    const away = Math.sign(hz - roadZ(hx)) || 1;
    for (let k = 0; k < 2 + Math.floor(r() * 3); k++) plant(hx + (r() - 0.5) * hr * 3, hz + away * (hr + 4 + r() * 14), r() < 0.55 ? 'birch' : 'oak', 0.55 + r() * 0.35);
  }
  // las sosnowo-świerkowy na zachodzie i północy, zagajniki brzozowe, dęby przy drodze
  for (let k = 0; k < 70; k++) plant(-250 + r() * 90, 50 + r() * 150, r() < 0.6 ? 'pine' : 'spruce', 0.75 + r() * 0.4);
  for (let k = 0; k < 40; k++) plant(105 + r() * 75, -270 + r() * 110, r() < 0.5 ? 'spruce' : 'pine', 0.7 + r() * 0.4);
  // drzewa w mieście (skwery między budynkami)
  for (let k = 0; k < 90; k++) plant(CITY.x0 + 20 + r() * (CITY.x1 - CITY.x0 - 40), CITY.z0 + 20 + r() * (CITY.z1 - CITY.z0 - 40), r() < 0.6 ? 'oak' : 'birch', 0.5 + r() * 0.3);
  for (let k = 0; k < 25; k++) { const a = r() * 6.28, d = r() * 22; plant(-140 + Math.cos(a) * d, -70 + Math.sin(a) * d, 'birch', 0.6 + r() * 0.4); }
  for (let k = 0; k < 18; k++) { const x = -150 + r() * 300; plant(x, roadZ(x) + (r() < 0.5 ? 1 : -1) * (7 + r() * 3), 'oak', 0.6 + r() * 0.3); }
  for (let k = 0; k < 14; k++) plant(-200 + r() * 400, (r() < 0.5 ? 1 : -1) * (90 + r() * 80), 'juniper', 0.8 + r() * 0.5);
  const forest = createTrees(scene, list, heightAt);

  await step('Przedmioty', 0.55);
  await loadItems();
  const pool = createItemPool(scene);
  const _m = new THREE.Matrix4(), _s = new THREE.Vector3();
  function drop(id, x, z, variant = Math.floor(r() * 4)) {
    const it = pool.spawn(id, variant), gy = heightAt(x, z);
    const tip = id.startsWith('tire') ? Math.PI / 2 * (r() < 0.7 ? 1 : 0) : (id === 'newspapers' || id === 'box' || r() < 0.7 ? 0 : Math.PI / 2);   // opony leżą, puszki czasem przewrócone
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tip, r() * 6.28, 0));
    const hy = new THREE.Vector3(it.half.x, it.half.y, it.half.z).applyQuaternion(q);
    const stand = { position: new THREE.Vector3(x, gy + Math.abs(hy.y) - 0.01, z), quaternion: q };
    const b = world.addObject(stand, { ...it, kind: 'item', sleep: true, onSync: (bb) => it.set(_m.compose(bb.p, bb.q, _s.setScalar(bb.scale || 1))) });
    b.onRemove = () => it.free(); b.itemId = id;   // id — palność przedmiotu (js/destruct/burn.js)
    return b;
  }
  const SMALL = ['can', 'can', 'can-crushed', 'can-crushed', 'newspapers', 'box', 'box', 'tire-bike', 'pot', 'pebble', 'pebble'];
  const MED = ['barrel', 'barrel', 'tire-car', 'tire-car', 'tire-tractor', 'rock'];
  const pickR = (a) => a[Math.floor(r() * a.length)];
  // podwórka: drobiazgi i kilka cięższych rzeczy
  for (const [hx, hz, hr, h] of spots.slice(0, HOUSES.length)) {
    for (let k = 0; k < 16; k++) { const a = r() * 6.28, d = hr + 1 + r() * 9, x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d; if (free(x, z, 0.3)) drop(pickR(SMALL), x, z); }
    for (let k = 0; k < (h.type === 'barn' ? 6 : 3); k++) { const a = r() * 6.28, d = hr + 2 + r() * 6, x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d; if (free(x, z, 0.8)) drop(pickR(MED), x, z); }
  }
  // śmieci przy drodze (najwięcej na początku — trąba startuje na zachodzie)
  for (let k = 0; k < 220; k++) {
    const x = -200 + 380 * r() ** 1.4, z = roadZ(x) + (r() < 0.5 ? 1 : -1) * (3.2 + r() * 4);
    if (free(x, z, 0.2)) drop(pickR(SMALL), x, z);
  }
  // hałdy złomu przy stodołach i na skraju wioski
  for (const [cx, cz] of [[-30, roadZ(-30) + 58], [70, roadZ(70) - 62], [-150, roadZ(-150) - 16]]) {
    for (let k = 0; k < 26; k++) { const a = r() * 6.28, d = r() * 7, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (free(x, z, 0.3)) drop(r() < 0.6 ? pickR(SMALL) : pickR(MED), x, z); }
  }
  // miasto: gazety, puszki, kartony i beczki na placu
  for (let k = 0; k < 400; k++) { const x = CITY.x0 + r() * (CITY.x1 - CITY.x0), z = CITY.z0 + r() * (CITY.z1 - CITY.z0); if (free(x, z, 0.4)) drop(r() < 0.85 ? pickR(SMALL) : pickR(MED), x, z); }
  // głazy na polach
  for (let k = 0; k < 24; k++) { const x = (r() < 0.5 ? -1 : 1) * (150 + r() * 120), z = (r() - 0.5) * 220; if (x < CITY.x0 - 5 && free(x, z, 1.2)) drop(r() < 0.5 ? 'boulder' : 'rock', x, z); }

  await step('Ogień', 0.88);
  // pożary: FireKit (wygląd, z laboratorium efektów GameLaboratory) i rozprzestrzenianie po palnych materiałach (DestructKit)
  const fire = createFire(scene);
  const burning = createBurning({ world, fire, terrain, forest, wind: WIND });
  await step('Trąba', 0.9);
  const player = createPlayer(scene, world, { heightAt, forest, x: START.x, z: START.z, bound: [-300, CITY.x1 - 10, -300, 300] });
  return { terrain, world, forest, pool, player, visuals, fire, burning };
}

/* ---------------- HUD i panele ---------------- */
const KEYS = [['W A S D', 'ruch trąby'], ['Strzałki', 'przesuwanie kamery'], ['C', 'kamera z powrotem nad trąbę'], ['Mysz', 'celowanie'], ['Lewy przycisk', 'rzut najcięższą rzeczą'], ['Prawy przycisk', 'podpalenie w celu'],
  ['Prawy (przeciągnij), Q / E', 'obrót kamery'], ['Kółko', 'odległość kamery'], ['P', 'pauza'], ['R', 'nowa gra'], ['H', 'chowa okna']];
$('keys').replaceChildren(...KEYS.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: b })]));
$('weather').replaceChildren(...Object.entries(WEATHER).map(([k, w]) => el('option', { value: k, textContent: w.label || k })));
$('weather').value = S.weather; $('weather').onchange = () => { S.weather = $('weather').value; sky(); save(); };
$('sunEl').value = S.sunEl; $('sunElV').textContent = S.sunEl + '°';
$('sunEl').oninput = () => { S.sunEl = +$('sunEl').value; $('sunElV').textContent = S.sunEl + '°'; sky(); save(); };
const status = (t) => { $('status').textContent = t || ''; };
let bigT = 0;
function big(text, sub = '') { $('big').replaceChildren(document.createTextNode(text), ...(sub ? [el('small', { textContent: sub })] : [])); $('big').classList.add('on'); bigT = 2.6; }
const feed = [];
function addFeed(t) { feed.unshift({ t, life: 4 }); if (feed.length > 6) feed.pop(); }
const fmtKg = (m) => (m < 1 ? `${Math.round(m * 1000)} g` : m < 1000 ? `${Math.round(m)} kg` : `${(m / 1000).toFixed(1)} t`);

/* ---------------- sterowanie ---------------- */
const keys = new Set();
let paused = false, G = null;
addEventListener('keydown', (e) => {
  if (e.target.closest('input,select,textarea')) return;
  keys.add(e.code);
  if (e.code.startsWith('Arrow')) e.preventDefault();   // strzałki przesuwają kamerę, nie stronę
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR') location.reload();
  if (e.code === 'KeyH') document.querySelectorAll('[data-window]').forEach((p) => p.classList.toggle('hidden-panel'));
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function togglePause() { paused = !paused; $('pauseBtn').classList.toggle('on', paused); status(paused ? 'Pauza' : ''); }
$('pauseBtn').onclick = togglePause;
$('newGame').onclick = () => location.reload();
$('labLink').onclick = () => { location.href = 'labs/destruction.html'; };
const cam = { yaw: Math.PI / 2, dist: 1 };   // kamera patrzy na wschód, wzdłuż drogi
const cv = renderer.domElement, ndc = new THREE.Vector2(0, -0.2), ray = new THREE.Raycaster();
let rdrag = null;
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointermove', (e) => {
  const v = stage.size(), rc = cv.getBoundingClientRect();
  ndc.set(((e.clientX - rc.left) / v.w) * 2 - 1, -((e.clientY - rc.top) / v.h) * 2 + 1);
  if (rdrag) { if (Math.abs(e.clientX - rdrag.x0) > 5) rdrag.moved = true; cam.yaw -= (e.clientX - rdrag.x) * 0.006; rdrag.x = e.clientX; }
});
cv.addEventListener('pointerdown', (e) => {
  // prawy przycisk: kliknięcie — podpalenie w celu, przeciągnięcie — obrót kamery
  if (e.button === 2) { rdrag = { x: e.clientX, x0: e.clientX, moved: false }; cv.setPointerCapture(e.pointerId); }
  if (e.button === 0 && G && !paused) {
    const b = G.player.throwAt(aim.clone());
    if (b) addFeed(`Rzut: ${b.name || 'gruz'} (${fmtKg(b.m)})`); else status('Nic nie niesiesz — podleć do beczki, opony albo głazu');
  }
});
cv.addEventListener('pointerup', (e) => {
  if (e.button !== 2) return;
  if (rdrag && !rdrag.moved && G && !paused) { updateAim(); const n = G.burning.ignite(aim.clone()); addFeed(n ? 'Podpalone' : 'Tu nic się nie pali (tylko drewno, papa, trawa, papier, opony, drzewa)'); }
  rdrag = null;
});
cv.addEventListener('wheel', (e) => { e.preventDefault(); S.zoom = Math.min(3, Math.max(0.4, S.zoom * Math.exp(e.deltaY * 0.001))); save(); }, { passive: false });

// cel: promień z kamery do budynków (BatchedMesh) albo do terenu (marsz po wysokości)
const aim = new THREE.Vector3();
const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2b84b, transparent: true, opacity: 0.85, depthTest: false, fog: false }));
ring.renderOrder = 10; scene.add(ring);
function updateAim() {
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  let hit = null;
  const hits = ray.intersectObjects([...G.world.batches.meshes(), ...G.visuals], true);
  if (hits.length && hits[0].distance < 400) hit = hits[0].point;
  if (!hit) {
    let t = 0, prev = 0;
    for (; t < 600; t += 2) { const p = o.clone().addScaledVector(d, t); if (p.y < heightAt(p.x, p.z)) break; prev = t; }
    for (let i = 0; i < 8; i++) { const m = (prev + t) / 2, p = o.clone().addScaledVector(d, m); if (p.y < heightAt(p.x, p.z)) t = m; else prev = m; }
    hit = o.clone().addScaledVector(d, t);
  }
  aim.copy(hit);
  ring.position.set(aim.x, Math.max(aim.y, heightAt(aim.x, aim.z)) + 0.05, aim.z);
  const s = Math.max(0.6, G.player.R * 0.35); ring.scale.setScalar(s);
}

/* ---------------- pętla ---------------- */
let last = performance.now(), statT = 0, playT = 0;
const camTarget = new THREE.Vector3(), move = [0, 0], pan = new THREE.Vector3();
function frame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  const P = G.player, dt = paused ? 0 : rdt;
  if (keys.has('KeyQ')) cam.yaw += 1.6 * rdt; if (keys.has('KeyE')) cam.yaw -= 1.6 * rdt;
  // ruch względem kamery
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);   // naprzód (od kamery)
  let mx = 0, mz = 0;
  if (keys.has('KeyW')) { mx += fx; mz += fz; }
  if (keys.has('KeyS')) { mx -= fx; mz -= fz; }
  if (keys.has('KeyA')) { mx += fz; mz -= fx; }
  if (keys.has('KeyD')) { mx -= fz; mz += fx; }
  // strzałki: przesuwanie kamery względem trąby (szybciej z daleka)
  const ps = (20 + P.R * 6) * S.zoom * rdt;
  if (keys.has('ArrowUp')) { pan.x += fx * ps; pan.z += fz * ps; }
  if (keys.has('ArrowDown')) { pan.x -= fx * ps; pan.z -= fz * ps; }
  if (keys.has('ArrowLeft')) { pan.x += fz * ps; pan.z -= fx * ps; }
  if (keys.has('ArrowRight')) { pan.x -= fz * ps; pan.z += fx * ps; }
  if (pan.length() > 400) pan.setLength(400);
  if (keys.has('KeyC')) pan.set(0, 0, 0);   // C — kamera z powrotem nad trąbę
  const L = Math.hypot(mx, mz) || 1; move[0] = mx / L; move[1] = mz / L;
  if (dt > 0) {
    playT += dt;
    P.update(dt, move, camera, stage.light ? Math.min(1, stage.light.day + 0.25) : 1);
    G.world.update(dt);
    G.forest.tick(dt);
    G.burning.update(dt);
  }
  G.fire.update(dt, camera, { wind: [WIND[0], 0, WIND[1]], light: stage.light ? 0.15 + 0.85 * stage.light.day : 1, sky: stage.light ? stage.light.sky : null });
  G.forest.wind(0.35 + Math.min(1, P.R / 12) * 0.5, 30);
  // kamera za trąbą, wyżej i dalej, gdy rośnie
  const cx0 = P.x + pan.x, cz0 = P.z + pan.z, gy = heightAt(cx0, cz0), dist = (11 + P.R * 4.2) * S.zoom, hgt = (5 + P.R * 2.4) * S.zoom;
  camTarget.lerp(new THREE.Vector3(cx0, gy + 1.5 + P.R * 0.9, cz0), 1 - Math.exp(-6 * rdt));
  if (!frame.init) { camTarget.set(P.x, gy + 2, P.z); frame.init = true; }
  camera.position.set(camTarget.x - fx * dist, camTarget.y + hgt, camTarget.z - fz * dist);
  camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + 1.5);
  camera.lookAt(camTarget.x + fx * P.R * 2, camTarget.y, camTarget.z + fz * P.R * 2);
  if ((frame.n = (frame.n || 0) + 1) % 3 === 0) updateAim();   // promień do 27 tys. części — co trzecią klatkę wystarczy
  stage.follow(camTarget, Math.max(45, dist * 1.6));
  stage.render();
  if ((bigT -= rdt) <= 0) $('big').classList.remove('on');
  if ((statT += rdt) > 0.2) { hud(statT, playT); statT = 0; }
  requestAnimationFrame(frame);
}
function hud(dt, t) {
  const P = G.player, s = G.world.stats();
  for (const f of feed) f.life -= dt;
  while (feed.length && feed[feed.length - 1].life <= 0) feed.pop();
  $('feed').replaceChildren(...feed.map((f) => el('div', { textContent: f.t })));
  const lvl = Math.floor(P.R), frac = P.R - lvl;
  $('meter').style.width = (frac * 100).toFixed(1) + '%';
  $('meterLbl').textContent = `Rdzeń ${P.R.toFixed(2)} m — do ${lvl + 1} m`;
  const rows = [['Rdzeń', `${P.R.toFixed(2)} m`], ['Wiatr', `${Math.round(22 + P.R * 4.5)} m/s`], ['Zjedzone', P.eaten.toLocaleString('pl')], ['Masa zjedzona', fmtKg(P.eatenMass)],
    ['Objętość', `${P.V.toFixed(2)} m³`], ['Niesione', `${P.held.length} / ${P.cap}`], ['Rzuty', P.thrown], ['Czas', `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`]];
  $('tStats').replaceChildren(...rows.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: String(b) })]));
  const bs = G.burning.stats();
  const vrows = [['Zniszczenia', `${(s.destroyed * 100).toFixed(1)} %`], ['Pożar', bs.parts + bs.bodies + bs.trees + bs.grass ? `${bs.parts} części, ${bs.trees} drzew, ${bs.bodies} rzeczy, ${bs.grass} m² trawy` : '—'], ['Wypalone', `${Math.round(bs.burnt * 12)} m²`], ['Części całe', `${s.intact} / ${s.parts}`], ['Odłamki', s.fragments], ['Drzewa wyrwane', G.forest.trees.filter((x) => !x.alive).length]];
  $('vStats').replaceChildren(...vrows.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: String(b) })]));
  window.LabPerf.modelRows([['Bryły', G.world.bodies.size], ['W ruchu', s.active], ['Batche budynków', s.draws], ['Instancje przedmiotów', G.pool.draws()]]);
  if (!paused) status(P.held.length ? `Niesiesz ${P.held.length} — kliknij, żeby rzucić w budynek` : P.R < 2 ? 'Zjadaj puszki, gazety i kartony przy drodze — rośniesz' : '');
}

/* ---------------- dla AI ---------------- */
// TornadoApi.state(), go(x, z), throwAt([x, y, z]), simulate(sekundy, [mx, mz])
window.TornadoApi = {
  state: () => { const P = G.player; return { x: +P.x.toFixed(1), z: +P.z.toFixed(1), R: +P.R.toFixed(2), V: +P.V.toFixed(3), eaten: P.eaten, held: P.held.length, ...G.world.stats() }; },
  ignite(p) { return G.burning.ignite(new THREE.Vector3(...p)); },
  burnStats: () => G.burning.stats(),
  go(x, z) { G.player.x = x; G.player.z = z; return this.state(); },
  hit(p, j, radius = 1) { return G.world.hit(new THREE.Vector3(...p), new THREE.Vector3(...j), { radius }); },
  throwAt(p) { const b = G.player.throwAt(new THREE.Vector3(...p)); return b ? { name: b.name, m: b.m } : null; },
  simulate(sec = 1, mv = [0, 0]) { for (let t = 0; t < sec; t += 1 / 30) { G.player.update(1 / 30, mv, camera); G.world.update(1 / 30, { sync: true }); G.burning.update(1 / 30); } return this.state(); },   // krok na głównym wątku (od razu)
  camera(zoom, yaw) { if (zoom) S.zoom = zoom; if (yaw != null) cam.yaw = yaw; return { zoom: S.zoom, yaw: cam.yaw }; },
  get G() { return G; },
};

build().then((g) => {
  G = g;
  G.player.onEat((b) => { if (b.m > 5 || b.kind === 'tree') addFeed(`Zjedzone: ${b.name || (b.kind === 'frag' ? 'gruz' : 'coś')} (${fmtKg(b.m)})`); });
  G.player.onGrow((R) => big(`Rdzeń ${Math.floor(R)} m`, R < 3 ? 'Podnosisz już beczki i opony — rzucaj nimi w szyby' : R < 5 ? 'Wiatr zrywa dachówki i blachę' : R < 8 ? 'Wyrywasz drzewa' : 'Mury nie wytrzymują'));
  if (window.LabLoad) window.LabLoad.done();
  big('Tornado.io', 'Zjadaj drobne rzeczy i rośnij. W A S D — ruch, mysz — cel, klik — rzut.');
  requestAnimationFrame(frame);
}).catch((e) => { console.error(e); status('Błąd: ' + e.message); if (window.LabLoad) window.LabLoad.done(); });
