// Warsztat — światło: lasery i źródła LED, soczewki, lustra, pryzmaty, fotodiody i ekrany stawiane na stole. Co klatkę
// promienie ze wszystkich włączonych źródeł śledzone przez wszystkie elementy (behaviors/mech/raytrace.js: Snell w wektorach,
// Fresnel, Sellmeier, całkowite wewnętrzne odbicie), wiązki rysuje render/optics/beams.js, fotodioda pokazuje moc i fotoprąd.
// Łączenie („Połącz z…”) nie tworzy połączenia — ustawia część na wiązce wychodzącej z drugiej części (promień środkowy):
//   soczewka, fotodioda, ekran — środkiem na wiązce, prostopadle do niej, w odległości z obecnego położenia (60–500 mm);
//   lustro — na wiązce, skręca ją o 90° w stronę środka stołu; pryzmat — na wiązce, obrócony na najmniejsze odchylenie.
// createOptics({ group, TOP, C0, name }) → { build(parts), tick(dt), align(s, t), toggle(pt), stats(), warn }
import * as THREE from '../../../../vendor/three/three.module.js';
import * as OK from '../../../models/mech/optics/index.js';
import * as RT from '../../../behaviors/mech/raytrace.js';
import { createBeams } from '../../../render/optics/beams.js';
import { T } from '../lang.js';

