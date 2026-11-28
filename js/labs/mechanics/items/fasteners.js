// Połączenia (kategoria: połączenia śrubowe): śruba z łbem sześciokątnym i nakrętka — dwie blachy na zakładkę skręcone
// śrubą z podkładkami. Nakrętkę dokręca się przeciąganiem (klucz): po dojściu do oporu rośnie napięcie wstępne
// (behaviors/mech/bolted-joint.js — sztywność śruby i blach, moment z tarcia w gwincie i pod nakrętką, granica
// plastyczności, zerwanie). Modele: js/models/mech/fasteners.js (gwint ISO, łeb, nakrętka, podkładka).
import * as THREE from '../../../../vendor/three/three.module.js';
import * as FS from '../../../models/mech/fasteners.js';
import { createBoltedJoint } from '../../../behaviors/mech/bolted-joint.js';
import { T } from '../lang.js';
import { num, kg, P } from './util.js';

const SIZES = [6, 8, 10, 12, 16, 20, 24], LENS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 110, 120];
const FIN = (cls) => (cls === 'A2-70' ? 'stainless' : cls === '10.9' || cls === '12.9' ? 'black' : 'zinc');
const FIN_NAME = { zinc: 'ocynk galwaniczny', black: 'czernienie (oksydowanie)', stainless: 'stal nierdzewna A2' };
// blacha z otworem przejściowym: od otworu w +z (dir = 1) albo w −z (dir = −1); spód w y = 0, grubość t wzdłuż +y
function plate(W, L, t, dh, dir, mat) {
  const s = new THREE.Shape(), z0 = -W / 2, z1 = L - W / 2;   // w kształcie: x, ys = −z świata
  const ys = (z) => -z * dir; s.moveTo(-W / 2, ys(z0)); s.lineTo(W / 2, ys(z0)); s.lineTo(W / 2, ys(z1)); s.lineTo(-W / 2, ys(z1)); s.closePath();
  const h = new THREE.Path(); h.absarc(0, 0, dh / 2, 0, Math.PI * 2, true); s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004, bevelSegments: 1, curveSegments: 40 }).rotateX(-Math.PI / 2);
  g.translate(0, 0.0004, 0); g.scale(1, t / (t + 0.0008), 1);
  const o = new THREE.Mesh(g, mat); o.castShadow = o.receiveShadow = true; return o;
}

