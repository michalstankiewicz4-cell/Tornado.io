// Warsztat — płyn: zbiornik → pompa odśrodkowa → zawory → dysza nad wiadrem. „Połącz z…” między przyłączami to wąż
// przezroczysty 12 × 3 (widać wodę i pęcherzyki), dysza połączona z wiadrem staje wylotem nad jego środkiem ('pour').
// Kierunek przepływu z kolejności w instalacji (zbiornik → pompa → zawór → dysza); każde przyłącze — jeden wąż.
// Co klatkę punkt pracy pompy (behaviors/mech/fluid.js): H_pompy(Q, n) = H_stat + straty(Q), gdzie
//   H_stat — wylot dyszy ponad lustrem wody w zbiorniku; straty — węże (Darcy–Weisbach, woda 15 °C, wlot ζ = 0,5),
//   zawór kulowy (pole przelotu z kąta kuli, Cd 0,8), dysza (Cd 0,9 — cała energia strumienia);
//   n — obroty silnika pompy: z zasilania (falownik: 60·f, bezpośrednio 50 Hz) z poślizgiem 3,5 % i rozruchem τ = 0,3 s.
// Pompa odśrodkowa nie zasysa: napływ tylko, gdy lustro wody w zbiorniku jest nad osią wlotu i nad króćcem wylotu zbiornika.
// Woda ubywa ze zbiornika, przybywa w wiadrze (nadmiar się przelewa), strumień rysuje LiquidKit.createJet.
// createFluids({ group, TOP, name }) → { build(parts, links), tick(dt, supply), link(s, t, links), stats(), warn, … }
import * as THREE from '../../../../vendor/three/three.module.js';
import * as FK from '../../../models/mech/fluid/index.js';
import { FLUIDS, G, pipe, ballArea } from '../../../behaviors/mech/fluid.js';
import { createJet } from '../../../render/fluid/liquid.js';
import { T } from '../lang.js';

export const FLUID_KINDS = ['hose', 'pour'];
const ORDER = { tank: 0, pump: 1, valve: 2, nozzle: 3 }, DI = 0.012, RHO = 998;
const num = (v, d = 1) => v.toFixed(d).replace('.', T(',', '.'));

