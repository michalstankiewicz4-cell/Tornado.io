// OptiKit — lustro stojące obrotowe: tafla 500 × 1500 mm (szkło 4 mm srebrzone, odbicie ok. 95 %) w ramie z profilu
// aluminiowego na tylnej płycie, kolumna na łożysku w żeliwnej podstawie Ø 450 mm — obrót w poziomie (oś pionowa).
// Odbicie liczone na żywo (Reflector: kamera lustrzana dla każdej kamery, która patrzy na lustro — także kamery wideo).
// userData: setAngle(rad) / angle — obrót wokół osi pionowej, api { drag('mirror', dy, dx) — przeciąganie w bok (albo w górę / w dół) obraca, press, release },
// normal() — normalna tafli (świat). Początek: środek podstawy na podłodze; tafla patrzy w +z przy kącie 0.
import * as THREE from '../../../../vendor/three/three.module.js';
import { Reflector } from '../../../../vendor/three/addons/objects/Reflector.js';
import { DOMAIN, materials } from '../mechkit.js';
import { EN, mesh, port, plastic } from '../common.js';

export function standingMirror({ H = 1.5, W = 0.5, res = 512, name } = {}) {
  const M = materials(), g = new THREE.Group(), y0 = 0.12, p = 0.022, d = 0.03, black = plastic(0x141516, 0.6);
  g.name = name || (EN ? `Rotating standing mirror ${Math.round(H * 1000)} mm` : `Lustro stojące obrotowe ${Math.round(H * 1000)} mm`);
  // podstawa: żeliwny talerz z gumowym pierścieniem, obudowa łożyska z pokrętłem blokady
  const iron = new THREE.MeshPhysicalMaterial({ color: 0x24262a, roughness: 0.5, metalness: 0.6, clearcoat: 0.3 });
  const base = mesh(new THREE.CylinderGeometry(0.22, 0.225, 0.025, 64), iron); base.position.y = 0.0175; g.add(base);
  const rub = mesh(new THREE.CylinderGeometry(0.226, 0.226, 0.005, 64), black); rub.position.y = 0.0025; g.add(rub);
  const hous = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.05, 40), iron); hous.position.y = 0.055; g.add(hous);
  const knob = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 20).rotateZ(Math.PI / 2), black); knob.position.set(0.055, 0.06, 0); g.add(knob);
  // część obrotowa: kolumna, rama, płyta tylna, tafla
  const turn = new THREE.Group(); g.add(turn);
  const zf = 0.05;   // tafla przed osią obrotu (kolumna na osi, w łożysku)
  const post = mesh(new THREE.CylinderGeometry(0.0175, 0.0175, y0 + H * 0.75 - 0.06), M.steel); post.position.set(0, 0.06 + (y0 + H * 0.75 - 0.06) / 2, 0); post.userData.doctorOk = 'clash'; turn.add(post);
  const collar = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 32), M.alu); collar.position.set(0, 0.0915, 0); turn.add(collar);
  const yc = y0 + H / 2;
  for (const yy of [y0 + 0.15, y0 + H * 0.72]) { const cl = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.043), M.alu); cl.position.set(0, yy, zf - 0.0365); cl.userData.doctorOk = 'clash'; turn.add(cl); }   // obejmy kolumny przykręcone do płyty (kolumna w obejmie)
  const back = mesh(new THREE.BoxGeometry(W + 0.004, H + 0.004, 0.012), new THREE.MeshStandardMaterial({ color: 0x2b2722, roughness: 0.8 })); back.position.set(0, yc, zf - 0.009); turn.add(back);
  const prof = (w, h, x, y) => { const b = mesh(new THREE.BoxGeometry(w, h, d), M.alu); b.position.set(x, y, zf + d / 2 - 0.014); turn.add(b); return b; };
  const frame = [prof(W + 2 * p, p, 0, y0 - p / 2), prof(W + 2 * p, p, 0, y0 + H + p / 2), prof(p, H, -W / 2 - p / 2, yc), prof(p, H, W / 2 + p / 2, yc)];
  const glass = new Reflector(new THREE.PlaneGeometry(W, H), { textureWidth: res, textureHeight: Math.round(res * H / W), color: 0xf2f2f2, clipBias: 0.003, multisample: 2 });
  glass.position.set(0, yc, zf + 0.004); glass.userData.doctorOk = 'seethrough'; turn.add(glass);
  const edge = mesh(new THREE.BoxGeometry(W, H, 0.004), new THREE.MeshPhysicalMaterial({ color: 0x9fc4b8, roughness: 0.1, metalness: 0, clearcoat: 1 })); edge.position.set(0, yc, zf + 0.0018); edge.userData.doctorOk = 'clash'; turn.add(edge);   // szkło 4 mm (zielonkawe krawędzie) pod warstwą lustra
  [back, glass, edge, ...frame].forEach((o) => { o.userData.control = 'mirror'; });
  let angle = 0;
  const setAngle = (a) => { angle = Math.atan2(Math.sin(a), Math.cos(a)); turn.rotation.y = angle; };
  const api = { get angle() { return angle; }, press() {}, release() {}, drag(c, dy, dx = 0) { if (c === 'mirror') setAngle(angle + (dx || dy) * 0.006); }, tick() {} };
  g.userData = { H, W, setAngle, api, get angle() { return angle; }, glass, mass: W * H * 0.004 * 2500 + 9.5 + 3.2,
    normal: () => new THREE.Vector3(0, 0, 1).transformDirection(turn.matrixWorld),
    ports: { pivot: port(EN ? 'Vertical pivot (rotate by hand)' : 'Oś pionowa (obrót ręczny)', DOMAIN.rot, EN ? 'bearing' : 'łożysko'), face: port(EN ? 'Mirror face' : 'Tafla lustra', DOMAIN.light, EN ? 'reflection' : 'odbicie') } };
  return g;
}
