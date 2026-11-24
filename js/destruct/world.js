// DestructKit — świat zniszczeń: budynki z części (HouseKit), które pękają tak, jak są zbudowane (wzór z materiału
// części, js/destruct/patterns.js), statyka (część stoi, dopóki stoi to, na czym się opiera; kawałki pękniętej ściany
// trzymają się, dopóki łączą się z podporą), odłamki jako bryły sztywne (js/destruct/physics.js), zderzenia
// rzuconych przedmiotów z częściami, niszczenie wiatrem. Rysowanie: BatchedMesh na materiał (js/destruct/batches.js).
//
// createWorld(scene, { ground(x, z), wind?(x, y, z, out), maxFragments }) → world:
//   addHouse(house, { x, z, rot }) → building           house z buildHouse (js/models/houses/housekit.js)
//   addObject(obj3d, { m, pts, r, A, size, kind, sleep }) → body   przedmiot z własną siatką (beczka, opona…)
//   hit(point, J, { radius })                           uderzenie: punkt [Vector3], impuls [Vector3, N·s]
//   windDamage(x, z, R, speedAt(x, y, z), dt)           wiatr niszczy części w promieniu R (szyby pierwsze)
//   update(dt)                                          fizyka, zderzenia, statyka, rysowanie
//   bodies (Set), buildings, removeBody(b), stats(), clear(), onBreak(fn), onFragment(fn)
// Body: { p, q, v, w, m, r, A, size, state 'active' | 'sleep' | 'held', kind 'frag' | 'part' | 'item', mat }
import * as THREE from '../../vendor/three/three.module.js';
import { fracture } from './patterns.js';
import { extrude } from './extrude.js';
import { MATS, tileOf } from './materials.js';
import { createBatches } from './batches.js';
import { makeBody, stepBody, wake } from './physics.js';
import { inside, distTo, bounds, touching, area } from './geom2d.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Color();
const CELL = 4;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function createWorld(scene, opts = {}) {
  const ground = opts.ground || (() => 0);
  const batches = createBatches(scene);
  const bodies = new Set(), buildings = [], grid = new Map(), queue = new Set();
  const listeners = { break: [], frag: [], reveal: [] };
  let maxFrag = opts.maxFragments || 2500, fragCount = 0, simT = 0;
  const env = { ground, wind: opts.wind || null, windGain: 1 };

  /* ---------------- siatka przestrzenna części ---------------- */
  function gridAdd(part) {
    const [x0, , z0, x1, , z1] = part.aabb;
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
      const k = i * 73856093 ^ j * 19349663; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(part);
    }
  }
  function query(x, z, r, out = new Set()) {
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
      const a = grid.get(i * 73856093 ^ j * 19349663); if (!a) continue;
      for (const p of a) if (p.state === 'intact' || p.state === 'broken') {
        const b = p.aabb; if (x + r >= b[0] && x - r <= b[3] && z + r >= b[2] && z - r <= b[5]) out.add(p);
      }
    }
    return out;
  }

  /* ---------------- budynki ---------------- */
  // hidden: części niewidoczne, dopóki budynek nie dostanie pierwszego uszkodzenia (gra pokazuje do tego czasu model
  // z laboratorium miasta; onReveal mówi, kiedy go schować)
  function addHouse(house, { x = 0, z = 0, rot = 0, hidden = false } = {}) {
    const bM = new THREE.Matrix4().compose(new THREE.Vector3(x, ground(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), _s);
    const bld = { house, x, z, rot, M: bM, parts: [], tint: house.tint ? new THREE.Color(house.tint) : null, vol0: 0, volGone: 0, hidden };
    for (const sp of house.parts) {
      const M = new THREE.Matrix4().compose(new THREE.Vector3(...sp.pos), new THREE.Quaternion(...sp.quat), _s).premultiply(bM);
      const a = Math.abs(area(sp.poly)), D = MATS[sp.mat];
      const part = { spec: sp, bld, id: sp.id, mat: sp.mat, poly: sp.poly, t: sp.t, M, Minv: M.clone().invert(), a, vol: a * sp.t,
        hpMax: D.hp * Math.sqrt(Math.max(0.15, a)) * 0.75 * clamp(sp.t / 0.25, 0.35, 1.6), state: 'intact', cells: null, handle: null,
        need: sp.need, anchor: sp.anchor, fixed: !!sp.fixed, supports: [], dependents: [], ground: sp.supports.includes(-1) };
      part.hp = part.hpMax;
      part.aabb = aabbOf(part);
      part.handle = addPartMesh(part, part.poly, tintOf(part)).h;
      if (hidden) batches.visible(part.handle, false);
      if (!part.fixed) bld.vol0 += part.vol;
      bld.parts.push(part);
      gridAdd(part);
    }
    for (const part of bld.parts) for (const s of part.spec.supports) if (s >= 0) { part.supports.push(bld.parts[s]); bld.parts[s].dependents.push(part); }
    buildings.push(bld);
    return bld;
  }
  function reveal(bld) {
    if (!bld.hidden) return;
    bld.hidden = false;
    for (const p of bld.parts) if (p.handle) batches.visible(p.handle, true);
    for (const f of listeners.reveal) f(bld);
  }
  // barwa części: odcień budynku (tynk, płyta) i zwęglenie od ognia (char 0…1 — ciemnieje)
  function tintOf(part) {
    const base = part.bld.tint && (part.mat === 'plaster' || part.mat === 'panel') ? part.bld.tint : null;
    if (!part.char) return base;
    return (base ? base.clone() : new THREE.Color(1, 1, 1)).multiplyScalar(1 - 0.88 * part.char);
  }
  function setChar(part, k) {
    part.char = Math.max(part.char || 0, Math.min(1, k));
    const c = tintOf(part);
    if (part.handle) batches.color(part.handle, c);
    if (part.cells) for (const cl of part.cells) if (cl.on) batches.color(cl.h, c);
  }
  function sizeOf(poly, t) { const g = bounds(poly); return Math.max(g[2] - g[0], g[3] - g[1], t); }
  function geoOf(part, poly) { return extrude(poly, { t: part.t, orig: part.poly, tile: tileOf(part.mat), frac: MATS[part.mat].frac }); }
  // macierz kawałka: układ części przesunięty do środka wielokąta (extrude centruje siatkę na środku ciężkości)
  function cellMatrix(part, c, geo) {
    const cc = geo ? geo.userData.c : null;
    return new THREE.Matrix4().makeTranslation(cc ? cc[0] : c[0], cc ? cc[1] : c[1], 0).premultiply(part.M);
  }
  function aabbOf(part) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const q of part.poly) for (const z of [-part.t / 2, part.t / 2]) {
      _p.set(q[0], q[1], z).applyMatrix4(part.M);
      b[0] = Math.min(b[0], _p.x); b[1] = Math.min(b[1], _p.y); b[2] = Math.min(b[2], _p.z); b[3] = Math.max(b[3], _p.x); b[4] = Math.max(b[4], _p.y); b[5] = Math.max(b[5], _p.z);
    }
    return b;
  }
  // geometria w addHouse liczona przez extrude ma środek ciężkości; macierz musi go użyć — poprawka po dodaniu
  function addPartMesh(part, poly, color) { const g = geoOf(part, poly); return { g, h: batches.add(g, part.mat, cellMatrix(part, null, g), color) }; }

  /* ---------------- odłamki ---------------- */
  function spawnFragment(part, poly, vel, opts2 = {}) {
    const g = geoOf(part, poly), D = MATS[part.mat];
    const M = cellMatrix(part, null, g); M.decompose(_p, _q, _v);
    const a = g.userData.a, m = Math.max(0.05, a * part.t * D.density * (D.solidFactor || 1));
    const [x0, y0, x1, y1] = bounds(poly), size = Math.max(x1 - x0, y1 - y0, part.t);
    const b = makeBody({ p: _p, q: _q, v: vel, m, pts: g.userData.pts, r: g.userData.r, A: Math.max(a * 0.6, part.t * size) });
    b.w.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4).multiplyScalar(opts2.spin ?? 1);
    Object.assign(b, { kind: 'frag', mat: part.mat, size, vol: a * part.t, handle: batches.add(g, part.mat, M, tintOf(part)), from: part, born: simT, char: part.char || 0 });
    bodies.add(b); fragCount++;
    part.bld.volGone += a * part.t;
    for (const f of listeners.frag) f(b);
    return b;
  }
  function removeBody(b) {
    if (!bodies.has(b)) return;
    bodies.delete(b);
    if (b.handle) batches.remove(b.handle);
    if (b.obj && b.obj.parent) b.obj.parent.remove(b.obj);
    if (b.onRemove) b.onRemove(b);
    if (b.kind === 'frag') fragCount--;
  }
  // obj: Object3D (rysowany sam) albo { position, quaternion } z onSync(b) — np. instancja w InstancedMesh
  function addObject(obj, { m, pts, r, A, size, vol, kind = 'item', sleep = true, name = '', onSync = null }) {
    const b = makeBody({ p: obj.position, q: obj.quaternion, m, pts, r, A });
    Object.assign(b, { kind, obj: obj.isObject3D ? obj : null, onSync, size: size || r * 2, name, state: sleep ? 'sleep' : 'active', vol: vol ?? (size || r) ** 3 * 0.3, born: simT, moved: true });
    bodies.add(b);
    return b;
  }

  /* ---------------- pękanie ---------------- */
  // hitL: punkt uderzenia w układzie części [x, y]; power 0…1; J: impuls [Vector3] (kierunek wyrzutu); all: wszystko odpada
  function breakPart(part, hitL, power, J, all = false) {
    if (part.fixed || part.state !== 'intact') return;
    reveal(part.bld);
    const D = MATS[part.mat], cells = fracture({ poly: part.poly, pattern: D.pattern, pat: { ...(D.pat || {}), ...(part.spec.pat || {}) }, seed: part.spec.seed }, hitL, power, Math.floor(simT * 1000));
    batches.remove(part.handle); part.handle = null;
    part.state = 'broken'; part.cells = [];
    const Rb = all ? 1e9 : (D.glass ? 1e9 : 0.35 + 1.8 * power);
    const Jl = J ? J.length() : 0, dir = Jl > 1e-6 ? J.clone().divideScalar(Jl) : new THREE.Vector3(0, 0, 0);
    let dynMass = 0; for (const c of cells) if (c.d <= Rb) dynMass += c.a * part.t * D.density;
    const vmag = Math.min(11, Jl / Math.max(40, dynMass) * 0.9 + 1);   // pęd dzielony na wszystkie wyrzucone kawałki
    for (const c of cells) {
      if (c.d <= Rb) {
        const k = 1 - 0.5 * clamp(c.d / Rb, 0, 1);
        const v = dir.clone().multiplyScalar(vmag * k).add(_n.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(2 + 2 * power));
        spawnFragment(part, c.poly, v);
      } else {
        const { h } = addPartMesh(part, c.poly, tintOf(part));
        part.cells.push({ poly: c.poly, c: c.c, a: c.a, h, hp: D.hp * Math.sqrt(Math.max(0.05, c.a)) * 0.35, on: true });
      }
    }
    settle(part);
    for (const f of listeners.break) f(part);
  }
  // kawałki pękniętej części, które nie łączą się z podporą, odpadają; część bez kawałków znika
  function settle(part) {
    const cells = part.cells.filter((c) => c.on);
    if (!cells.length) { gone(part); return; }
    const ok = supported(part);
    const [x0, y0, x1, y1] = bounds(part.poly), e = 0.03;
    const base = (c) => {
      if (!ok) return false;
      const [a0, b0, a1, b1] = bounds(c.poly);
      if (part.anchor === 'bottom') return b0 < y0 + e;
      if (part.anchor === 'sides') return a0 < x0 + e || a1 > x1 - e;
      return a0 < x0 + e || a1 > x1 - e || b0 < y0 + e || b1 > y1 - e;
    };
    const held = new Set(), stack = cells.filter(base);
    stack.forEach((c) => held.add(c));
    while (stack.length) {
      const c = stack.pop();
      for (const o of cells) if (!held.has(o) && touching(c.poly, o.poly, 0.02)) { held.add(o); stack.push(o); }
    }
    for (const c of cells) if (!held.has(c)) detachCell(part, c, null);
    if (!part.cells.some((c) => c.on)) gone(part);
    else for (const d of part.dependents) queue.add(d);
  }
  function detachCell(part, c, vel) {
    if (!c.on) return;
    c.on = false; batches.remove(c.h);
    spawnFragment(part, c.poly, vel || new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6), { spin: 0.3 });
  }
  function gone(part) {
    if (part.state === 'gone') return;
    if (part.handle) { batches.remove(part.handle); part.handle = null; }
    part.state = 'gone';
    for (const d of part.dependents) queue.add(d);
  }
  function integrity(p) {
    if (p.state === 'intact') return 1;
    if (p.state === 'broken') { let s = 0; for (const c of p.cells) if (c.on) s += c.a; return s / p.a; }
    return 0;
  }
  function supported(p) {
    if (p.ground) return true;
    let s = 0, w = 0;
    for (const q of p.supports) { w += q.a; s += q.a * integrity(q); }
    return w > 0 && s / w >= p.need;
  }
  // cała część traci podparcie: spada w całości i pęka przy uderzeniu o ziemię
  function drop(part) {
    if (part.state === 'intact') {
      const g = geoOf(part, part.poly), M = cellMatrix(part, null, g); M.decompose(_p, _q, _v);
      batches.remove(part.handle);
      const D = MATS[part.mat], m = Math.max(0.1, part.vol * D.density * (D.solidFactor || 1));
      const b = makeBody({ p: _p, q: _q, m, pts: g.userData.pts, r: g.userData.r, A: part.a * 0.5, restitution: 0.1 });
      part.handle = null; part.state = 'falling';
      Object.assign(b, { kind: 'part', mat: part.mat, part, size: sizeOf(part.poly, part.t), vol: part.vol, handle: batches.add(g, part.mat, M, tintOf(part)), geo: g, born: simT });
      b.onLand = (bb, speed) => { if (speed > 2.2 || bb.age > 6) shatterBody(bb, speed); };
      bodies.add(b);
      for (const d of part.dependents) queue.add(d);
    } else if (part.state === 'broken') {
      for (const c of part.cells) if (c.on) detachCell(part, c, null);
      gone(part);
    }
  }
  // spadająca część rozbija się o ziemię: kawałki z prędkością bryły
  function shatterBody(b, speed) {
    const part = b.part; if (!part || b.dead) return;
    b.dead = true; removeBody(b);
    // układ części po upadku: macierz bryły minus przesunięcie do środka ciężkości
    const c = b.geo.userData.c;
    part.M.compose(b.p, b.q, _s).multiply(_m.makeTranslation(-c[0], -c[1], 0)); part.Minv.copy(part.M).invert();
    // punkt uderzenia: najniższy narożnik
    let low = null, ly = Infinity;
    for (const q of part.poly) { _p.set(q[0], q[1], 0).applyMatrix4(part.M); if (_p.y < ly) { ly = _p.y; low = q; } }
    const D = MATS[part.mat], power = clamp(speed / 9, 0.3, 1);
    const cells = fracture({ poly: part.poly, pattern: D.pattern, pat: D.pat || {}, seed: part.spec.seed + 7 }, low, power, 3);
    part.state = 'gone';
    for (const cl of cells) spawnFragment(part, cl.poly, b.v.clone().multiplyScalar(0.25).add(_n.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(1.5 * power)), { spin: 0.8 });
  }
  function processQueue() {
    let guard = 0;
    while (queue.size && guard++ < 400) {
      const p = queue.values().next().value; queue.delete(p);
      if ((p.state === 'intact' || p.state === 'broken') && !p.fixed && !supported(p)) drop(p);
      else if (p.state === 'broken') settle(p);
    }
  }

  /* ---------------- uderzenia ---------------- */
  const hitSet = new Set();
  function hit(point, J, { radius = 0.6 } = {}) {
    const Jl = J.length(); if (Jl < 1e-3) return 0;
    hitSet.clear(); query(point.x, point.z, radius + 0.5, hitSet);
    let broke = 0;
    for (const part of hitSet) {
      if (part.fixed) continue;
      _p.copy(point).applyMatrix4(part.Minv);
      const dz = Math.max(0, Math.abs(_p.z) - part.t / 2), dp = distTo(part.poly, _p.x, _p.y), d = Math.hypot(dz, dp);
      if (d > radius) continue;
      const fall = 1 - 0.7 * (d / radius), dmg = Jl * fall;
      reveal(part.bld);
      const hl = [clamp(_p.x, ...xr(part)), clamp(_p.y, ...yr(part))];
      if (part.state === 'intact') {
        part.hp -= dmg;
        if (part.hp <= 0) { breakPart(part, hl, clamp(-part.hp / part.hpMax + 0.35, 0.25, 1), J); broke++; }
        else tintDamage(part);
      } else {
        // pęknięta część: kawałki w zasięgu tracą wytrzymałość i odpadają
        let any = false;
        for (const c of part.cells) {
          if (!c.on) continue;
          const dc = Math.hypot(c.c[0] - hl[0], c.c[1] - hl[1]) - Math.sqrt(c.a) * 0.5;
          if (dc > radius + 0.3) continue;
          c.hp -= dmg * (1 - 0.6 * clamp(dc / (radius + 0.3), 0, 1));
          if (c.hp <= 0) { detachCell(part, c, J.clone().multiplyScalar(clamp(1 / (c.a * part.t * MATS[part.mat].density), 0, 3) * 2)); any = true; broke++; }
        }
        if (any) settle(part);
      }
    }
    return broke;
  }
  const xr = (p) => { const b = bounds(p.poly); return [b[0], b[2]]; };
  const yr = (p) => { const b = bounds(p.poly); return [b[1], b[3]]; };
  // uszkodzona, jeszcze cała część ciemnieje (rysy) — lekka podpowiedź, że zaraz pęknie
  function tintDamage(part) {
    if (!part.handle) return;
    const k = clamp(part.hp / part.hpMax, 0, 1), base = tintOf(part);
    _c.setRGB(1, 1, 1); if (base) _c.copy(base);
    _c.multiplyScalar(0.72 + 0.28 * k);
    batches.color(part.handle, _c);
  }

  /* ---------------- wiatr ---------------- */
  const windSet = new Set();
  function windDamage(x, z, R, speedAt, dt) {
    windSet.clear(); query(x, z, R, windSet);
    for (const part of windSet) {
      if (part.fixed) continue;
      const b = part.aabb, cx = (b[0] + b[3]) / 2, cy = (b[1] + b[4]) / 2, cz = (b[2] + b[5]) / 2;
      const s = speedAt(cx, cy, cz), D = MATS[part.mat];
      if (s <= D.wind) continue;
      reveal(part.bld);
      const over = s - D.wind, dmg = over * over * (0.6 + part.a * 0.15) * dt * 4;
      const dir = _v.set(cx - x, 0, cz - z); const L = dir.length() || 1;
      const J = new THREE.Vector3(-dir.z / L, 0.6, dir.x / L).multiplyScalar(over * 3);
      if (part.state === 'intact') {
        part.hp -= dmg;
        if (part.hp <= 0) {
          _p.set(cx, cy, cz).applyMatrix4(part.Minv);
          breakPart(part, [_p.x, _p.y], clamp(over / 30, 0.3, 1), J, D.pattern === 'tiles' || D.pattern === 'sheet' || D.glass);
        } else tintDamage(part);
      } else if (part.state === 'broken') {
        // wiatr odrywa kawałki po kolei
        let any = false;
        for (const c of part.cells) if (c.on && Math.random() < dt * over * 0.05) { c.hp -= dmg * 3; if (c.hp <= 0) { detachCell(part, c, J); any = true; } }
        if (any) settle(part);
      }
    }
  }

  /* ---------------- zderzenia brył z częściami ---------------- */
  const colSet = new Set();
  function collide(b) {
    const sp = b.v.length();
    if (sp < 7 || b.m < 0.3 || (b.cool || 0) > simT) return;
    colSet.clear(); query(b.p.x, b.p.z, b.r, colSet);
    for (const part of colSet) {
      if (b.kind !== 'item' && simT - b.born < 0.35) return;   // świeży kawałek leży jeszcze na murze, z którego wypadł
      if (b.p.y < part.aabb[1] - b.r || b.p.y > part.aabb[4] + b.r) continue;
      _p.copy(b.p).applyMatrix4(part.Minv);
      if (Math.abs(_p.z) > part.t / 2 + b.r * 0.55) continue;
      if (!inside(part.poly, _p.x, _p.y, b.r * 0.35)) continue;
      if (part.state === 'broken' && !part.cells.some((c) => c.on && inside(c.poly, _p.x, _p.y, b.r * 0.35))) continue;
      // gruz to luźne kawałki (kruszy się przy uderzeniu) — uderza słabiej niż lity przedmiot
      const J = b.v.clone().multiplyScalar(b.m * (b.thrown ? 0.9 : b.kind === 'frag' ? 0.2 : b.kind === 'part' ? 0.5 : 0.9));
      const before = part.state;
      hit(b.p, J, { radius: clamp(b.r * 1.3, 0.45, 1.6) });
      b.cool = simT + 0.12;
      if (part.state !== before || part.state === 'gone') b.v.multiplyScalar(0.65);
      else {
        _n.set(0, 0, 1).transformDirection(part.M); if (_n.dot(b.v) > 0) _n.negate();
        const vn = b.v.dot(_n); b.v.addScaledVector(_n, -1.35 * vn).multiplyScalar(0.55);
        b.p.addScaledVector(_n, 0.05);
      }
      wake(b);
      return;
    }
  }

  /* ---------------- krok ---------------- */
  const sub = 2;
  function update(dt) {
    dt = Math.min(dt, 1 / 20); simT += dt;
    const h = dt / sub;
    for (const b of bodies) {
      if (b.state !== 'active') continue;
      for (let i = 0; i < sub && b.state === 'active'; i++) stepBody(b, h, env);
      if (bodies.has(b)) collide(b);
      if (b.p.y < ground(b.p.x, b.p.z) - 30) removeBody(b);
    }
    processQueue();
    // za dużo odłamków: najstarsze leżące najmniejsze znikają (pył)
    if (fragCount > maxFrag) {
      const sleeping = [...bodies].filter((b) => b.kind === 'frag' && b.state === 'sleep').sort((a, c) => a.vol - c.vol || a.born - c.born);
      for (let i = 0; i < sleeping.length && fragCount > maxFrag * 0.9; i++) removeBody(sleeping[i]);
    }
    sync();
  }
  function sync() {
    for (const b of bodies) {
      if (b.state === 'sleep' && !b.moved) continue;
      b.moved = false;
      if (b.handle) { _m.compose(b.p, b.q, b.scale ? _v.setScalar(b.scale) : _s); batches.set(b.handle, _m); }
      else if (b.onSync) b.onSync(b);
      else if (b.obj) { b.obj.position.copy(b.p); b.obj.quaternion.copy(b.q); if (b.scale) b.obj.scale.setScalar(b.scale * (b.baseScale || 1)); }
    }
  }

  function stats() {
    let parts = 0, intact = 0, active = 0, sleep = 0, held = 0, vol0 = 0, volGone = 0;
    for (const bl of buildings) { vol0 += bl.vol0; volGone += Math.min(bl.vol0, bl.volGone); for (const p of bl.parts) { parts++; if (p.state === 'intact') intact++; } }
    for (const b of bodies) { if (b.state === 'active') active++; else if (b.state === 'sleep') sleep++; else if (b.state === 'held') held++; }
    return { parts, intact, fragments: fragCount, active, sleep, held, destroyed: vol0 ? volGone / vol0 : 0, ...batches.stats() };
  }
  function clear() {
    for (const b of [...bodies]) removeBody(b);
    batches.clear(); buildings.length = 0; grid.clear(); queue.clear(); fragCount = 0;
  }

  return {
    addHouse, addObject, hit, windDamage, update, removeBody, stats, clear, query, breakPart, drop, sync,
    bodies, buildings, env, batches, wake,
    set maxFragments(n) { maxFrag = n; },
    onBreak(f) { listeners.break.push(f); }, onReveal(f) { listeners.reveal.push(f); }, reveal, setChar, onFragment(f) { listeners.frag.push(f); },
    get time() { return simT; },
  };
}
