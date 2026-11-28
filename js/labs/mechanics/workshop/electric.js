// Warsztat — prąd: zasilanie 3 × 400 V, przyciski, stycznik i falownik połączone przewodami z silnikiem. Połączenie dwóch
// urządzeń „Połącz z…” to kabel (prawdziwy przekrój i długość, rezystancja z niej), a jego żyły wynikają z rodzajów urządzeń:
//   'ctl' — przewód sterowniczy 3 × 1 mm² (zasilanie ↔ przycisk, przycisk ↔ przycisk, przycisk ↔ cewka stycznika): łańcuch
//          od L1 zasilania przez styki przycisków do A1 cewki, A2 do N; podtrzymanie — styk 13-14 stycznika równolegle do
//          najbliższego przycisku START przed cewką;
//   'pwr' — przewód zasilający 5G2,5 (zasilanie → styki główne 1-3-5 stycznika, 2-4-6 → falownik, albo zasilanie → falownik);
//   'mot' — przewód silnikowy (falownik → silnik 4G1,5 ekranowany; stycznik albo zasilanie → silnik 4G2,5 — rozruch bezpośredni).
// Obwód liczy createCircuit (behaviors/mech/circuit.js) co klatkę: cewka zadziała przy ≥ 85 % Un po 20 ms, odpada < 60 %
// (ControlKit.ELEC), falownik pracuje od 85 % napięcia wejścia. Silnik dostaje: z falownika — prędkość synchroniczną 30·f
// (2 pary biegunów), z rozruchu bezpośredniego — 1500 obr/min; bez napięcia — moment zero (wybieg na oporach i hamulcu).
// createElectrics({ group, TOP, name }) → { build(parts, links), tick(dt, { running, rpm }), trip(), cableKind, stats, warn }
import * as THREE from '../../../../vendor/three/three.module.js';
import * as CK from '../../../models/mech/controls.js';
import { createCircuit } from '../../../behaviors/mech/circuit.js';
import { T } from '../lang.js';

export const ELEC_KINDS = ['ctl', 'pwr', 'mot'];
const PAIR = { 'btn|src': 'ctl', 'btn|btn': 'ctl', 'btn|k': 'ctl', 'k|src': 'pwr', 'src|vfd': 'pwr', 'k|vfd': 'pwr', 'motor|vfd': 'mot', 'k|motor': 'mot', 'motor|src': 'mot' };
const elOf = (pt) => (pt.def.role === 'motor' || pt.b.el === 'pump' ? 'motor' : pt.b.el);   // pompa blokowa ma własny silnik — zasilana jak silnik
// rodzaj kabla dla pary urządzeń (albo komunikat, czemu się nie da)
export function cableKind(s, t, links) {
  const a = elOf(s), b = elOf(t); if (!a || !b) return null;
  const kind = PAIR[[a, b].sort().join('|')];
  if (!kind) return T('Tych urządzeń nie łączy się bezpośrednio: zasilanie → przyciski → cewka stycznika (sterowanie), zasilanie → stycznik → falownik → silnik (moc).', 'These devices are not wired directly: supply → buttons → contactor coil (control), supply → contactor → inverter → motor (power).');
  const mine = (pt, k, other) => links.filter((l) => l.kind === k && (l.a === pt || l.b === pt) && (!other || elOf(l.a === pt ? l.b : l.a) === other));
  for (const pt of [s, t]) {
    const e = elOf(pt);
    if (kind === 'mot' && mine(pt, 'mot').length) return T(`${e === 'motor' ? 'Silnik' : 'To urządzenie'} ma już przewód silnikowy.`, `${e === 'motor' ? 'The motor' : 'This device'} already has a motor cable.`);
    if (kind === 'pwr' && e === 'vfd' && mine(pt, 'pwr').length) return T('Falownik ma już przewód zasilający.', 'The inverter already has a supply cable.');
    if (kind === 'pwr' && e === 'k' && mine(pt, 'pwr', elOf(pt === s ? t : s)).length) return T('Stycznik ma już taki przewód.', 'The contactor already has such a cable.');
  }
  if (kind === 'mot' && [a, b].includes('k') && links.some((l) => l.kind === 'pwr' && [l.a, l.b].includes(a === 'k' ? s : t) && [l.a, l.b].some((p) => elOf(p) === 'vfd'))) return T('Wyjście stycznika zasila już falownik.', 'The contactor output already feeds an inverter.');
  return { kind };
}
const SPEC = {
  ctl: { cores: 3, mm2: 1, color: 'grey', name: 'przewód sterowniczy 3 × 1 mm²' },
  pwr: { cores: 5, mm2: 2.5, color: 'black', name: 'przewód zasilający 5G2,5' },
  motV: { cores: 4, mm2: 1.5, color: 'orange', name: 'przewód silnikowy 4G1,5 (ekranowany)' },
  motD: { cores: 4, mm2: 2.5, color: 'black', name: 'przewód silnikowy 4G2,5' },
};
export const specOf = (l) => SPEC[l.kind === 'mot' ? ([l.a, l.b].some((p) => elOf(p) === 'vfd') ? 'motV' : 'motD') : l.kind];