export const FASTENERS = [
  {
    id: 'boltNut', name: 'Śruba z nakrętką', group: 'Połączenia śrubowe',
    params: [
      { key: 'd', label: 'Gwint', type: 'select', options: SIZES.map((d) => [d / 1000, `M${d}`]), def: 0.01 },
      { key: 'cls', label: 'Klasa własności', type: 'select', options: [['4.6', '4.6'], ['5.6', '5.6'], ['8.8', '8.8'], ['10.9', '10.9'], ['12.9', '12.9'], ['A2-70', 'A2-70 (nierdzewna)']], def: '8.8' },
      { key: 'len', label: 'Długość śruby', type: 'select', options: LENS.map((l) => [l / 1000, `${l} mm`]), def: 0.05 },
      { key: 't', label: 'Grubość każdej blachy', type: 'range', min: 0.004, max: 0.03, step: 0.001, unit: 'mm', def: 0.012 },
      { key: 'start', label: 'Nakrętka na początku', type: 'select', options: [['loose', 'luźna — 3 obroty do oporu'], ['rec', 'dokręcona zalecanym momentem']], def: 'loose' },
    ],
    build(p) {
      const d = +p.d, D = FS.METRIC[Math.round(d * 1000)], C = FS.BOLT_CLASSES[p.cls], fin = FIN(p.cls), len = +p.len, t = p.t;
      const lk = 2 * t + 2 * D.wh, m = D.m, Pp = D.P, W = Math.max(0.03, 2.2 * D.wD), L = 3 * W;
      const asm = new THREE.Group(), root = new THREE.Group(); root.add(asm); asm.rotation.z = Math.PI / 2;   // oś śruby poziomo: łeb w −x, nakrętka w +x
      const bolt = FS.hexBolt({ d, len, cls: p.cls, finish: fin }); asm.add(bolt);
      const w1 = FS.washer({ d, finish: fin }); w1.position.y = -D.wh; asm.add(w1);
      const w2 = FS.washer({ d, finish: fin }); w2.position.y = -lk; asm.add(w2);
      const pm = new THREE.MeshPhysicalMaterial({ color: 0x7d8288, roughness: 0.55, metalness: 0.85, clearcoat: 0.05 });   // stal S235 walcowana, szlifowana pod podkładkami
      const p1 = plate(W, L, t, D.dh, 1, pm); p1.position.y = -D.wh - t; asm.add(p1);
      const p2 = plate(W, L, t, D.dh, -1, pm); p2.position.y = -D.wh - 2 * t; asm.add(p2);
      // nakrętka: położenie początkowe na całkowitej liczbie skoków (gwint nakrętki w fazie z gwintem śruby)
      const y0 = Pp * Math.floor((-lk - m - 3 * Pp) / Pp + 1e-9), gapTurns = (-lk - m - y0) / Pp;
      const nutPiv = new THREE.Group(); asm.add(nutPiv); const nut = FS.hexNut({ d, finish: fin }); nutPiv.add(nut);
      nut.traverse((o) => { if (o.isMesh) o.userData.control = 'nut'; });
      // poprawność długości: gwint pod nakrętką i za nią (min. 1 skok wystaje), gwint sięga w zacisk
      const warn = [], plain = bolt.userData.plain;
      const short = len < lk + m + Pp, jam = plain > lk - 0.5 * Pp;
      if (short) warn.push(T(`Śruba za krótka: zacisk ${num(lk * 1000, 1)} mm + nakrętka ${num(m * 1000, 1)} mm — koniec śruby nie wychodzi z nakrętki (potrzeba co najmniej ${Math.ceil((lk + m + Pp) * 1000)} mm).`, `Bolt too short: grip ${num(lk * 1000, 1)} mm + nut ${num(m * 1000, 1)} mm — the bolt end does not come out of the nut (at least ${Math.ceil((lk + m + Pp) * 1000)} mm needed).`));
      if (jam) warn.push(T(`Gwint za krótki: część gładka ${num(plain * 1000, 0)} mm jest dłuższa niż zacisk — nakrętka zatrzyma się na końcu gwintu i nie ściśnie blach. Weź krótszą śrubę.`, `Thread too short: the plain shank ${num(plain * 1000, 0)} mm is longer than the grip — the nut stops at the end of the thread and does not clamp the plates. Use a shorter bolt.`));
      const J = createBoltedJoint({ D, d, cls: p.cls, Rm: C.Rm, Re: C.Re, lk, plain, len, m, DA: W, gap: gapTurns });
      if (p.start === 'rec' && !jam && !short) J.setForce(J.recommended().F);
      const S = J.state;
      const place = () => {
        const adv = J.posAdvance(), off = S.broken ? 0.006 : 0;
        nutPiv.position.y = y0 + adv - off; nutPiv.rotation.y = S.phi;
      };
      place();
      const api = { press() {}, release() {}, drag(c, dy) { if (c !== 'nut' || jam || short) return; J.turn(dy * 0.03); place(); }, tick() {} };   // przeciągnięcie w dół — dokręcanie (prawy gwint)
      const rec = J.recommended(), state = () => (S.broken ? T('zerwana — wymień śrubę', 'broken — replace the bolt') : S.yielded ? T('uplastyczniona — śruba się wydłużyła, wymień ją', 'yielded — the bolt has stretched, replace it') : S.F > 0 ? T('napięta', 'preloaded') : S.snug ? T('przylega', 'snug') : T('luźna', 'loose'));
      const live = () => [['Stan', state()], ['Obrót nakrętki od oporu', `${num((S.phi - S.phi0) * 180 / Math.PI, 0)}°`], ['Napięcie wstępne F', `${num(S.F / 1000, 2)} kN`], ['Moment dokręcania M', `${num(S.T, 1)} N·m`], ['Naprężenie zredukowane σ_red', `${num(S.sred / 1e6, 0)} MPa (${num(S.util * 100, 0)} % R_e)`]];
      const mass = bolt.userData.mass + nut.userData.mass + 2 * w1.userData.mass;
      return { group: root, controls: true, api, rest: true, view: { yaw: 0.65, pitch: 0.35, zoom: 0.55 }, warn, live, update() {}, tick() { if (S.broken && !warn.some((w) => w.startsWith('⚡'))) warn.push(T('⚡ Śruba zerwana w części gwintowanej (przekroczone wydłużenie przy zerwaniu).', '⚡ The bolt broke in the threaded part (elongation at fracture exceeded).')); },
        info: [['Gwint', `M${Math.round(d * 1000)} × ${num(Pp * 1000, 2)} (d₂ ${num(D.d2 * 1000, 2)} mm, d₃ ${num(D.d3 * 1000, 2)} mm)`], ['Przekrój czynny A_s', `${num(D.As * 1e6, 1)} mm²`], ['Klasa własności', `${p.cls}: R_m ${num(C.Rm / 1e6, 0)} MPa, R_e ${num(C.Re / 1e6, 0)} MPa`], ['Powłoka', FIN_NAME[fin]],
          ['Zacisk l_k (2 blachy + 2 podkładki)', `${num(lk * 1000, 1)} mm`], ['Gwint śruby b / część gładka', `${num(bolt.userData.b * 1000, 0)} / ${num(plain * 1000, 0)} mm`],
          ['Sztywność śruby / blach', `${num(J.ks / 1e6, 0)} / ${num(J.kp / 1e6, 0)} N/µm`], ['Zalecane napięcie (90 % R_e)', `${num(rec.F / 1000, 1)} kN`], ['Zalecany moment (μ = 0,12)', `${num(rec.T, 1)} N·m`],
          ['Napięcie przy granicy plastyczności', `${num(J.Fy / 1000, 1)} kN`], ['Klucz', `${num(D.s * 1000, 0)} mm`], ['Obsługa', 'przeciągnij nakrętkę w dół — dokręcanie, w górę — luzowanie'], ['Masa (śruba, nakrętka, 2 podkładki)', kg(mass)], ...live()],
        ports: [P('head', T('Łeb — klucz ', 'Head — spanner ') + `${num(D.s * 1000, 0)} mm`, 'obrót'), P('nut', T('Nakrętka — klucz ', 'Nut — spanner ') + `${num(D.s * 1000, 0)} mm`, 'obrót'), P('grip', T('Zacisk blach ', 'Plate grip ') + `${num(lk * 1000, 1)} mm`, 'przesuw')] };
    },
  },
];