export function createFluids({ group, TOP, name }) {
  const hoses = new Map(), jets = new Map(), st = new Map();   // st: część → stan (poziom, obroty, przepływ)
  let path = null, warn = [], flow = { Q: 0, H: 0, n: 0, P: 0, v: 0, why: '' }, spilled = 0;
  const wp = (pt, k) => { const q = pt.b.ports[k]; pt.b.group.updateWorldMatrix(true, false); return { p: pt.b.group.localToWorld(q.p.clone()), n: q.n.clone().transformDirection(pt.b.group.matrixWorld) }; };
  const S = (pt) => { if (!st.has(pt)) st.set(pt, pt.b.fl === 'tank' ? { V: pt.b.A * pt.b.Hin * pt.b.fill } : pt.b.fl === 'pump' ? { n: 0, th: 0 } : pt.b.fl === 'bucket' ? { V: 0 } : {}); return st.get(pt); };
  // przyłącza użyte przez węże: wąż ma { up: [część, port], dn: [część, port] }
  const used = (links, pt, port) => links.some((l) => l.kind === 'hose' && ((l.up && l.up[0] === pt && l.up[1] === port) || (l.dn && l.dn[0] === pt && l.dn[1] === port)));
  // łączenie: wąż albo dysza nad wiadrem; zwraca { kind, up, dn } albo komunikat
  function link(s, t, links) {
    const fs = s.b.fl, ft = t.b.fl;
    if (!fs || !ft) return T('Tych części nie da się tak połączyć.', 'These parts cannot be connected this way.');
    if ((fs === 'nozzle' && ft === 'bucket') || (fs === 'bucket' && ft === 'nozzle')) {
      const nz = fs === 'nozzle' ? s : t, bk = nz === s ? t : s;
      if (links.some((l) => l.kind === 'pour' && (l.a === nz || l.b === nz))) return T('Dysza jest już nad wiadrem.', 'The nozzle is already over a bucket.');
      const tipY = nz.b.tip.y, rim = bk.b.model.H; if (tipY < rim + 0.01) return T(`Wylot dyszy (${Math.round(tipY * 1000)} mm) poniżej rantu wiadra (${Math.round(rim * 1000)} mm) — podnieś dyszę.`, `The nozzle outlet (${Math.round(tipY * 1000)} mm) is below the bucket rim (${Math.round(rim * 1000)} mm) — raise the nozzle.`);
      return { kind: 'pour', a: bk, b: nz };   // b (dysza) dopasowuje się do a (wiadro)
    }
    if (fs === 'bucket' || ft === 'bucket') return T('Wiadro łączy się tylko z dyszą (dysza nad wiadrem).', 'A bucket connects only to a nozzle (nozzle over the bucket).');
    let [u, d] = ORDER[fs] <= ORDER[ft] ? [s, t] : [t, s];
    if (fs === ft && fs === 'valve' && !links.some((l) => l.kind === 'hose' && l.dn && l.dn[0] === t)) [u, d] = [s, t];   // zawór za zaworem: w górę ten, który ma już dopływ
    if (fs === ft && fs !== 'valve') return T('Dwóch takich części nie łączy się wężem.', 'Two such parts are not joined by a hose.');
    const up = u.b.fl === 'tank' ? 'out' : u.b.fl === 'pump' ? 'out' : u.b.fl === 'valve' ? 'b' : null, dn = d.b.fl === 'pump' ? 'in' : d.b.fl === 'valve' ? 'a' : d.b.fl === 'nozzle' ? 'in' : null;
    if (!up || !dn) return T('Ta część nie ma tu przyłącza (dysza to koniec instalacji, zbiornik — jej początek).', 'This part has no connection here (the nozzle ends the line, the tank starts it).');
    if (u.b.fl === 'tank' && d.b.fl !== 'pump') return T('Ze zbiornika woda idzie najpierw do pompy (ssanie).', 'From the tank the water goes to the pump first (suction).');
    if (used(links, u, up)) return T(`${name(u)} — przyłącze tłoczne już zajęte.`, `${name(u)} — the outlet is already taken.`);
    if (used(links, d, dn)) return T(`${name(d)} — wlot już zajęty.`, `${name(d)} — the inlet is already taken.`);
    return { kind: 'hose', a: u, b: d, up: [u, up], dn: [d, dn] };
  }
  // wąż od przyłącza do przyłącza (długość z łuku), dysza nad wiadrem — przesunięcie stojaka dyszy
  function lay(l) {
    const old = hoses.get(l); if (old) group.remove(old);
    const A = wp(l.up[0], l.up[1]), B = wp(l.dn[0], l.dn[1]);
    const h = FK.clearHose({ a: A.p, da: A.n, b: B.p, db: B.n.clone().negate(), di: DI, wall: 0.003, fluid: 'water', reach: Math.max(0.08, A.p.distanceTo(B.p) * 0.45) });
    group.add(h); hoses.set(l, h); l.visual = h; return h;
  }
  function fitPour(l, setPos) {
    const bk = l.a, nz = l.b; bk.pivot.updateWorldMatrix(true, true); nz.pivot.updateWorldMatrix(true, true);
    const C = new THREE.Vector3(); bk.b.group.getWorldPosition(C); const tip = nz.b.group.localToWorld(nz.b.tip.clone());
    setPos(nz, nz.pivot.position.clone().add(new THREE.Vector3(C.x - tip.x, 0, C.z - tip.z)));
  }
  function build(parts, links) {
    for (const [l, h] of hoses) if (!links.includes(l)) { group.remove(h); hoses.delete(l); }
    for (const [pt, j] of jets) if (!parts.includes(pt)) { group.remove(j.group); jets.delete(pt); }
    for (const pt of [...st.keys()]) if (!parts.includes(pt)) st.delete(pt);
    links.filter((l) => l.kind === 'hose').forEach(lay);
    for (const pt of parts) if (pt.b.fl === 'nozzle' && !jets.has(pt)) { const j = createJet({ d: pt.b.d, kind: 'water', drops: 120 }); group.add(j.group); jets.set(pt, j); }
    for (const pt of parts) if (['tank', 'bucket', 'pump'].includes(pt.b.fl)) S(pt);
    // droga: od zbiornika wężami w dół instalacji
    warn = []; path = null;
    const down = (pt) => links.find((l) => l.kind === 'hose' && l.up && l.up[0] === pt);
    for (const tk of parts.filter((p) => p.b.fl === 'tank')) {
      const seq = [tk], hs = []; let cur = tk, l;
      while ((l = down(cur))) { hs.push(l); cur = l.dn[0]; seq.push(cur); if (seq.length > 20) break; }
      const pump = seq.find((p) => p.b.fl === 'pump'), nz = seq[seq.length - 1].b.fl === 'nozzle' ? seq[seq.length - 1] : null;
      if (pump && nz) { const pr = links.find((x) => x.kind === 'pour' && (x.a === nz || x.b === nz)); path = { tank: tk, pump, valves: seq.filter((p) => p.b.fl === 'valve'), nozzle: nz, hoses: hs, bucket: pr ? pr.a : null }; break; }
    }
    const fl = parts.filter((p) => p.def.role === 'fluid');
    if (fl.length) {
      if (!path) warn.push(T('Instalacja niepełna: potrzebne zbiornik → pompa → (zawory) → dysza połączone wężami.', 'Incomplete line: tank → pump → (valves) → nozzle joined by hoses are needed.'));
      else if (!path.bucket) warn.push(T(`${name(path.nozzle)} nie jest nad wiadrem — woda poleje się na blat.`, `${name(path.nozzle)} is not over a bucket — the water will pour onto the table.`));
      for (const p of fl.filter((q) => q.b.fl === 'pump')) if (!links.some((l) => l.kind === 'mot' && (l.a === p || l.b === p))) warn.push(T(`${name(p)} bez przewodu silnikowego — podłącz ją jak silnik (zasilanie, stycznik albo falownik).`, `${name(p)} has no motor cable — wire it like a motor (supply, contactor or inverter).`));
    }
    return warn;
  }
  const level = (tk) => S(tk).V / tk.b.A;   // wysokość wody nad dnem wewnętrznym
  function tick(dt, supply) {
    // obroty pomp: rozruch do n z zasilania (poślizg 3,5 %), wybieg — opory wirnika
    for (const [pt, s] of st) if (pt.b.fl === 'pump') {
      const e = supply(pt), nT = e && e.on ? 60 * e.f * (1 - 0.035) : 0;
      s.n += (nT - s.n) * Math.min(1, dt / (nT ? 0.3 : 1.2)); s.th += s.n / 60 * Math.PI * 2 * dt; pt.b.setAngle(s.th);
    }
    flow = { Q: 0, H: 0, n: 0, P: 0, v: 0, why: '', dry: false };
    if (path) {
      const { tank, pump, valves, nozzle, hoses: hs } = path, n = S(pump).n, wl = TOP + tank.b.y0 + level(tank);   // lustro wody (świat)
      const inY = wp(pump, 'in').p.y, outY = wp(tank, 'out').p.y, tip = nozzle.b.group.localToWorld(nozzle.b.tip.clone());
      flow.n = n;
      if (wl < outY + 0.008) flow.dry = true, flow.why = T('Zbiornik pusty — lustro poniżej króćca wylotu, pompa pracuje na sucho.', 'Tank empty — water below the outlet, the pump runs dry.');
      else if (wl < inY) flow.dry = true, flow.why = T('Lustro wody poniżej osi pompy — pompa odśrodkowa nie zassie (nie jest samozasysająca).', 'Water level below the pump axis — a centrifugal pump will not prime (it is not self-priming).');
      else if (n > 50) {
        const Aj = Math.PI * nozzle.b.d ** 2 / 4, Hstat = tip.y - wl;
        const lossH = (Q) => {
          let h = 0; for (const l of hs) h += pipe(Q, { d: DI, L: hoses.get(l) ? hoses.get(l).userData.L : 0.5, eps: 0.0016e-3, zeta: 0.5, fluid: FLUIDS.water, T: 15 }).dp / (RHO * G);
          for (const v of valves) { const A = ballArea(v.b.d, (1 - v.params.open) * Math.PI / 2); if (A < 1e-9) return Infinity; h += (Q / (0.8 * A)) ** 2 / (2 * G); }
          return h + (Q / (0.9 * Aj)) ** 2 / (2 * G);
        };
        const c = pump.b.curve, f = (Q) => c.H(Q, n) - Hstat - (Q > 0 ? lossH(Q) : 0);
        if (f(0) > 0) { let lo = 0, hi = c.Qmax(n); for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; } flow.Q = lo; if (lo < 1e-9 && valves.some((v) => v.params.open < 0.02)) flow.why = T('Zawór zamknięty — pompa tłoczy na zamknięty zawór.', 'Valve closed — the pump runs against a closed valve.'); }
        else flow.why = valves.some((v) => v.params.open < 0.02) ? T('Zawór zamknięty — pompa tłoczy na zamknięty zawór.', 'Valve closed — the pump runs against a closed valve.') : T(`Pompa nie podniesie wody na ${num(Hstat, 2)} m przy ${Math.round(n)} obr/min.`, `The pump cannot lift water ${num(Hstat, 2)} m at ${Math.round(n)} rpm.`);
        flow.H = c.H(flow.Q, n); flow.P = flow.Q > 0 ? RHO * G * flow.Q * flow.H / c.eta(flow.Q, n) : 0; flow.v = flow.Q / (0.9 * Aj);
      }
      // bilans wody: zbiornik → wiadro (nadmiar przelewa się), bez wiadra — na blat
      const dV = Math.min(flow.Q * dt, S(tank).V); S(tank).V -= dV;
      if (path.bucket) { const b = S(path.bucket), cap = path.bucket.b.model.Vfull; b.V += dV; if (b.V > cap) { spilled += b.V - cap; b.V = cap; } } else spilled += dV;
    }
    // wygląd: poziomy, węże, strumień
    for (const [pt, s] of st) {
      if (pt.b.fl === 'tank') pt.b.model.setLevel(s.V / (pt.b.A * pt.b.Hin));
      if (pt.b.fl === 'bucket') { const m = pt.b.model; let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const u = (lo + hi) / 2; if (m.vol(u) < s.V) lo = u; else hi = u; } if (Math.abs((s.u || 0) - lo) > 0.002) { s.u = lo; m.setLevel(lo); } }
    }
    // na sucho — wąż bez wody
    for (const [l, h] of hoses) { const on = path && path.hoses.includes(l); h.userData.setFlow(on ? flow.Q / (Math.PI * DI * DI / 4) : 0, !(on && flow.dry)); h.userData.tick(dt); }
    for (const [pt, j] of jets) {
      const mine = path && path.nozzle === pt, tip = pt.b.group.localToWorld(pt.b.tip.clone());
      const bk = mine && path.bucket, floorY = bk ? (() => { const g = new THREE.Vector3(); bk.b.group.getWorldPosition(g); const m = bk.b.model; return g.y + 0.0055 + (m.H - 0.0155) * (S(bk).u || 0); })() : TOP;
      j.update(dt, { origin: tip, dir: new THREE.Vector3(0, -1, 0), v: Math.max(0.3, flow.v), floorY, on: !!mine && flow.Q > 1e-7 });
    }
  }
  function stats() {
    const rows = [];
    if (!st.size) return rows;
    if (path) {
      rows.push([name(path.pump), `${Math.round(flow.n)} ${T('obr/min', 'rpm')} · ${num(flow.Q * 60000, 2)} l/min · ${num(flow.H, 2)} m · ${num(flow.P, 1)} W`]);
      if (flow.Q > 0) rows.push([T('Strumień z dyszy', 'Nozzle jet'), `${num(flow.v, 2)} m/s`]);
      if (flow.why) rows.push([T('Uwaga', 'Note'), flow.why]);
    }
    for (const [pt, s] of st) {
      if (pt.b.fl === 'tank') rows.push([name(pt), `${num(s.V * 1000, 2)} l (${Math.round(100 * s.V / (pt.b.A * pt.b.Hin))} %)`]);
      if (pt.b.fl === 'bucket') rows.push([name(pt), `${num(s.V * 1000, 2)} / ${num(pt.b.model.Vfull * 1000, 1)} l`]);
    }
    if (spilled > 1e-5) rows.push([T('Rozlane na blat', 'Spilled on the table'), `${num(spilled * 1000, 2)} l`]);
    return rows;
  }
  // obsługa: dolanie zbiornika do 90 %, wylanie wiadra do zbiornika
  function refill(pt) { const s = S(pt); s.V = Math.max(s.V, pt.b.A * pt.b.Hin * 0.9); }
  function pourBack(bk, tanks) { const s = S(bk), tk = tanks[0]; if (!tk) return false; const t = S(tk), room = tk.b.A * tk.b.Hin * 0.95 - t.V, m = Math.min(room, s.V); t.V += m; s.V -= m; return m; }
  return { link, build, tick, stats, fitPour, refill, pourBack, get warn() { return warn; }, get flow() { return flow; }, state: S,
    clear() { for (const h of hoses.values()) group.remove(h); hoses.clear(); for (const j of jets.values()) group.remove(j.group); jets.clear(); st.clear(); path = null; spilled = 0; } };
}