export function createElectrics({ group, TOP, name }) {
  const cables = new Map(), E = CK.ELEC;
  let c = null, devs = [], ks = [], vfds = [], srcs = [], motor = null, feed = null, warn = [], last = { on: false, rpm: 0 }, stopMsg = '';
  const feeds = new Map(), sup = new Map();   // odbiornik (silnik, pompa) → zasilanie { mode, vfd | via }; stan zasilania w klatce { on, f, U }
  // kabel po blacie: dławik na ściance urządzenia zwróconej do drugiego, zejście na blat, środek leży na blacie
  function port(pt, toward) {
    if (pt.def.role === 'motor' && !pt.b.portAt) {   // silnik: dławik skrzynki zaciskowej (bok skrzynki, jak w Fizyce), wymiary skalowane wzrostem osi
      const m = pt.b.group.children[0], k = m.userData.H / 0.09; m.updateWorldMatrix(true, false);
      return { p: m.localToWorld(new THREE.Vector3(-0.15 * k, m.userData.H + 0.11 * k, 0.052 * k)), n: new THREE.Vector3(0, 0, 1).applyQuaternion(pt.pivot.quaternion), out: 0.16 * k };   // zejście na blat za łapami silnika
    }
    const b = new THREE.Box3().setFromObject(pt.pivot), C = b.getCenter(new THREE.Vector3()), d = toward.clone().sub(C);
    const n = Math.abs(d.x) > Math.abs(d.z) ? new THREE.Vector3(Math.sign(d.x) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(d.z) || 1);
    const p = new THREE.Vector3(n.x ? (n.x > 0 ? b.max.x : b.min.x) + n.x * 0.002 : C.x, Math.min(b.max.y - 0.01, TOP + 0.03), n.z ? (n.z > 0 ? b.max.z : b.min.z) + n.z * 0.002 : C.z);
    return { p, n, out: 0.05 };
  }
  function lay(l) {
    const old = cables.get(l); if (old) group.remove(old);
    const s = specOf(l), Ca = new THREE.Box3().setFromObject(l.a.pivot).getCenter(new THREE.Vector3()), Cb = new THREE.Box3().setFromObject(l.b.pivot).getCenter(new THREE.Vector3());
    const A = port(l.a, Cb), B = port(l.b, Ca), D0 = 0.012, a1 = A.p.clone().addScaledVector(A.n, A.out), b1 = B.p.clone().addScaledVector(B.n, B.out);
    a1.y = b1.y = TOP + D0 / 2; const mid = a1.clone().lerp(b1, 0.5);
    const pts = [A.p, A.p.clone().addScaledVector(A.n, A.out * 0.6).setY(A.p.y * 0.4 + a1.y * 0.6), a1, mid, b1, B.p.clone().addScaledVector(B.n, B.out * 0.6).setY(B.p.y * 0.4 + b1.y * 0.6), B.p];
    const g = CK.cable({ points: pts, cores: s.cores, mm2: s.mm2, color: s.color, name: s.name }); group.add(g); cables.set(l, g); l.visual = g; return g;
  }
  // lista połączeń z grafu części
  function build(parts, links) {
    for (const [l, g] of cables) if (!links.includes(l)) { group.remove(g); cables.delete(l); }
    const el = links.filter((l) => ELEC_KINDS.includes(l.kind)); el.forEach(lay);
    warn = []; c = createCircuit();
    devs = parts.filter((p) => p.def.role === 'elec'); srcs = devs.filter((p) => p.b.el === 'src'); vfds = devs.filter((p) => p.b.el === 'vfd');
    ks = devs.filter((p) => p.b.el === 'k').map((p) => { const o = ks.find((k) => k.pt === p && k.api === p.b.api); return o || { pt: p, api: p.b.api, on: false, t: 0, u: 0 }; });   // stan kotwicy przetrwa przebudowę obwodu (przesunięcie, nowy kabel)
    motor = parts.find((p) => p.def.role === 'motor') || null; feed = null; feeds.clear(); sup.clear();
    const R = (l) => (cables.get(l) ? cables.get(l).userData.R : 0), other = (l, p) => (l.a === p ? l.b : l.a), id = (p) => p.id;
    for (const s of srcs) { const UF = s.b.group.userData.elec.Uph; c.source(id(s), { L1: [UF, 0], L2: [UF, -120], L3: [UF, 120], N: [0, 0], PE: [0, 0] }, () => s.b.api.on); }
    for (const k of ks) { for (const [a, b] of [['1', '2'], ['3', '4'], ['5', '6']]) c.contact(`${id(k.pt)}:${a}`, `${id(k.pt)}:${b}`, () => k.on, id(k.pt)); if (k.pt.b.hold) c.contact(`${id(k.pt)}:13`, `${id(k.pt)}:14`, () => k.on, id(k.pt)); c.load(id(k.pt), [`${id(k.pt)}:A1`, `${id(k.pt)}:A2`], { Un: k.pt.b.elec.coilU }); }
    for (const b of devs.filter((p) => p.b.el === 'btn')) c.contact(`${id(b)}:in`, `${id(b)}:out`, () => b.b.api.closed, id(b));
    // sterowanie: od L1 każdego zasilania wszerz po przewodach sterowniczych; kierunek żył z odległości od zasilania
    const reached = new Set(), held = new Set();
    for (const s of srcs) {
      const q = [{ p: s, out: `${id(s)}:L1`, start: null }];
      while (q.length) {
        const { p, out, start } = q.shift();
        for (const l of el) if (l.kind === 'ctl' && (l.a === p || l.b === p)) {
          const o = other(l, p), oe = o.b.el;
          if (oe === 'btn' && !reached.has(o)) { reached.add(o); c.wire(out, `${id(o)}:in`, { R: R(l), name: 'L' }); q.push({ p: o, out: `${id(o)}:out`, start: o.b.kind === 'start' ? o : start }); }
          else if (oe === 'k') {
            reached.add(o); c.wire(out, `${id(o)}:A1`, { R: R(l), name: 'A1' }).wire(`${id(o)}:A2`, `${id(s)}:N`, { R: R(l), name: 'N' });
            if (o.b.hold && start && !held.has(o)) { held.add(o); c.wire(`${id(o)}:13`, `${id(start)}:in`, { R: R(l) }).wire(`${id(o)}:14`, `${id(start)}:out`, { R: R(l) }); }
          }
        }
      }
    }
    // moc
    const T3 = { src: ['L1', 'L2', 'L3'], kin: ['1', '3', '5'], kout: ['2', '4', '6'], vfd: ['L1', 'L2', 'L3'], motor: ['U', 'V', 'W'] };
    const wire3 = (pa, ta, pb, tb, l) => { for (let i = 0; i < 3; i++) c.wire(`${id(pa)}:${T3[ta][i]}`, `${id(pb)}:${T3[tb][i]}`, { R: R(l), name: l.kind }); };
    for (const l of el) {
      if (l.kind === 'ctl') continue;
      const [p, q] = [l.a, l.b].sort((x, y) => 'src k vfd motor'.indexOf(elOf(x)) - 'src k vfd motor'.indexOf(elOf(y))), ep = elOf(p), eq = elOf(q);   // od strony zasilania
      if (l.kind === 'mot' && ep === 'vfd') { feeds.set(q, { mode: 'vfd', vfd: p }); continue; }
      wire3(p, ep === 'k' ? 'kout' : ep, q, eq === 'k' ? 'kin' : eq, l);
      if (l.kind === 'mot') feeds.set(q, { mode: 'dol', via: p });
    }
    feed = motor ? feeds.get(motor) || null : null;
    for (const v of vfds) c.load(id(v), ['L1', 'L2', 'L3'].map((t) => `${id(v)}:${t}`), { Un: v.b.elec.Uin });
    for (const [q, fd] of feeds) if (fd.mode === 'dol') c.load(id(q), ['U', 'V', 'W'].map((t) => `${id(q)}:${t}`), { Un: 400 });
    // ostrzeżenia
    for (const b of devs.filter((p) => p.b.el === 'btn')) if (!reached.has(b)) warn.push(T(`${name(b)} — niepodłączony do zasilania (łańcuch sterowania zaczyna się na zasilaniu).`, `${name(b)} — not connected to the supply (the control chain starts at the supply).`));
    for (const k of ks) {
      if (!reached.has(k.pt)) warn.push(T(`${name(k.pt)} — cewka bez sterowania (połącz przez przyciski z zasilaniem).`, `${name(k.pt)} — coil without control (wire it through buttons to the supply).`));
      else if (k.pt.b.hold && !held.has(k.pt)) warn.push(T(`${name(k.pt)} — podtrzymanie włączone, ale przed cewką nie ma przycisku START.`, `${name(k.pt)} — self-hold is on, but there is no START button before the coil.`));
      if (!el.some((l) => l.kind === 'pwr' && (l.a === k.pt || l.b === k.pt) && elOf(other(l, k.pt)) === 'src')) warn.push(T(`${name(k.pt)} — styki główne bez zasilania.`, `${name(k.pt)} — main contacts without supply.`));
    }
    for (const v of vfds) { if (!el.some((l) => l.kind === 'pwr' && (l.a === v || l.b === v))) warn.push(T(`${name(v)} — bez przewodu zasilającego.`, `${name(v)} — no supply cable.`)); if (motor && feed && feed.vfd === v && v.b.kW + 1e-6 < motor.b.kW) warn.push(T(`${name(v)} (${v.b.kW} kW) za mały na silnik ${motor.b.kW} kW — zabezpieczenie nadprądowe wyłączy go przy obciążeniu.`, `${name(v)} (${v.b.kW} kW) too small for the ${motor.b.kW} kW motor — overcurrent protection will trip under load.`)); }
    for (const [q, fd] of feeds) if (fd.mode === 'dol' && elOf(fd.via) === 'src') warn.push(T(`${name(q)} podłączony wprost do zasilania — rusza od razu po włączeniu wyłącznika (bez stycznika i przycisków).`, `${name(q)} wired straight to the supply — it starts as soon as the switch is on (no contactor, no buttons).`));
    if (devs.length && motor && !feed) warn.push(T('Silnik bez przewodu silnikowego — zasilany umownie (przycisk „Uruchom”).', 'Motor without a motor cable — notional supply (the “Run” button).'));
    return warn;
  }
  // co klatkę: obwód → styczniki → falowniki → zasilanie silnika
  function tick(dt, { running, rpm }) {
    stopMsg = '';
    if (!c) return { wired: false };
    let r = c.solve();
    for (const k of ks) {
      k.u = r.U(k.pt.id); const e = k.pt.b.elec;
      if (!k.on) { k.t = k.u >= e.pullIn * e.coilU ? k.t + dt : 0; if (k.t >= e.tClose) k.on = true; } else if (k.u < e.dropOut * e.coilU) { k.on = false; k.t = 0; }
      k.pt.b.api.coil(k.on);
    }
    if (ks.length) r = c.solve();   // stan styków się zmienił — napięcia za stycznikami też
    let stop = false;
    for (const v of vfds) {
      const a = v.b.api, was = a.powered; a.power(r.U(v.id) >= 0.85 * v.b.elec.Uin); a.ai(Math.min(10, Math.abs(rpm) / 1500 * 10));
      const mine = [...feeds.values()].some((fd) => fd.vfd === v);
      if (mine && was && !a.powered && running) { stop = true; stopMsg = T(`${name(v)} stracił zasilanie — silnik wybiega. Po powrocie zasilania uruchom ponownie.`, `${name(v)} lost its supply — the motor coasts. Run again once the supply is back.`); }
      if (mine && a.powered) { if (rpm && Math.sign(rpm) !== a.dir) a.press('dir'); if (running && !a.run) a.press('run'); if (!running && a.run) a.press('stop'); }
      if (mine && running && !a.powered && !stop) { stop = true; stopMsg = T(`${name(v)} bez zasilania — włącz zasilanie (i stycznik przyciskiem START), potem „Uruchom”.`, `${name(v)} has no supply — switch the supply on (and the contactor with START), then “Run”.`); }
    }
    for (const d of devs) d.b.api.tick(dt);
    // zasilanie odbiorników: z falownika f i napięcie U/f, bezpośrednio — 50 Hz przy ≥ 85 % Un
    for (const [q, fd] of feeds) {
      let o;
      if (fd.mode === 'vfd') { const a = fd.vfd.b.api, on = a.powered && Math.abs(a.f) > 0.05; o = { on, f: on ? a.f : 0, U: on ? Math.min(400, 400 * Math.abs(a.f) / 50) : 0, mode: 'vfd' }; }
      else { const U = r.U(q.id), on = U >= 0.85 * 400; o = { on, f: on ? 50 : 0, U, mode: 'dol' }; }
      sup.set(q, o);
    }
    const m0 = motor && sup.get(motor), on = !!(m0 && m0.on), rpmT = m0 ? 30 * m0.f : 0, U = m0 ? m0.U : 0;   // silnik napędu: 4 bieguny, n_s = 30·f
    last = { on, rpm: rpmT, U, r };
    return { wired: !!feed, mode: feed && feed.mode, on, rpm: rpmT, U, stop, msg: stopMsg };
  }
  // krańcówka w trybie zasilania z obwodu: stycznik odpada (jak styk krańcówki w obwodzie cewki), falownik STOP
  function trip() { for (const k of ks) { k.on = false; k.t = 0; k.pt.b.api.coil(false); } for (const v of vfds) if (v.b.api.run) v.b.api.press('stop'); }
  function stats(st, motorB) {
    const rows = [];
    if (!c) return rows;
    for (const s of srcs) rows.push([name(s), s.b.api.on ? T('włączone', 'on') : T('wyłączone', 'off')]);
    for (const k of ks) rows.push([name(k.pt), `${k.on ? T('załączony', 'closed') : T('otwarty', 'open')} · ${T('cewka', 'coil')} ${Math.round(k.u)} V`]);
    for (const v of vfds) { const a = v.b.api; rows.push([name(v), a.powered ? `${Math.abs(a.f).toFixed(1)} Hz · ${a.run ? 'RUN' : 'STOP'} · ${a.dir > 0 ? 'FWD' : 'REV'}` : T('bez zasilania', 'no supply')]); }
    if (motor && feed && motorB) {
      const eM = motorB.group.userData.elec, Tn = motorB.Trated, k0 = eM ? eM.k0 : 0.6, In = eM ? eM.In : 0;
      const I = last.on ? In * Math.sqrt(k0 * k0 + (1 - k0 * k0) * Math.min(4, (st.Tm / Tn) ** 2)) : 0;
      rows.push([T('Zasilanie silnika', 'Motor supply'), `${feed.mode === 'vfd' ? T('z falownika', 'from the inverter') : T('bezpośrednio (stycznik)', 'direct on line')} · ${Math.round(last.U)} V · ${I.toFixed(2)} A`]);
    }
    return rows;
  }
  return { build, tick, trip, stats, supply: (pt) => sup.get(pt) || null, fed: (pt) => feeds.has(pt), get warn() { return warn; }, get feed() { return feed; }, clear() { for (const g of cables.values()) group.remove(g); cables.clear(); c = null; feed = null; feeds.clear(); sup.clear(); devs = []; ks = []; vfds = []; srcs = []; } };
}