const SRC = ['laser', 'led'], num = (v, d = 1) => v.toFixed(d).replace('.', T(',', '.'));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createOptics({ group, TOP, C0, name }) {
  const beams = createBeams({ max: 1400 }); group.add(beams.group);
  const on = new Map(), read = new Map();   // źródło → włączone; fotodioda → { P, I }
  let ops = [], warn = [];
  const isSrc = (pt) => SRC.includes(pt.b.op);
  const emitter = (pt) => pt.b.model.userData.emitter;
  const els = () => ops.filter((p) => !isSrc(p)).map((p) => p.b.model);
  function build(parts) {
    ops = parts.filter((p) => p.def.role === 'optic');
    for (const p of ops) if (isSrc(p) && !on.has(p.b.model)) on.set(p.b.model, true);   // nowe źródło — włączone
    warn = [];
    if (ops.length && !ops.some(isSrc)) warn.push(T('Na stole nie ma źródła światła (laser albo LED).', 'There is no light source on the table (laser or LED).'));
    return warn;
  }
  function tick() {
    if (!ops.length) { beams.set([], []); return; }
    group.updateMatrixWorld(true);
    const ems = [];
    for (const p of ops) if (isSrc(p)) { const o = on.get(p.b.model) !== false; p.b.model.userData.setOn(o); if (o) ems.push(emitter(p)); }
    const surfs = RT.sceneOf(els()), r = RT.simulate(surfs, ems); beams.set(r.segs, r.spots);
    for (const p of ops) if (p.b.op === 'pd') {
      const P = r.power.get(p.b.model) || 0, hits = r.spots.filter((s) => s.det === p.b.model), nm = hits.length ? hits.reduce((s, h) => s + h.nm * h.I, 0) / Math.max(1e-12, hits.reduce((s, h) => s + h.I, 0)) : 650;
      const I = RT.siResponsivity(nm) * P; p.b.model.userData.setReading(P, I); read.set(p, { P, I, nm });
    }
  }
  // promień środkowy każdego źródła przez elementy (bez części s) → odcinek wychodzący z części t
  function beamFrom(t, skip) {
    group.updateMatrixWorld(true);
    if (isSrc(t)) { const e = emitter(t); return { p: e.origin(), d: e.dir(), nm: e.white ? 587.6 : e.nm }; }
    const surfs = RT.sceneOf(els().filter((m) => m !== skip.b.model)), box = new THREE.Box3().setFromObject(t.b.model).expandByScalar(0.004);
    for (const p of ops) if (isSrc(p) && on.get(p.b.model) !== false) {
      const e = emitter(p), nm = e.white ? 587.6 : e.nm, tr = RT.trace(surfs, { o: e.origin(), d: e.dir(), I: 1, nm }, { maxLen: 2 });
      const segs = tr.path.filter((q) => q[2] > 0.3);
      for (let i = 1; i < segs.length; i++) if (box.containsPoint(segs[i][0]) && !box.containsPoint(segs[i][1])) return { p: segs[i][0], d: segs[i][1].clone().sub(segs[i][0]).normalize(), nm };
    }
    return null;
  }
  // ustawienie części s na wiązce z t: środek optyczny na wiązce, kąt na stole (yaw w parametrze), spód na blacie
  function align(s, t, { setYaw }) {
    if (!t.b.op) return T('Elementy optyczne ustawia się na wiązce źródła albo innego elementu optycznego.', 'Optical elements are placed on the beam of a source or another optical element.');
    if (isSrc(s)) return T('Źródło stoi tam, gdzie je postawisz — ustawia się do niego pozostałe elementy.', 'A source stays where you put it — the other elements are aligned to it.');
    const B = beamFrom(t, s);
    if (!B) return T(`Nie wychodzi wiązka z: ${name(t)} — najpierw ustaw tę część na wiązce źródła (albo włącz źródło).`, `No beam leaves: ${name(t)} — place it on a source beam first (or switch the source on).`);
    const c0 = new THREE.Vector3(); s.pivot.getWorldPosition(c0); c0.y += OK.AXIS_Y;
    const L = Math.max(0.06, Math.min(0.5, c0.clone().sub(B.p).dot(B.d))), P = B.p.clone().addScaledVector(B.d, L);
    const yawOf = (dir) => wrap(Math.atan2(dir.x, dir.z) - s.rot * Math.PI / 2 - Math.PI / 2);   // model: wiązka wzdłuż +z
    let note = '';
    if (s.b.op === 'mirror') {
      const side = new THREE.Vector3(-B.d.z, 0, B.d.x), toC = C0.clone().sub(P).setY(0);   // skręt w stronę środka stołu (wiązka zostaje na blacie)
      if (side.dot(toC) < 0 || (Math.abs(side.dot(toC)) < 0.02 && side.z < 0)) side.negate();
      const n = B.d.clone().negate().add(side).normalize(); setYaw(s, yawOf(n)); note = T('Lustro skręca wiązkę o 90°.', 'The mirror turns the beam by 90°.');
    } else setYaw(s, yawOf(B.d));
    s.pivot.position.set(P.x, TOP, P.z);
    if (s.b.op === 'prism') {   // najmniejsze odchylenie: przeszukanie kąta stolika (promień środkowy, 587,6 nm)
      const base = s.params.yaw * Math.PI / 180; let best = null;
      for (let a = -1.2; a <= 1.2; a += 0.01) {
        s.b.setYaw(base + a); group.updateMatrixWorld(true);
        const tr = RT.trace(RT.sceneOf([s.b.model]), { o: P.clone().addScaledVector(B.d, -0.05), d: B.d, I: 1, nm: B.nm }), out = tr.path.filter((q) => q[2] > 0.4);
        if (out.length < 3) continue; const o = out[out.length - 1], d = o[1].clone().sub(o[0]).normalize(), dev = Math.acos(Math.max(-1, Math.min(1, d.dot(B.d))));
        if (!best || dev < best.dev) best = { dev, a };
      }
      if (best) { setYaw(s, wrap(base + best.a)); note = T(`Pryzmat na najmniejszym odchyleniu: ${num(best.dev * 180 / Math.PI, 2)}° (${num(B.nm, 1)} nm).`, `Prism at minimum deviation: ${num(best.dev * 180 / Math.PI, 2)}° (${num(B.nm, 1)} nm).`); }
      else { setYaw(s, base); note = T('Wiązka nie przechodzi przez pryzmat przy żadnym kącie.', 'The beam does not pass through the prism at any angle.'); }
    }
    return T(`Ustawiono na wiązce: ${name(s)}, ${Math.round(L * 1000)} mm za: ${name(t)}. ${note}`, `Placed on the beam: ${name(s)}, ${Math.round(L * 1000)} mm after: ${name(t)}. ${note}`).trim();
  }
  const toggle = (pt) => { on.set(pt.b.model, on.get(pt.b.model) === false); };
  const isOn = (pt) => on.get(pt.b.model) !== false;
  function stats() {
    const rows = [];
    for (const p of ops) {
      if (isSrc(p)) rows.push([name(p), isOn(p) ? T('świeci', 'on') : T('wyłączony', 'off')]);
      if (p.b.op === 'pd') { const r = read.get(p) || { P: 0, I: 0 }; rows.push([name(p), `${r.P >= 1e-3 ? `${num(r.P * 1000, 2)} mW` : `${num(r.P * 1e6, 1)} µW`} · ${num(r.I * 1e6, 1)} µA`]); }
    }
    return rows;
  }
  return { build, tick, align, toggle, isOn, stats, get warn() { return warn; }, reading: (pt) => read.get(pt) || null, clear() { ops = []; on.clear(); read.clear(); beams.set([], []); } };
}
