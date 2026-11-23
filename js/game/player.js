// Trąba gracza. Rośnie z tego, co zje: promień rdzenia R = 1,2 m + 1,6 · ∛(zjedzona objętość w m³).
//   zjada     małe i średnie lekkie rzeczy: rozmiar < 0,6 R i masa < 30 R³ kg — spirala w górę, znikają, R rośnie
//   nosi      średnie ciężkie: rozmiar < 1,8 R i masa < 150 R³ kg — krążą w wirze (najwyżej 3 + 1,5 R naraz)
//   rzuca     najcięższą niesioną rzecz w cel (prędkość 20 + 2 R m/s) — uderzenie liczy świat zniszczeń
//   wiatr     wir Rankine'a (js/envs/sky/tornado.js) o prędkości 22 + 4,5 R m/s niszczy części budynków
//             (szyby od ~28 m/s, dachówki ~48, deski ~55, mur ~85) i miota luźnymi odłamkami
//   drzewa    wyrywa, gdy R ≥ 0,22 wysokości drzewa; zjada, gdy R ≥ 0,58 wysokości
// createPlayer(scene, world, { heightAt, forest, x, z }) → { update(dt, move [x, z], camera), throwAt(point) → body | null,
//   x, z, R, V, held, eaten, eatenMass, cap, tornado, onEat(fn), onGrow(fn) }
import * as THREE from '../../vendor/three/three.module.js';
import { createTornado, tornadoWind } from '../envs/sky/tornado.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const radiusOf = (V) => 1.2 + 1.6 * Math.cbrt(Math.max(0, V));

