// VideoKit — kamera przemysłowa na statywie: obudowa aluminiowa z daszkiem i szybą, obiektyw (ogniskowa f, przysłona),
// przetwornik 1/2,9" (5,37 × 3,02 mm, 16 : 9), głowica panoramiczno-uchylna, statyw trójnożny z kolumną, kabel z dławikiem.
// Oś optyczna +z grupy tilt. userData: lens() — środek źrenicy (świat), dir() — kierunek patrzenia (świat), fovV — kąt
// widzenia w pionie [°] z przetwornika i ogniskowej, aspect, aim(P) — obrót głowicy na punkt (świat), setOn(b) — dioda.
import * as THREE from '../../../../vendor/three/three.module.js';
import { DOMAIN, materials } from '../mechkit.js';
import { EN, mesh, port, plastic, glow } from '../common.js';

export const SENSOR = { w: 0.00537, h: 0.00302, name: '1/2,9" CMOS 1920 × 1080' };
const cyl = (r1, r2, h, s = 32) => new THREE.CylinderGeometry(r1, r2, h, s);

export function camera({ f = 0.008, H = 1.4, name } = {}) {
  const M = materials(), g = new THREE.Group(), dark = new THREE.MeshPhysicalMaterial({ color: 0x2a2d31, roughness: 0.45, metalness: 0.6, clearcoat: 0.3 }), black = plastic(0x111214, 0.6);
  g.name = name || (EN ? `Industrial camera f = ${Math.round(f * 1000)} mm on a tripod` : `Kamera przemysłowa f = ${Math.round(f * 1000)} mm na statywie`);
  // statyw: trzy nogi (rura Al Ø 22 → Ø 16) z gumowymi stopkami, kolumna środkowa, pająk
  const hc = H - 0.11, spread = 0.36 * Math.min(1.2, H / 1.4), top = hc - 0.18;
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3, foot = new THREE.Vector3(Math.sin(a) * spread, 0.02, Math.cos(a) * spread), hip = new THREE.Vector3(Math.sin(a) * 0.035, top, Math.cos(a) * 0.035);
    const d = hip.clone().sub(foot), L = d.length(), leg = new THREE.Group(); leg.position.copy(foot); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(leg);
    const lo = mesh(cyl(0.008, 0.008, L * 0.55), M.alu); lo.position.y = L * 0.275; leg.add(lo);
    const up = mesh(cyl(0.011, 0.011, L * 0.5), dark); up.position.y = L * 0.75; leg.add(up);
    const clamp = mesh(new THREE.BoxGeometry(0.03, 0.025, 0.026), black); clamp.position.y = L * 0.5; leg.add(clamp);
    const rub = mesh(new THREE.SphereGeometry(0.014, 16, 8).scale(1, 0.55, 1), black); rub.position.y = 0.004; leg.add(rub);   // gumowa stopka
  }
  const hub = mesh(cyl(0.05, 0.045, 0.04, 6), dark); hub.position.y = top + 0.01; g.add(hub);
  const col = mesh(cyl(0.012, 0.012, hc - top - 0.005), M.alu); col.position.y = (top + 0.005 + hc) / 2; g.add(col);   // kolumna wychodzi z pająka (bez wspólnej płaszczyzny)
  const plate = mesh(cyl(0.03, 0.03, 0.012), dark); plate.position.y = hc + 0.006; g.add(plate);
  // głowica: obrót (pan, oś y) i pochylenie (tilt, oś x); pokrętło blokady
  const pan = new THREE.Group(); pan.position.y = hc + 0.012; g.add(pan);
  const yoke = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), dark); yoke.position.y = 0.025; pan.add(yoke);
  const knob = mesh(cyl(0.008, 0.008, 0.02).rotateZ(Math.PI / 2), black); knob.position.set(0.035, 0.04, 0); pan.add(knob);
  const tilt = new THREE.Group(); tilt.position.y = 0.07; pan.add(tilt);
  // obudowa 70 × 65 × 120 mm, obiektyw wystaje z czoła pod daszkiem, dławik z kablem z tyłu
  const body = mesh(new THREE.BoxGeometry(0.07, 0.065, 0.12), new THREE.MeshPhysicalMaterial({ color: 0xe6e7e4, roughness: 0.35, metalness: 0.1, clearcoat: 0.6 })); tilt.add(body);
  const lensL = 0.02 + f * 2, zf = 0.06 + lensL;   // czoło obiektywu
  const shade = mesh(new THREE.BoxGeometry(0.084, 0.003, 0.12 + lensL + 0.01), body.material); shade.position.set(0, 0.0345, (lensL + 0.01) / 2); tilt.add(shade);
  const lensB = mesh(cyl(0.015, 0.016, lensL).rotateX(Math.PI / 2), black); lensB.position.z = 0.06 + lensL / 2; tilt.add(lensB);
  const ring = mesh(cyl(0.0172, 0.0172, 0.006).rotateX(Math.PI / 2), M.alu); ring.position.z = 0.06 + lensL * 0.45; tilt.add(ring);   // pierścień ostrości (radełko)
  const elem = mesh(new THREE.CircleGeometry(0.0105, 24), new THREE.MeshPhysicalMaterial({ color: 0x1a2a3a, roughness: 0.02, metalness: 0.3, iridescence: 0.8, clearcoat: 1 })); elem.position.z = zf + 0.0003; tilt.add(elem);
  const gland = mesh(cyl(0.008, 0.009, 0.016).rotateX(Math.PI / 2), black); gland.position.z = -0.068; tilt.add(gland);
  const cablePts = [new THREE.Vector3(0, 0, -0.075), new THREE.Vector3(0, -0.02, -0.12), new THREE.Vector3(0.02, -0.12, -0.1), new THREE.Vector3(0.03, -0.3, -0.04)];
  const cable = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 24, 0.0035, 8), black); tilt.add(cable);
  const ledM = glow(0x30ff60), led = mesh(new THREE.SphereGeometry(0.002, 8, 6).scale(1, 1, 0.5), ledM); led.position.set(0.026, 0.024, 0.0605); tilt.add(led);
  const fovV = 2 * Math.atan(SENSOR.h / 2 / f) * 180 / Math.PI, fovH = 2 * Math.atan(SENSOR.w / 2 / f) * 180 / Math.PI;
  const pupil = new THREE.Vector3(0, 0, zf + 0.001), fwd = new THREE.Vector3(0, 0, 1);
  g.userData = { f, H, fovV, fovH, aspect: SENSOR.w / SENSOR.h, sensor: SENSOR, mass: 2.4 + 1.6, pan, tilt, hidden: [],
    lens: () => tilt.localToWorld(pupil.clone()), dir: () => fwd.clone().transformDirection(tilt.matrixWorld).normalize(),
    aim: (P) => { g.updateWorldMatrix(true, false); const L = g.worldToLocal(P.clone()).sub(new THREE.Vector3(0, pan.position.y + tilt.position.y, 0)); pan.rotation.y = Math.atan2(L.x, L.z); tilt.rotation.x = -Math.atan2(L.y, Math.hypot(L.x, L.z)); },
    setOn: (on) => { ledM.emissiveIntensity = on ? 2.5 : 0; },
    ports: { video: port(EN ? 'Video out (Ethernet / PoE)' : 'Wyjście obrazu (Ethernet / PoE)', DOMAIN.sig, EN ? 'RJ45' : 'RJ45'), mount: port(EN ? 'Tripod head 1/4"' : 'Głowica statywu 1/4"', DOMAIN.rot, EN ? 'screw' : 'śruba') } };
  return g;
}
