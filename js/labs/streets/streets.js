// Laboratorium ulic: próbki StreetKit (js/models/streets/streetkit.js) na trawie pod niebem SkyKit — prosta ulica, łuk,
// skrzyżowania (4 i 3 wloty), aleja, droga wiejska, ścieżka, droga dla rowerów. Przekrój i nawierzchnie na suwakach.
// Dla AI: StreetsApi.
import * as THREE from '../../../vendor/three/three.module.js';
import { createStage, WEATHER } from '../../core/stage.js';
import { groundDisc } from '../../world/ground.js';
import { PROFILES, SURFACES, buildStreet, buildCrossing } from '../../models/streets/streetkit.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach((k) => e.append(k)); return e; };
const KEY = 'tornado.streets.v1';
let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { saved = null; }

// próbki: linia trasy albo skrzyżowanie; przekrój domyślny
const SCENES = {
  straight: { label: 'Prosta ulica', profile: 'city', note: 'Ulica miejska: dwa pasy ruchu po 3,25 m z osią przerywaną, krawężnik 14 cm, chodnik z płyt 2,5 m, pas zieleni.', line: [[-40, 0], [40, 0]] },
  curve: { label: 'Łuk', profile: 'city', note: 'Ta sama ulica prowadzona po łuku — przekrój idzie za linią (krzywa Catmulla–Roma).', line: [[-40, -18], [-15, -16], [5, -4], [18, 14], [24, 40]] },
  crossing: { label: 'Skrzyżowanie', profile: 'city', note: 'Cztery wloty, łuki krawężników i chodników na narożach, przejścia dla pieszych (zebra), linie zatrzymania na pasach wjazdowych.', crossing: 4 },
  tee: { label: 'Skrzyżowanie T', profile: 'city', note: 'Trzy wloty; po stronie bez wlotu prosty chodnik wzdłuż brzegu skrzyżowania.', crossing: 3 },
  avenue: { label: 'Aleja', profile: 'avenue', note: 'Dwie jezdnie po dwa pasy, pas dzielący z trawnikiem, chodnik z kostki, droga dla rowerów z czerwonej kostki, drugi chodnik z płyt.', line: [[-45, 0], [45, 0]] },
  village: { label: 'Droga wiejska', profile: 'village', note: 'Stary asfalt bez oznakowania i krawężników, pobocza z kruszywa, rów z trawą.', line: [[-45, 10], [-20, 4], [0, 8], [20, -2], [45, -8]] },
  path: { label: 'Ścieżka', profile: 'path', note: 'Ścieżka z kruszywa z obrzeżem, kręta, przez trawnik.', line: [[-30, -10], [-15, 6], [0, -2], [12, 12], [28, 4]] },
  cycle: { label: 'Droga dla rowerów', profile: 'cycle', note: 'Czerwona kostka z osią przerywaną, niski krawężnik, chodnik z szarej kostki obok.', line: [[-35, 6], [-5, -4], [35, 2]] },
};
const S = { scene: 'straight', profile: 'city', lanes: 2, laneW: 3.25, road: 'asphalt', marks: true, walkW: 2.5, curbH: 0.14, walk: 'slabs', corner: 6, weather: 'fair', sunEl: 32, sunAz: 215, ...(saved || {}) };
if (!SCENES[S.scene]) S.scene = 'straight'; if (!PROFILES[S.profile]) S.profile = 'city';
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* prywatny tryb */ } };

const stage = createStage($('view'));
const { scene, camera, renderer } = stage;
scene.add(groundDisc(200));
const holder = new THREE.Group(); scene.add(holder);