export function createPlayer(scene, world, { heightAt, forest, x = 0, z = 0, bound = 300 }) {
  const tornado = createTornado(scene);
  const P = { x, z, vx: 0, vz: 0, V: 0, R: radiusOf(0), held: [], eating: [], eaten: 0, eatenMass: 0, time: 0, tornado, thrown: 0 };
  const listeners = { eat: [], grow: [] };
  const W3 = [0, 0, 0], _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const cap = () => 3 + Math.floor(P.R * 1.5);
  const canEat = (b) => (b.eatSize ?? b.size) < 0.6 * P.R && b.m < 30 * P.R ** 3;
  const canLift = (b) => (b.eatSize ?? b.size) < 1.8 * P.R && b.m < 150 * P.R ** 3;
  world.env.wind = (x, y, z, out) => (tornado.state ? tornadoWind(tornado.state, x, y, z, out) : (out[0] = out[1] = out[2] = 0, out));
  world.env.windGain = 0.6;

  function startEat(b) {
    b.state = 'held'; b.v.set(0, 0, 0); b.w.set(0, 0, 0);
    const dx = b.p.x - P.x, dz = b.p.z - P.z;
    b.eat = { t: 0, dur: 0.6 + Math.min(0.8, b.size * 0.25), a: Math.atan2(dz, dx), r: Math.max(0.3, Math.hypot(dx, dz)), y0: b.p.y - heightAt(P.x, P.z), s0: b.scale || 1 };
    P.eating.push(b);
  }
  function startLift(b) {
    b.state = 'held'; b.thrown = false;
    const dx = b.p.x - P.x, dz = b.p.z - P.z;
    // ciężkie krążą niżej i wolniej, lekkie wyżej i szybciej
    const heavy = clamp(b.m / (150 * P.R ** 3), 0, 1);
    b.orbit = { a: Math.atan2(dz, dx), r: P.R * (1.0 + 0.6 * Math.random()), h: 0.8 + (1 - heavy) * P.R * 1.6 * Math.random() + b.size * 0.4, spd: (7 + P.R * 1.5) * (1 - 0.5 * heavy), wob: Math.random() * 6.28 };
    P.held.push(b);
  }
  function grow(vol, b) {
    const before = P.R;
    P.V += vol; P.R = radiusOf(P.V); P.eaten++; P.eatenMass += b.m;
    for (const f of listeners.eat) f(b);
    if (Math.floor(P.R) > Math.floor(before)) for (const f of listeners.grow) f(P.R);
  }

  function update(dt, move, camera, light = 1) {
    P.time += dt;
    // ruch: kierunek z klawiszy (świat), prędkość rośnie z rozmiarem
    const sp = 7 + P.R * 0.8, k = 1 - Math.exp(-4 * dt);
    P.vx += (move[0] * sp - P.vx) * k; P.vz += (move[1] * sp - P.vz) * k;
    P.x = clamp(P.x + P.vx * dt, -bound, bound); P.z = clamp(P.z + P.vz * dt, -bound, bound);
    // wygląd i wiatr wiru na miarę
    tornado.set({ strength: clamp(P.R / 12, 0.15, 1), rc: P.R, top: 30 + P.R * 11, vmax: 22 + P.R * 4.5, kind: 'land' });
    tornado.update(dt, camera, { at: [P.x, P.z], groundAt: heightAt, isWater: () => false, light });
    const T = tornado.state;
    if (!T) return;
    const gy = heightAt(P.x, P.z);

    // co jest w zasięgu: zjeść, podnieść albo tylko obudzić (wiatr nim rzuca)
    const pull = P.R * 3 + 3, c = cap();
    for (const b of world.bodies) {
      if (b.state === 'held') continue;
      const dx = b.p.x - P.x, dz = b.p.z - P.z;
      if (Math.abs(dx) > pull + b.r || Math.abs(dz) > pull + b.r) continue;
      const d = Math.hypot(dx, dz) - b.r * 0.3;
      if (d > pull || b.p.y - gy > T.top * 0.5) continue;
      if ((b.noPick || 0) > P.time) continue;
      if (canEat(b)) { if (d < pull) startEat(b); }
      else if (canLift(b) && d < P.R * 1.6 + 2 && P.held.length < c) startLift(b);
      else if (d < P.R * 2.2 && b.state === 'sleep') world.wake(b);
    }
    // drzewa: wyrwane, potem niesione albo zjedzone
    if (forest) for (const t of forest.trees) {
      if (!t.alive || Math.abs(t.x - P.x) > P.R * 2 + 3 || Math.abs(t.z - P.z) > P.R * 2 + 3) continue;
      if (Math.hypot(t.x - P.x, t.z - P.z) > P.R * 1.5 + t.R * 0.5 || P.R < t.h * 0.22) continue;
      const d = forest.uproot(t); if (!d) continue;
      const b = world.addObject(d.obj, { ...d, kind: 'tree', sleep: false, name: 'drzewo' });
      b.baseScale = t.scale; b.eatSize = t.h * 0.35; b.v.set(0, 3, 0);
      if (canEat(b)) startEat(b); else if (P.held.length < c) startLift(b);
    }
    // zjadane: spirala do środka i w górę, maleją, znikają
    for (let i = P.eating.length - 1; i >= 0; i--) {
      const b = P.eating[i], e = b.eat; e.t += dt;
      const f = clamp(e.t / e.dur, 0, 1), r = e.r * (1 - f) + P.R * 0.3 * f;
      e.a += (5 + 6 / Math.max(0.5, r)) * dt;
      b.p.set(P.x + Math.cos(e.a) * r, gy + e.y0 + f * f * (P.R * 3 + 6), P.z + Math.sin(e.a) * r);
      _q.setFromEuler(_e.set(dt * 7, dt * 9, dt * 5)); b.q.multiply(_q);
      b.scale = e.s0 * (1 - 0.85 * f); b.moved = true;
      if (f >= 1) { P.eating.splice(i, 1); world.removeBody(b); grow(b.vol || 0.001, b); }
    }
    // niesione: krążą w wirze; gdy trąba urośnie, zjada je
    for (let i = P.held.length - 1; i >= 0; i--) {
      const b = P.held[i];
      if (!world.bodies.has(b)) { P.held.splice(i, 1); continue; }
      if (canEat(b)) { P.held.splice(i, 1); b.orbit = null; startEat(b); continue; }
      const o = b.orbit; o.a += o.spd / o.r * dt; o.wob += dt * 2;
      const tx = P.x + Math.cos(o.a) * o.r, tz = P.z + Math.sin(o.a) * o.r, ty = gy + o.h + Math.sin(o.wob) * 0.4 + b.r * 0.5;
      const kk = 1 - Math.exp(-5 * dt);
      b.v.set((tx - b.p.x) * kk / dt, (ty - b.p.y) * kk / dt, (tz - b.p.z) * kk / dt);   // prędkość do rzutu
      b.p.x += (tx - b.p.x) * kk; b.p.y += (ty - b.p.y) * kk; b.p.z += (tz - b.p.z) * kk;
      _q.setFromEuler(_e.set(dt * 1.5, dt * 2.5, dt)); b.q.multiply(_q); b.moved = true;
    }
    // wiatr niszczy budynki w zasięgu wiru; śpiące odłamki pod wirem budzą się (wiatr nimi miota)
    world.windDamage(P.x, P.z, P.R * 2.2 + 2, (x, y, z) => { tornadoWind(T, x, y, z, W3); return Math.hypot(W3[0], W3[1], W3[2]); }, dt);
  }

  // rzut: najcięższa niesiona rzecz leci w punkt (tor balistyczny)
  function throwAt(point) {
    if (!P.held.length) return null;
    let bi = 0; P.held.forEach((b, i) => { if (b.m > P.held[bi].m) bi = i; });
    const b = P.held.splice(bi, 1)[0];
    b.orbit = null; b.state = 'active'; b.thrown = true; b.noPick = P.time + 2.5; b.sleepT = 0;
    const speed = 20 + P.R * 2, d = point.clone().sub(b.p), L = d.length(), tf = Math.max(0.15, L / speed);
    b.v.copy(d).divideScalar(tf); b.v.y += 0.5 * 9.81 * tf;
    b.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(4);
    P.thrown++;
    return b;
  }

  Object.assign(P, { update, throwAt, onEat(f) { listeners.eat.push(f); }, onGrow(f) { listeners.grow.push(f); } });
  Object.defineProperty(P, 'cap', { get: cap });
  return P;
}
