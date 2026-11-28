// Laboratorium mechaniki — kamera i monitor przy zegarze (tryby Maszyna i Fizyka): kamera przemysłowa na statywie
// przed zegarem, wycelowana w środek tarczy, obraz na żywo (render/video/feed.js, 25 kl./s) na monitorze 24" na stojaku
// obok. Fizyka: przycisk zasilania monitora (klik w ramkę albo przycisk), wyłączony — ekran czarny.
// createVideoStation({ root, renderer, scene, S, fmt, dial }) → { parts, devices, step(dt), rows(R), state }
import * as THREE from '../../../vendor/three/three.module.js';
import * as VK from '../../models/mech/video/index.js';
import { createFeed } from '../../render/video/feed.js';
import { T } from './lang.js';

export function createVideoStation({ root, renderer, scene, S, fmt, dial }) {
  // kamera z boku przed zegarem — nie zasłania widoku „Zegar”
  const cam = VK.camera({ f: 0.012, H: 1.45 }); cam.position.set(5.2, 0, 1.2); root.add(cam);
  const mon = VK.monitor({ stand: 'floor', Hc: 1.2 }); mon.position.set(5.85, 0, 0.35); mon.rotation.y = -0.75; root.add(mon);
  root.updateMatrixWorld(true); cam.userData.aim(dial()); cam.userData.setOn(true);
  const feed = createFeed({ renderer, scene, w: 640, h: 360, fps: 25 }); mon.userData.setImage(feed.texture);
  const st = { frames: 0, dist: 0 };
  function step(dt) {
    if (S.mode === 'items' || S.mode === 'workshop') return;
    if (mon.userData.api.on && feed.update(dt, cam, [mon.userData.screen, ...cam.userData.hidden])) st.frames++;
    st.dist = cam.userData.lens().distanceTo(dial());
  }
  const u = cam.userData, w = st;
  function rows(R) {
    R.push([T('Kamera i monitor', 'Camera and monitor'), T(`kamera f = ${Math.round(u.f * 1000)} mm (kąt ${fmt(u.fovH, 1)}° × ${fmt(u.fovV, 1)}°), ${fmt(w.dist, 2)} m od tarczy zegara · monitor ${mon.userData.api.on ? 'włączony — obraz 640 × 360, 25 kl./s' : 'wyłączony'}${S.mode === 'physics' ? ' — klik w monitor: zasilanie' : ''}`, `camera f = ${Math.round(u.f * 1000)} mm (view ${fmt(u.fovH, 1)}° × ${fmt(u.fovV, 1)}°), ${fmt(w.dist, 2)} m from the clock dial · monitor ${mon.userData.api.on ? 'on — 640 × 360 image, 25 fps' : 'off'}${S.mode === 'physics' ? ' — click the monitor: power' : ''}`)]);
  }
  const el0 = (key, id, name, group, props, ports) => ({ key, id, name, group, props, ports: ports.map(([pid, pn, kind]) => ({ id: pid, name: pn, kind })), theta: 0, omega: 0, T: 0, eta: 1, r: 0, dof: 'rot', clock: true });
  const list = [
    el0('cam', 'VID-camera', 'Kamera przemysłowa na statywie', cam, [['Przetwornik', VK.SENSOR.name], ['Obiektyw', `f = ${Math.round(u.f * 1000)} mm`], ['Kąt widzenia', `${fmt(u.fovH, 1)}° × ${fmt(u.fovV, 1)}°`], ['Wycelowana', 'środek tarczy zegara']], [['video', 'Obraz → monitor', 'sygnał']]),
    el0('mon', 'VID-monitor', 'Monitor LCD 24" na stojaku', mon, [['Obszar aktywny', '531 × 299 mm (16 : 9)'], ['Obraz', 'z kamery, 640 × 360, 25 kl./s']], [['video', 'Obraz z kamery', 'sygnał'], ['power', 'Zasilanie 230 V', 'prąd']]),
  ];
  for (const e of list) e.group.userData.el = e;
  return { parts: list, devices: [{ group: mon, api: mon.userData.api }], step, rows, state: st, camera: cam, monitor: mon, feed };
}
