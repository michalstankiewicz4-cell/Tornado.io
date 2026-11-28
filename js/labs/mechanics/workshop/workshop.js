// Warsztat (etap 6, czwarty tryb laboratorium mechaniki): pusty stół, na który wstawia się części napędu obrotowego z katalogu
// (workshop/catalog.js), ustawia je i łączy portami klikając. Łączenie dopasowuje położenie części do fizyki połączenia:
//   piasta na wale (koło, sprzęgło, tarcza) — współosiowo, w zasięgu wału; wał w sprzęgle — w wolnej piaście; łożysko pod wałem —
//   wysokość oprawy z osi; koło do koła — odległość osi m·(z₁ + z₂)/2; łańcuch — odległość z parzystej liczby ogniw; pas — w jednej
//   płaszczyźnie. Przesuwana jest część klikana jako pierwsza razem ze wszystkim, co jest na niej osadzone.
// Ruch liczy ten sam silnik napędu co Maszyna (behaviors/mech/drive.js): graf od silnika, przełożenia z połączeń, bezwładność
// zredukowana, moment silnika z poślizgu, hamulec na wyjściu. Ostrzeżenia: część niepołączona, zakleszczenie, wał bez podparcia.
// Zapis w przeglądarce (localStorage), przykład do obejrzenia. createWorkshop(ctx) → { group, setActive, step, onPointer, onKey, api }
import * as THREE from '../../../../vendor/three/three.module.js';
import * as MK from '../../../models/mech/mechkit.js';
import { createDrive } from '../../../behaviors/mech/drive.js';
import { WS_PARTS, partDef } from './catalog.js';
import { T, tr } from '../lang.js';

const TAU = Math.PI * 2, X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), KEY = 'tornado.mechanics.workshop', GRID = 0.01;
const snap = (v) => Math.round(v / GRID) * GRID;