// przekrój z suwaków (na bazie wybranego profilu): jezdnia, krawężnik, chodnik o zadanej szerokości i nawierzchni
function profile() {
  const P = JSON.parse(JSON.stringify(PROFILES[S.profile]));
  P.lanes = S.lanes; P.laneW = S.laneW; P.road = S.road; if (!S.marks) P.marks = null;
  for (const st of P.strips) {
    if (st.k === 'curb' || st.k === 'sidewalk' || st.k === 'cycle' || st.k === 'verge' || st.k === 'edge') st.h = st.k === 'verge' && st.h < 0 ? st.h : Math.max(0, S.curbH) || 0.001;
    if (st.k === 'sidewalk') { st.w = S.walkW; st.s = S.walk; }
  }
  P.strips = P.strips.filter((st) => st.w > 0.01);
  return P;
}
let built = { tris: 0, ms: 0 };
function rebuild() {
  holder.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); holder.clear();
  const t0 = performance.now(), sc = SCENES[S.scene], P = profile();
  const r = sc.crossing ? buildCrossing(P, { arms: sc.crossing, arm: 32, corner: S.corner }) : buildStreet(sc.line, P);
  holder.add(r.group); holder.position.y = 0.02;
  let tris = 0; holder.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  built = { tris, ms: performance.now() - t0, len: r.length, width: r.width };
  $('sName').textContent = sc.label; $('sNote').textContent = sc.note;
  const half = P.lanes * P.laneW;
  $('sStats').replaceChildren(...[['Przekrój', PROFILES[S.profile].label], ['Jezdnia', `${P.lanes} × ${P.laneW.toFixed(2)} m = ${half.toFixed(2)} m`], ...(r.width ? [['Cała szerokość', `${r.width.toFixed(1)} m`]] : []), ...(r.length ? [['Długość', `${r.length.toFixed(0)} m`]] : []), ['Trójkąty', Math.round(tris).toLocaleString('pl')]]
    .flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: String(b) })]));
  window.LabPerf.modelRows([['Siatki', holder.children[0] ? countMeshes() : 0], ['Trójkąty', Math.round(tris).toLocaleString('pl')], ['Zbudowane w', Math.round(built.ms) + ' ms']]);
  save();
}
const countMeshes = () => { let n = 0; holder.traverse((o) => { if (o.isMesh) n++; }); return n; };

/* ---------------- panele ---------------- */
$('scene').replaceChildren(...Object.entries(SCENES).map(([k, v]) => el('option', { value: k, textContent: v.label })));
$('profile').replaceChildren(...Object.entries(PROFILES).map(([k, v]) => el('option', { value: k, textContent: v.label })));
for (const id of ['road', 'walk']) $(id).replaceChildren(...Object.entries(SURFACES).map(([k, v]) => el('option', { value: k, textContent: v.label })));
function fromProfile() {
  const P = PROFILES[S.profile], sw = P.strips.find((x) => x.k === 'sidewalk'), curb = P.strips.find((x) => x.k === 'curb' || x.k === 'sidewalk' || x.k === 'edge');
  Object.assign(S, { lanes: P.lanes, laneW: P.laneW, road: P.road, marks: !!P.marks, walkW: sw ? sw.w : 0, walk: sw ? sw.s : 'slabs', curbH: curb ? Math.max(0, curb.h) : 0 });
}
const fmt = { lanes: (v) => String(v), laneW: (v) => `${(+v).toFixed(2)} m`, walkW: (v) => `${(+v).toFixed(1)} m`, curbH: (v) => `${Math.round(v * 100)} cm`, corner: (v) => `${(+v).toFixed(1)} m` };
function show() {
  $('scene').value = S.scene; $('profile').value = S.profile; $('road').value = S.road; $('walk').value = S.walk; $('marks').checked = S.marks;
  for (const [k, f] of Object.entries(fmt)) { $(k).value = S[k]; $(k + 'V').textContent = f(S[k]); }
}
$('scene').onchange = () => { S.scene = $('scene').value; S.profile = SCENES[S.scene].profile; fromProfile(); show(); rebuild(); frame0(); };
$('profile').onchange = () => { S.profile = $('profile').value; fromProfile(); show(); rebuild(); };
$('road').onchange = () => { S.road = $('road').value; rebuild(); };
$('walk').onchange = () => { S.walk = $('walk').value; rebuild(); };
$('marks').onchange = () => { S.marks = $('marks').checked; rebuild(); };
for (const [k, f] of Object.entries(fmt)) { $(k).oninput = () => { S[k] = +$(k).value; $(k + 'V').textContent = f(S[k]); }; $(k).onchange = () => rebuild(); }
$('weather').replaceChildren(...Object.entries(WEATHER).map(([k, w]) => el('option', { value: k, textContent: w.label || k })));
$('weather').value = S.weather; $('weather').onchange = () => { S.weather = $('weather').value; sky(); save(); };
for (const k of ['sunEl', 'sunAz']) { $(k).value = S[k]; $(k + 'V').textContent = S[k] + '°'; $(k).oninput = () => { S[k] = +$(k).value; $(k + 'V').textContent = S[k] + '°'; sky(); save(); }; }
function sky() { stage.setSky({ weather: S.weather, sunEl: S.sunEl, sunAz: S.sunAz }); }
addEventListener('keydown', (e) => { if (e.code === 'KeyH' && !e.target.closest('input,select,textarea')) document.querySelectorAll('[data-window]').forEach((p) => p.classList.toggle('hidden-panel')); });

