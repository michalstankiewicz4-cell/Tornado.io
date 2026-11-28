// Obraz z kamery na monitor: kamera wirtualna w źrenicy obiektywu modelu kamery (VideoKit: lens(), dir(), fovV, aspect)
// renderuje scenę do tekstury (half float, kolor liniowy — ton i jasność nadaje dopiero obraz końcowy, jak świecący ekran).
// Klatka co 1/fps (domyślnie 25 kl./s, jak kamera przemysłowa PAL); na czas renderu chowane są ekrany monitorów
// (userData.hidden), żeby tekstura nie była jednocześnie celem i źródłem. createFeed({ renderer, scene, w, h, fps }) →
// { texture, update(dt, cam, hide), render(cam, hide), dispose() }
import * as THREE from '../../../vendor/three/three.module.js';

export function createFeed({ renderer, scene, w = 640, h = 360, fps = 25 } = {}) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace; rt.texture.generateMipmaps = false; rt.texture.minFilter = THREE.LinearFilter;
  const vcam = new THREE.PerspectiveCamera(40, w / h, 0.03, 80), look = new THREE.Vector3();
  let acc = 1;
  function render(cam, hide = []) {
    const u = cam.userData; cam.updateWorldMatrix(true, true);
    vcam.fov = u.fovV; vcam.aspect = w / h; vcam.updateProjectionMatrix();
    vcam.position.copy(u.lens()); vcam.lookAt(look.copy(vcam.position).add(u.dir()));
    const vis = hide.map((o) => o.visible); hide.forEach((o) => { o.visible = false; });
    const prev = renderer.getRenderTarget(), tm = renderer.toneMapping, xr = renderer.xr.enabled;
    renderer.xr.enabled = false; renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, vcam); renderer.setRenderTarget(prev); renderer.toneMapping = tm; renderer.xr.enabled = xr;
    hide.forEach((o, i) => { o.visible = vis[i]; });
  }
  function update(dt, cam, hide) { acc += dt; if (acc < 1 / fps) return false; acc = 0; render(cam, hide); return true; }
  return { texture: rt.texture, vcam, update, render, dispose: () => rt.dispose() };
}