export function createWorkshop({ scene, camera, dom, M, fmt, el, view }) {
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  // stół warsztatowy: blat z rowkami teowymi, nogi
  const C0 = new THREE.Vector3(0, 0, 3.4), BW = 2.4, BD = 1.0, TOP = 0.75;
  { const bg = new THREE.BoxGeometry(BW, 0.06, BD), uv = bg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * BW / 1.2, uv.getY(i) * BD / 1.2);
    const b = new THREE.Mesh(bg, M.bed); b.position.set(C0.x, TOP - 0.03, C0.z); b.castShadow = b.receiveShadow = true; group.add(b);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, TOP - 0.06, 0.08), M.iron); l.position.set(C0.x + sx * (BW / 2 - 0.1), (TOP - 0.06) / 2, C0.z + sz * (BD / 2 - 0.1)); l.castShadow = l.receiveShadow = true; group.add(l); }
    for (const z of [-0.3, 0, 0.3]) { const s = new THREE.Mesh(new THREE.BoxGeometry(BW - 0.1, 0.0002, 0.018), M.black); s.position.set(C0.x, TOP + 0.0001, C0.z + z); group.add(s); }
    const L = new THREE.SpotLight(0xffe2b8, 16, 8, 0.8, 0.6, 1.6); L.position.set(C0.x, 3.2, C0.z + 1.2); L.target.position.set(C0.x, TOP, C0.z); group.add(L, L.target); }
  const parts = [], links = [];
  let nextId = 1, sel = null, place = null, linkFrom = null, dragging = null, msg = '', drive = null, solved = null, running = false, rpm = 1000, brake = 5, theta = 0, dirty = true;
  const selBox = new THREE.BoxHelper(new THREE.Object3D(), 0xf0c040); selBox.visible = false; group.add(selBox);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3();

  /* ---------------- części ---------------- */
  function make(type, params, id = nextId++) {
    const def = partDef(type), p = {}; for (const q of def.params) p[q.key] = params[q.key] ?? q.def;
    const b = def.build(p), pivot = new THREE.Group(); pivot.add(b.group); group.add(pivot);
    const part = { id: `w${id}`, n: id, type, def, params: p, b, pivot, rot: 0 };
    nextId = Math.max(nextId, id + 1);
    pivot.traverse((o) => { o.userData.wsPart = part; });
    return part;
  }
  const role = (pt) => pt.def.role;
  const axisDir = (pt) => X.clone().applyAxisAngle(Y, pt.rot * Math.PI / 2);
  const axisLocal = (pt) => (role(pt) === 'motor' || role(pt) === 'support' ? new THREE.Vector3(0, pt.b.axisY, 0) : new THREE.Vector3());
  const axisPt = (pt) => axisLocal(pt).applyAxisAngle(Y, pt.rot * Math.PI / 2).add(pt.pivot.position);
  const setAxisPt = (pt, P) => { pt.pivot.position.copy(P).sub(axisLocal(pt).applyAxisAngle(Y, pt.rot * Math.PI / 2)); };
  const setRot = (pt, r) => { const P = axisPt(pt); pt.rot = ((r % 4) + 4) % 4; pt.pivot.rotation.y = pt.rot * Math.PI / 2; setAxisPt(pt, P); };
  // zasięg wzdłuż osi (od punktu osi) w świecie: [s0, s1] po kierunku axisDir
  const span = (pt) => (pt.b.ext ? pt.b.ext : role(pt) === 'motor' ? [-0.3, pt.b.shaftEnd] : [-0.02, 0.02]);
  const motorEnd = (pt) => axisPt(pt).addScaledVector(axisDir(pt), pt.b.shaftEnd);
  const dist = (pt) => role(pt) === 'motor' || role(pt) === 'support';
  const name = (pt) => `${tr(pt.def.name)} #${pt.n}`;
  function rebuildBearing(pt, h) {
    h = Math.max(0.06, h); if (Math.abs(h - pt.params.h) < 1e-4) return true;
    const P = axisPt(pt); pt.pivot.remove(pt.b.group); pt.params.h = h; pt.b = pt.def.build(pt.params); pt.pivot.add(pt.b.group); pt.pivot.traverse((o) => { o.userData.wsPart = pt; });
    pt.pivot.position.set(P.x, TOP, P.z); return true;
  }
  // składowa sztywna: części osadzone na sobie (piasty, wały, łożyska) — przesuwane razem
  function component(pt) { const out = new Set([pt]), q = [pt]; while (q.length) { const a = q.pop(); for (const l of links) if (l.kind === 'mount' || l.kind === 'support') { const o = l.a === a ? l.b : l.b === a ? l.a : null; if (o && !out.has(o)) { out.add(o); q.push(o); } } } return [...out]; }
  function moveComp(pt, delta) {
    const comp = component(pt);
    if (comp.some((c) => role(c) === 'motor') && delta.lengthSq() > 1e-12) return T('Nie da się przesunąć silnika połączeniem — przesuń drugą część.', 'The motor cannot be moved by a connection — move the other part.');
    for (const c of comp) c.pivot.position.add(delta);
    // łożyska zostają na blacie: wysokość oprawy z osi wału
    for (const c of comp) if (role(c) === 'support') rebuildBearing(c, axisPt(c).y - TOP);
    // połączenia zębate, łańcuchowe i pasowe do części spoza składowej przestają pasować — usunięte
    const set = new Set(comp), broken = links.filter((l) => !['mount', 'support'].includes(l.kind) && set.has(l.a) !== set.has(l.b));
    broken.forEach(dropLink);
    return broken.length ? T(`Rozłączono ${broken.length} połączeń zębatych / łańcuchowych z innymi częściami.`, `Disconnected ${broken.length} gear / chain links to other parts.`) : '';
  }
  function dropLink(l) { const i = links.indexOf(l); if (i >= 0) links.splice(i, 1); if (l.visual) { group.remove(l.visual); l.visual = null; } dirty = true; }
  function remove(pt) { links.filter((l) => l.a === pt || l.b === pt).forEach(dropLink); group.remove(pt.pivot); parts.splice(parts.indexOf(pt), 1); if (sel === pt) sel = null; dirty = true; }

  /* ---------------- łączenie (część s dopasowana do t) ---------------- */
  const parallel = (a, b) => a.rot % 2 === b.rot % 2;
  const hubHalf = (pt) => { const [a, b] = span(pt); return Math.max(-a, b); };
  function link(s, t) {
    if (s === t) return T('Wybierz inną część.', 'Choose another part.');
    if (links.some((l) => (l.a === s && l.b === t) || (l.a === t && l.b === s))) return T('Te części są już połączone.', 'These parts are already connected.');
    const rs = role(s), rt = role(t), ds = s.def.type, dt = t.def.type;
    const align = (pt, ref) => { if (!parallel(pt, ref)) { if (component(pt).length > 1) return false; setRot(pt, ref.rot); } return true; };
    const onAxis = (ref, sAlong) => axisPt(ref).addScaledVector(axisDir(ref), sAlong);
    const along = (ref, P) => P.clone().sub(axisPt(ref)).dot(axisDir(ref));
    let kind = 'mount', note = '';
    if (rs === 'hub' && rt === 'shaft') {   // piasta na wale
      if (!align(s, t)) return T('Najpierw ustaw części równolegle (obróć).', 'Make the parts parallel first (rotate).');
      const h = hubHalf(s), x = Math.min(t.b.len - h, Math.max(h, along(t, axisPt(s))));
      note = moveComp(s, onAxis(t, x).sub(axisPt(s)));
    } else if (rs === 'shaft' && rt === 'hub') {   // wał przez piastę albo w wolną piastę sprzęgła
      if (!align(s, t)) return T('Najpierw ustaw części równolegle (obróć).', 'Make the parts parallel first (rotate).');
      if (t.b.coupling) {
        const used = links.find((l) => l.kind === 'mount' && (l.a === t || l.b === t)), other = used && (used.a === t ? used.b : used.a);
        const refP = other ? (role(other) === 'motor' ? axisPt(other) : axisPt(other).addScaledVector(axisDir(other), (other.b.len || 0) / 2)) : null;   // strona zajęta: korpus silnika albo środek drugiego wału
        const sideSign = refP ? -Math.sign(along(t, refP)) || 1 : 1;
        if (Math.sign(axisDir(s).dot(axisDir(t))) !== sideSign) { if (component(s).length > 1) return T('Obróć wał przed połączeniem.', 'Rotate the shaft before connecting.'); setRot(s, s.rot + 2); }
        note = moveComp(s, onAxis(t, sideSign * 0.004).sub(axisPt(s)));
      } else {
        const x0 = along(t, axisPt(s)), sgn = Math.sign(axisDir(s).dot(axisDir(t))) || 1, h = hubHalf(t);
        let a = x0; if (sgn * (0 - a) < h || sgn * (0 - a) > s.b.len - h) a = -sgn * s.b.len / 2;   // piasta poza wałem — środek wału na piaście
        note = moveComp(s, onAxis(t, a).sub(axisPt(s)));
      }
    } else if (rs === 'hub' && rt === 'motor') {   // sprzęgło albo koło na czopie silnika
      if (!align(s, t)) return T('Najpierw ustaw części równolegle (obróć).', 'Make the parts parallel first (rotate).');
      const x = s.b.coupling ? t.b.shaftEnd : t.b.shaftEnd - hubHalf(s);
      note = moveComp(s, onAxis(t, x).sub(axisPt(s)));
    } else if (rs === 'shaft' && rt === 'motor') return T('Wał łączy się z silnikiem przez sprzęgło: połącz sprzęgło z silnikiem, potem wał ze sprzęgłem.', 'A shaft joins the motor through a coupling: connect the coupling to the motor, then the shaft to the coupling.');
    else if (rs === 'support' && rt === 'shaft') {   // łożysko pod wałem
      if (!parallel(s, t)) setRot(s, t.rot);
      const h = axisPt(t).y - TOP; if (h < 0.06) return T('Wał leży za nisko na oprawę UCP (oś poniżej 60 mm).', 'The shaft is too low for a UCP block (axis below 60 mm).');
      const x = Math.min(t.b.len - 0.03, Math.max(0.03, along(t, axisPt(s)))), P = onAxis(t, x);
      rebuildBearing(s, h); setAxisPt(s, P); kind = 'support';
    } else if (rs === 'shaft' && rt === 'support') {
      if (!align(s, t)) return T('Najpierw ustaw części równolegle (obróć).', 'Make the parts parallel first (rotate).');
      const sgn = Math.sign(axisDir(s).dot(axisDir(t))) || 1; let a = along(t, axisPt(s)); if (sgn * (0 - a) < 0.03 || sgn * (0 - a) > s.b.len - 0.03) a = -sgn * s.b.len / 2;
      note = moveComp(s, onAxis(t, a).sub(axisPt(s))); kind = 'support';
    } else if (ds === 'gear' && dt === 'gear') {   // zazębienie
      if (Math.abs(s.b.m - t.b.m) > 1e-9) return T(`Różne moduły (${s.b.m * 1000} i ${t.b.m * 1000} mm) — koła nie zazębią się.`, `Different modules (${s.b.m * 1000} and ${t.b.m * 1000} mm) — the gears will not mesh.`);
      if (!align(s, t)) return T('Najpierw ustaw koła równolegle (obróć).', 'Make the gears parallel first (rotate).');
      const a = s.b.m * (s.b.z + t.b.z) / 2, Pt = axisPt(t), d = axisPt(s).sub(Pt); d.addScaledVector(axisDir(t), -d.dot(axisDir(t))); if (d.lengthSq() < 1e-8) d.set(0, 1, 0).cross(axisDir(t)); d.normalize();
      note = moveComp(s, Pt.clone().addScaledVector(d, a).sub(axisPt(s))); kind = 'mesh';
    } else if ((ds === 'sprocket' && dt === 'sprocket') || (ds === 'pulley' && dt === 'pulley')) {   // łańcuch / pas
      if (!align(s, t)) return T('Najpierw ustaw koła równolegle (obróć).', 'Make the wheels parallel first (rotate).');
      const Pt = axisPt(t), d = axisPt(s).sub(Pt); d.addScaledVector(axisDir(t), -d.dot(axisDir(t))); let L = d.length(); if (L < 1e-6) { d.set(0, 1, 0).cross(axisDir(t)); L = 0.3; } d.normalize();
      if (ds === 'sprocket') { const ch = MK.chainDistance(t.b.z, s.b.z, 0.0127, Math.max(L, (t.b.R + s.b.R) * 1.4)); L = ch.D; kind = 'chain'; }
      else { L = Math.max(L, (t.b.d + s.b.d) / 2 + 0.06); kind = 'belt'; }
      note = moveComp(s, Pt.clone().addScaledVector(d, L).sub(axisPt(s)));
    } else return T('Tych części nie da się tak połączyć.', 'These parts cannot be connected this way.');
    const l = { a: t, b: s, kind }; links.push(l); buildVisual(l); dirty = true;
    return note || T('Połączono.', 'Connected.');
  }
  // łańcuch i pas: obrys w płaszczyźnie prostopadłej do osi (układ lokalny części t — oś x)
  function buildVisual(l) {
    if (l.kind !== 'chain' && l.kind !== 'belt') return;
    if (l.visual) group.remove(l.visual);
    const t = l.a, s = l.b, w = new THREE.Group(); w.rotation.y = t.rot * Math.PI / 2; w.updateMatrixWorld(true);
    const inv = w.matrixWorld.clone().invert(), Pt = axisPt(t).applyMatrix4(inv), Ps = axisPt(s).applyMatrix4(inv);
    if (l.kind === 'chain') {
      const path = MK.loopPath({ y: Pt.y, z: Pt.z, r: t.b.R, k: t.b.z / TAU }, { y: Ps.y, z: Ps.z, r: s.b.R, k: s.b.z / TAU }, 0.0127), N = Math.round(path.L);
      w.add(MK.chainLoop(path, N, { x: Pt.x })); l.phaseK = t.b.z / TAU;
    } else {
      const path = MK.loopPath({ y: Pt.y, z: Pt.z, r: t.b.d / 2, k: t.b.d / 2 }, { y: Ps.y, z: Ps.z, r: s.b.d / 2, k: s.b.d / 2 }, 1);
      w.add(MK.beltLoop(path, { x: Pt.x, label: `SPA ${Math.round(path.L * 1000)} Lw` })); l.phaseK = t.b.d / 2;
    }
    l.visual = w; group.add(w);
  }

  /* ---------------- napęd z grafu połączeń ---------------- */
  function rebuildDrive() {
    dirty = false; drive = createDrive(); solved = null;
    const els = new Map();
    for (const pt of parts) if (role(pt) !== 'support') els.set(pt, drive.add({ id: pt.id, name: name(pt), type: pt.type, J: pt.b.J || 0, spin: pt.b.spin, group: pt.b.group, frame: { o: axisPt(pt), axis: axisDir(pt), ref: Y.clone() } }));
    const motor = parts.find((p) => role(p) === 'motor'), warn = [];
    if (!motor) { solved = { warn: [T('Wstaw silnik — od niego liczy się ruch.', 'Insert a motor — motion is computed from it.')] }; return; }
    const adj = new Map(); for (const pt of els.keys()) adj.set(pt, []);
    for (const l of links) if (l.kind !== 'support' && els.has(l.a) && els.has(l.b)) { adj.get(l.a).push([l.b, l]); adj.get(l.b).push([l.a, l]); }
    const seen = new Set([motor]), q = [motor];
    while (q.length) {
      const a = q.shift();
      for (const [b, l] of adj.get(a)) {
        if (seen.has(b)) { if (!l.done) { l.done = true; edge(a, b, l); } continue; }
        seen.add(b); q.push(b); l.done = true; edge(a, b, l);
      }
    }
    links.forEach((l) => { delete l.done; });
    function edge(a, b, l) {
      const type = l.kind === 'mesh' ? 'mesh' : l.kind === 'chain' ? 'chain' : l.kind === 'belt' ? 'belt' : a.b.coupling || b.b.coupling ? 'coupling' : 'shaft';
      const o = type === 'mesh' || type === 'chain' ? { za: a.b.z, zb: b.b.z } : type === 'belt' ? { za: a.b.d, zb: b.b.d } : {};
      drive.connect(a.id, 'a', b.id, 'b', type, o);
    }
    const brakeP = parts.find((p) => p.b.brake), r = drive.solve(motor.id, brakeP ? brakeP.id : undefined);
    for (const pt of els.keys()) if (!seen.has(pt)) warn.push(T(`${name(pt)} — niepołączone z silnikiem (stoi).`, `${name(pt)} — not connected to the motor (stands still).`));
    if (!r.ok) warn.push(T('Mechanizm zakleszczony: ta sama część napędzana dwiema drogami o różnych przełożeniach.', 'Mechanism jammed: the same part is driven by two paths with different ratios.'));
    for (const pt of parts) if (role(pt) === 'shaft') {
      const sup = links.filter((l) => (l.a === pt || l.b === pt) && (l.kind === 'support' || (l.kind === 'mount' && ((l.a === pt ? l.b : l.a).b.coupling)))).length;
      if (sup < 2) warn.push(T(`${name(pt)} ma ${sup} ${sup === 1 ? 'podporę' : 'podpór'} — potrzebne co najmniej 2 (łożyska albo sprzęgło przy silniku i łożysko).`, `${name(pt)} has ${sup} support${sup === 1 ? '' : 's'} — at least 2 needed (bearings, or a coupling at the motor plus a bearing).`));
    }
    for (const pt of parts) if (role(pt) === 'hub') { const r = pt.b.rp ? pt.b.rp + pt.b.m : pt.b.R ? pt.b.R + 0.006 : pt.b.d ? pt.b.d / 2 + 0.004 : 0.04; if (axisPt(pt).y - TOP < r + 0.002) warn.push(T(`${name(pt)} zahacza o blat (promień ${Math.round(r * 1000)} mm, oś ${Math.round((axisPt(pt).y - TOP) * 1000)} mm nad blatem) — użyj mniejszego koła albo wyżej osadzonego wału.`, `${name(pt)} hits the table top (radius ${Math.round(r * 1000)} mm, axis ${Math.round((axisPt(pt).y - TOP) * 1000)} mm above it) — use a smaller wheel or a higher shaft.`)); }
    for (const pt of parts) if (role(pt) === 'hub' && !pt.b.coupling && !links.some((l) => l.kind === 'mount' && (l.a === pt || l.b === pt))) warn.push(T(`${name(pt)} nie siedzi na wale — w prawdziwej maszynie by spadło.`, `${name(pt)} is not on a shaft — in a real machine it would fall off.`));
    if (!brakeP) warn.push(T('Bez hamulca maszyna kręci się bez obciążenia (tylko bezwładność i opory łożysk).', 'Without a brake the machine runs unloaded (only inertia and bearing friction).'));
    solved = { ...r, warn, motor, brakeP };
  }
  function step(dt) {
    if (!group.visible) return;
    if (dirty) rebuildDrive();
    if (drive && solved && solved.motor) {
      const m = solved.motor.b;
      if (running) drive.step(dt, { rpm, brake: solved.brakeP ? brake : 0, Tmax: 2.5 * m.Trated, rated: m.rated });
      else { drive.state.omega *= Math.max(0, 1 - dt * 3); theta += drive.state.omega * dt; drive.pose(drive.state.theta + drive.state.omega * dt); }
      for (const e of drive.els.values()) if (e.spin) e.spin.rotation.x = e.theta;
      for (const l of links) if (l.visual) { const e = drive.els.get(l.a.id); if (e) l.visual.children[0].userData.update(e.theta * l.phaseK); }
    }
    if (sel) { selBox.setFromObject(sel.pivot); selBox.visible = true; } else selBox.visible = false;
    if ((uiT += dt) > 0.25) { uiT = 0; renderStats(); }
  }
  let uiT = 0;

  /* ---------------- zapis ---------------- */
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ parts: parts.map((p) => ({ n: p.n, type: p.type, params: p.params, pos: p.pivot.position.toArray(), rot: p.rot })), links: links.map((l) => ({ a: l.a.n, b: l.b.n, kind: l.kind })), rpm, brake })); } catch (e) { /* bez zapisu */ } }
  function load(data) {
    clear(false);
    for (const q of data.parts || []) { const p = make(q.type, q.params, q.n); p.rot = q.rot || 0; p.pivot.rotation.y = p.rot * Math.PI / 2; p.pivot.position.fromArray(q.pos); parts.push(p); }
    for (const q of data.links || []) { const a = parts.find((p) => p.n === q.a), b = parts.find((p) => p.n === q.b); if (a && b) { const l = { a, b, kind: q.kind }; links.push(l); buildVisual(l); } }
    rpm = data.rpm ?? rpm; brake = data.brake ?? brake; dirty = true; buildUI();
  }
  function clear(doSave = true) { for (const l of [...links]) dropLink(l); for (const p of [...parts]) group.remove(p.pivot); parts.length = 0; sel = null; nextId = 1; running = false; dirty = true; if (doSave) { save(); buildUI(); } }
  // przykład: silnik → sprzęgło → wał na dwóch łożyskach → para kół 18 : 40 → wał → łańcuch 15 : 30 → wał z hamulcem
  function example() {
    clear(false);
    const add = (type, params, x, z, rot = 0) => { const p = make(type, params); setRot(p, rot); p.pivot.position.set(C0.x + x, TOP, C0.z + z); parts.push(p); return p; };
    const lift = (p, y) => { p.pivot.position.y = y; return p; };
    const m = add('motor', { kW: 0.75 }, -0.9, -0.2), ax = TOP + m.b.axisY;
    const c = lift(add('jaw', {}, -0.7, -0.2), ax); link(c, m);
    const s1 = lift(add('shaft', { len: 0.5 }, -0.6, -0.2), ax); link(s1, c);
    const b1 = add('bearing', {}, -0.55, -0.2); link(b1, s1); const b2 = add('bearing', {}, -0.25, -0.2); link(b2, s1);
    const g1 = lift(add('gear', { z: 18, m: 0.003 }, -0.18, -0.2), ax); link(g1, s1);
    const g2 = lift(add('gear', { z: 40, m: 0.003, mat: 'brass' }, -0.18, 0), ax); link(g2, g1);
    const s2 = lift(add('shaft', { len: 0.7 }, -0.3, 0.1), ax); link(s2, g2);
    const b3 = add('bearing', {}, -0.25, 0.1); link(b3, s2); const b4 = add('bearing', {}, 0.3, 0.1); link(b4, s2);
    const k1 = lift(add('sprocket', { z: 15 }, 0.35, 0.1), ax); link(k1, s2);
    const k2 = lift(add('sprocket', { z: 30 }, 0.35, 0.35), ax); link(k2, k1);
    const s3 = lift(add('shaft', { len: 0.6 }, 0.2, 0.4), ax); link(s3, k2);
    const b5 = add('bearing', {}, 0.25, 0.4); link(b5, s3); const b6 = add('bearing', {}, 0.65, 0.4); link(b6, s3);
    const br = lift(add('brake', { d: 0.2 }, 0.72, 0.4), ax); link(br, s3);
    msg = T('Przykład: silnik 0,75 kW → sprzęgło → koła 18 : 40 → łańcuch 15 : 30 → hamulec (przełożenie 1 : 4,44).', 'Example: 0.75 kW motor → coupling → gears 18 : 40 → chain 15 : 30 → brake (ratio 1 : 4.44).');
    dirty = true; save(); buildUI();
  }

  /* ---------------- wskazywanie i klawisze ---------------- */
  function pointerRay(e) { const r = dom.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  const pickPart = () => { const h = ray.intersectObjects(parts.map((p) => p.pivot), true)[0]; return h ? h.object.userData.wsPart : null; };
  function onPointer(kind, e) {
    pointerRay(e);
    if (place) {
      if (ray.ray.intersectPlane(plane, hit)) {
        const x = snap(hit.x), z = snap(hit.z), rad = place.b.rp || place.b.R || (place.b.d || 0) / 2 || 0.03;
        if (dist(place)) place.pivot.position.set(x, TOP, z); else setAxisPt(place, new THREE.Vector3(x, TOP + Math.max(0.09, rad + 0.02), z));   // silnik i łożysko na blacie, reszta na wysokości osi
      }
      if (kind === 'down' && e.button === 0) { parts.push(place); sel = place; place = null; msg = T('Wstawiono. Kliknij „Połącz z…”, potem drugą część.', 'Inserted. Click “Connect to…”, then another part.'); dirty = true; save(); buildUI(); }
      return true;
    }
    if (kind === 'down' && e.button === 0) {
      const pt = pickPart();
      if (linkFrom && pt) { msg = link(linkFrom, pt); sel = linkFrom; linkFrom = null; save(); buildUI(); return true; }
      if (pt) { sel = pt; buildUI(); if (!links.some((l) => l.a === pt || l.b === pt)) dragging = { pt, y: axisPt(pt).y }; return true; }   // niepołączoną część można przeciągać
      return false;
    }
    if (kind === 'move' && dragging) { if (ray.ray.intersectPlane(plane, hit)) { const P = axisPt(dragging.pt); setAxisPt(dragging.pt, new THREE.Vector3(snap(hit.x), dragging.y, snap(hit.z))); if (P.distanceTo(axisPt(dragging.pt)) > 0) dirty = true; } return true; }
    if (kind === 'up' && dragging) { dragging = null; save(); return true; }
    return false;
  }
  function onKey(e) {
    if (e.code === 'Escape') { if (place) { group.remove(place.pivot); place = null; } linkFrom = null; msg = ''; buildUI(); return true; }
    if (!sel) return false;
    if (e.code === 'KeyR') { rotateSel(); return true; }
    if (e.code === 'KeyL') { startLink(); return true; }
    if (e.code === 'Delete' || e.code === 'Backspace') { remove(sel); save(); buildUI(); return true; }
    return false;
  }
  function rotateSel() { if (!sel) return; if (links.some((l) => l.a === sel || l.b === sel)) { msg = T('Połączonej części nie da się obrócić — najpierw ją rozłącz.', 'A connected part cannot be rotated — disconnect it first.'); } else { setRot(sel, sel.rot + 1); dirty = true; save(); } buildUI(); }
  function startLink() { if (!sel) return; linkFrom = sel; msg = T(`Kliknij część, do której dopasować ${name(sel)}.`, `Click the part to fit ${name(sel)} to.`); buildUI(); }

  /* ---------------- okno ---------------- */
  const box = document.getElementById('wsPanel');
  let typeSel = WS_PARTS[0].type, newParams = {};
  function buildUI() {
    if (!box) return;
    const def = partDef(typeSel), kids = [];
    kids.push(el('h3', { textContent: 'Katalog' }));
    const ts = el('select', {}); ts.append(...WS_PARTS.map((d) => el('option', { value: d.type, textContent: d.name }))); ts.value = typeSel; ts.onchange = () => { typeSel = ts.value; newParams = {}; buildUI(); };
    kids.push(el('div', { className: 'row' }, el('span', { textContent: 'Część' }), ts));
    for (const q of def.params) {
      const v = newParams[q.key] ?? q.def;
      if (q.type === 'select') { const s = el('select', {}); s.append(...q.options.map(([k, t]) => el('option', { value: String(k), textContent: t }))); s.value = String(v); s.onchange = () => { newParams[q.key] = isNaN(+s.value) ? s.value : +s.value; }; kids.push(el('div', { className: 'row' }, el('span', { textContent: q.label }), s)); }
      else { const r = el('input', { type: 'range', min: q.min, max: q.max, step: q.step, value: v }), o = el('output', { textContent: q.unit === 'mm' ? `${Math.round(v * 1000)} mm` : String(v) }); r.oninput = () => { newParams[q.key] = +r.value; o.textContent = q.unit === 'mm' ? `${Math.round(+r.value * 1000)} mm` : r.value; }; kids.push(el('div', { className: 'row' }, el('span', { textContent: q.label }), r, o)); }
    }
    const ins = el('button', { type: 'button', textContent: 'Wstaw na stół' }); ins.onclick = () => { if (place) group.remove(place.pivot); place = make(typeSel, newParams); msg = T('Wskaż miejsce na stole i kliknij (Esc — anuluj).', 'Point to a place on the table and click (Esc — cancel).'); buildUI(); };
    kids.push(el('div', { className: 'btns' }, ins));
    kids.push(el('h3', { textContent: 'Napęd' }));
    const run = el('button', { type: 'button', textContent: running ? 'Zatrzymaj' : 'Uruchom', className: running ? 'on' : '' }); run.onclick = () => { running = !running; buildUI(); };
    const ex = el('button', { type: 'button', textContent: 'Przykład' }); ex.onclick = example;
    const cl = el('button', { type: 'button', textContent: 'Wyczyść stół' }); cl.onclick = () => clear(true);
    kids.push(el('div', { className: 'btns' }, run, ex, cl));
    const rr = el('input', { type: 'range', min: 0, max: 1500, step: 10, value: rpm }), ro = el('output', { textContent: `${rpm} ${T('obr/min', 'rpm')}` }); rr.oninput = () => { rpm = +rr.value; ro.textContent = `${rpm} ${T('obr/min', 'rpm')}`; save(); };
    const br = el('input', { type: 'range', min: 0, max: 100, step: 1, value: brake }), bo = el('output', { textContent: `${brake} N·m` }); br.oninput = () => { brake = +br.value; bo.textContent = `${brake} N·m`; save(); };
    kids.push(el('div', { className: 'row' }, el('span', { textContent: 'Falownik' }), rr, ro), el('div', { className: 'row' }, el('span', { textContent: 'Hamulec' }), br, bo));
    kids.push(el('h3', { textContent: sel ? name(sel) : 'Kliknij część na stole' }));
    if (sel) {
      kids.push(el('div', { className: 'stats' }, ...sel.b.props.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: String(b) })])));
      const lk = el('button', { type: 'button', textContent: linkFrom ? 'Wskaż drugą część…' : 'Połącz z… (L)', className: linkFrom ? 'on' : '' }); lk.onclick = startLink;
      const rt = el('button', { type: 'button', textContent: 'Obróć 90° (R)' }); rt.onclick = rotateSel;
      const rm = el('button', { type: 'button', textContent: 'Usuń (Del)' }); rm.onclick = () => { remove(sel); save(); buildUI(); };
      kids.push(el('div', { className: 'btns' }, lk, rt, rm));
      const my = links.filter((l) => l.a === sel || l.b === sel);
      if (my.length) kids.push(el('ul', { className: 'ports' }, ...my.map((l) => { const o = l.a === sel ? l.b : l.a, li = el('li', { textContent: `${KIND[l.kind] ? tr(KIND[l.kind]) : l.kind} — ${name(o)} ` }), x = el('button', { type: 'button', textContent: '✕', title: 'Rozłącz' }); x.onclick = () => { dropLink(l); save(); buildUI(); }; li.append(x); return li; })));
    }
    if (msg) kids.push(el('p', { className: 'note', textContent: msg }));
    kids.push(el('div', { className: 'stats', id: 'wsStats' }));
    kids.push(el('p', { className: 'note', textContent: 'Obsługa: wybierz część w katalogu → Wstaw → kliknij na stole. Kliknij część → „Połącz z…” → kliknij drugą: pierwsza dopasuje się do drugiej (piasta na wał, wał w sprzęgło, łożysko pod wał, koło do koła, łańcuch, pas). Niepołączoną część można przeciągać. R — obrót, Del — usunięcie, Esc — anulowanie.' }));
    box.replaceChildren(...kids);
    renderStats();
  }
  const KIND = { mount: 'osadzenie', support: 'podpora (łożysko)', mesh: 'zazębienie', chain: 'łańcuch', belt: 'pas' };
  function renderStats() {
    const s = document.getElementById('wsStats'); if (!s) return;
    const rows = [];
    if (solved && solved.motor && drive) {
      const st = drive.state, mo = drive.els.get(solved.motor.id);
      rows.push(['Silnik', `${fmt(st.omega * 60 / TAU, 0)} ${T('obr/min', 'rpm')} · ${fmt(st.Tm, 2)} N·m · ${fmt(st.P, 0)} W`]);
      if (solved.brakeP) { const e = drive.els.get(solved.brakeP.id); rows.push(['Wyjście (hamulec)', `${fmt(e.omega * 60 / TAU, 1)} ${T('obr/min', 'rpm')} · ${T('przełożenie', 'ratio')} 1 : ${fmt(Math.abs(1 / (e.r || 1e-9)), 2)} · ${fmt(st.Pout || 0, 0)} W`]); }
      rows.push(['Bezwładność zredukowana', `${fmt(st.Jeff * 1e4, 2)} kg·cm²`]);
      void mo;
    }
    const w = solved ? solved.warn || [] : [];
    s.replaceChildren(...rows.flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: b })]), ...w.map((x) => el('p', { className: 'warn', textContent: '⚠ ' + x })));
  }
  function setActive(on) {
    const was = group.visible; group.visible = on; document.body.classList.toggle('ws', on);
    if (on !== was && window.LabWindows) window.LabWindows.show('workshop', on);   // okno warsztatu tylko w tym trybie
    if (on) { if (!parts.length) { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.parts && d.parts.length) load(d); } catch (e) { /* pusty stół */ } } buildUI(); view([C0.x, TOP + 0.1, C0.z], 2.6, 0.0, 0.55); }
  }
  return { group, setActive, step, onPointer, onKey,
    api: { example, clear: () => clear(true), add: (type, params, x = 0, z = 0) => { const p = make(type, params); p.pivot.position.set(C0.x + x, TOP, C0.z + z); if (!dist(p)) p.pivot.position.y = TOP + 0.09; parts.push(p); dirty = true; return p.id; }, link: (a, b) => { const A = parts.find((p) => p.id === a), B = parts.find((p) => p.id === b); return A && B ? link(A, B) : 'brak'; }, run: (on = true) => { running = on; buildUI(); },
      state: () => { if (dirty) rebuildDrive(); return { parts: parts.map((p) => p.id + ':' + p.type), links: links.map((l) => `${l.b.id}→${l.a.id}:${l.kind}`), warn: solved ? solved.warn : [], motorRpm: drive ? drive.state.omega * 60 / TAU : 0, out: solved && solved.brakeP && drive ? drive.els.get(solved.brakeP.id).omega * 60 / TAU : null }; } } };
}