/* ---------------- kamera ---------------- */
const orbit = { target: new THREE.Vector3(0, 0, 0), dist: 45, yaw: 0.7, pitch: 0.45 };
const CAMS = { Orbita: { yaw: 0.7, pitch: 0.45, dist: 45 }, Pieszy: { yaw: 0.25, pitch: 0.03, dist: 9 }, 'Z góry': { yaw: 0, pitch: 1.45, dist: 70 }, Kierowca: { yaw: Math.PI / 2, pitch: 0.06, dist: 16 } };
$('cams').replaceChildren(...Object.entries(CAMS).map(([k, v]) => { const b = el('button', { type: 'button', textContent: k }); b.onclick = () => Object.assign(orbit, v); return b; }));
function frame0() { orbit.dist = SCENES[S.scene].crossing ? 60 : 50; orbit.target.set(0, 0, 0); }
const cv = renderer.domElement; let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; orbit.yaw -= dx * 0.005; orbit.pitch = Math.max(0.01, Math.min(1.52, orbit.pitch + dy * 0.004)); });
cv.addEventListener('pointerup', () => { drag = null; });
cv.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.min(300, Math.max(2, orbit.dist * Math.exp(e.deltaY * 0.0011))); }, { passive: false });

function loop() {
  const c = Math.cos(orbit.pitch);
  camera.position.set(orbit.target.x + Math.sin(orbit.yaw) * c * orbit.dist, orbit.target.y + 1.6 + Math.sin(orbit.pitch) * orbit.dist, orbit.target.z + Math.cos(orbit.yaw) * c * orbit.dist);
  camera.lookAt(orbit.target.x, orbit.target.y + 1, orbit.target.z);
  stage.follow(orbit.target, 70);
  stage.render();
  requestAnimationFrame(loop);
}

// StreetsApi.scene(id), set({ profile, lanes, laneW, road, marks, walkW, curbH, walk, corner }), profiles, surfaces
window.StreetsApi = {
  scenes: Object.fromEntries(Object.entries(SCENES).map(([k, v]) => [k, v.label])), profiles: Object.fromEntries(Object.entries(PROFILES).map(([k, v]) => [k, v.label])), surfaces: Object.keys(SURFACES),
  scene(id) { $('scene').value = id; $('scene').onchange(); return { ...S }; },
  set(o = {}) { if (o.profile) { S.profile = o.profile; fromProfile(); } for (const k of Object.keys(o)) if (k in S && k !== 'profile') S[k] = o[k]; show(); rebuild(); return { ...S }; },
  camera(name) { if (CAMS[name]) Object.assign(orbit, CAMS[name]); },
};

sky(); show(); rebuild(); frame0();
requestAnimationFrame(loop);
