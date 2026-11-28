// VideoKit — monitor LCD 24" (16 : 9, obszar aktywny 531 × 299 mm) na stojaku podłogowym albo na nóżce biurkowej. Ekran:
// błyszcząca powłoka (odbicia) i obraz jako świecenie (emissiveMap) — obraz z kamery (tekstura celu renderowania), plansza
// „Brak sygnału”, kiedy nie ma wejścia, czarny, kiedy wyłączony. Przycisk zasilania pod ramką z diodą (control 'power').
// userData: setImage(tekstura | null), screen (siatka — chowana przy renderowaniu kamery, żeby obraz nie wpadał sam w siebie),
// api { on, press('power') }, W, H (obszar aktywny), center() — środek ekranu (świat).
import * as THREE from '../../../../vendor/three/three.module.js';
import { DOMAIN, materials } from '../mechkit.js';
import { EN, mesh, port, plastic, glow, canvasTex } from '../common.js';

export function monitor({ stand = 'floor', Hc = 1.25, name } = {}) {
  const M = materials(), g = new THREE.Group(), W = 0.531, H = 0.299, b = 0.008, D = 0.022, black = plastic(0x141517, 0.55);
  g.name = name || (EN ? 'LCD monitor 24"' : 'Monitor LCD 24"');
  const yc = stand === 'floor' ? Hc : 0.12 + 0.05 + H / 2 + b;   // środek ekranu nad podłogą / blatem
  const head = new THREE.Group(); head.position.y = yc; g.add(head);
  const frame = mesh(new THREE.BoxGeometry(W + 2 * b, H + 2 * b + 0.012, D), black); frame.position.set(0, -0.006, -D / 2); head.add(frame);
  const back = mesh(new THREE.BoxGeometry(W * 0.7, H * 0.7, 0.03), black); back.position.z = -D - 0.015; head.add(back);
  const vesa = mesh(new THREE.BoxGeometry(0.12, 0.12, 0.006), M.steel); vesa.position.z = -D - 0.033; head.add(vesa);
  const noSig = canvasTex(512, 288, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = '#1d3f8a'; c.fillRect(w * 0.25, h * 0.4, w * 0.5, h * 0.2); c.fillStyle = '#dfe6f2'; c.font = '26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(EN ? 'No signal' : 'Brak sygnału', w / 2, h / 2); });
  const scrM = new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: null });
  const screen = mesh(new THREE.PlaneGeometry(W, H), scrM, false); screen.position.z = 0.0002; head.add(screen);
  const logo = mesh(new THREE.BoxGeometry(0.03, 0.004, 0.001), M.alu); logo.position.set(0, -H / 2 - b - 0.0, 0.0006); head.add(logo);
  const btn = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.004, 16), black); btn.position.set(W / 2 - 0.02, -H / 2 - b - 0.012, -0.008); head.add(btn);
  const ledM = glow(0xffffff), led = mesh(new THREE.SphereGeometry(0.0016, 8, 6), ledM); led.position.set(W / 2 - 0.034, -H / 2 - b - 0.004, 0.0005); head.add(led);
  [btn, frame].forEach((o) => { o.userData.control = 'power'; });
  // stojak: podłogowy — kolumna Ø 50 mm na płycie z ciężarkiem; biurkowy — nóżka z podstawą
  if (stand === 'floor') {
    const base = mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.02, 48), new THREE.MeshPhysicalMaterial({ color: 0x1c1d20, roughness: 0.35, metalness: 0.7 })); base.position.y = 0.01; g.add(base);
    const pole = mesh(new THREE.CylinderGeometry(0.025, 0.025, yc - 0.02, 32), M.alu); pole.position.set(0, 0.02 + (yc - 0.02) / 2 - 0.0, -D - 0.06); g.add(pole);
    const arm = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), black); arm.position.set(0, yc, -D - 0.051);   // za płytą VESA (bez wspólnej płaszczyzny) g.add(arm);
  } else {
    const foot = mesh(new THREE.BoxGeometry(0.24, 0.012, 0.18), black); foot.position.set(0, 0.006, -0.05); g.add(foot);
    const neck = mesh(new THREE.BoxGeometry(0.06, yc - 0.012, 0.025), black); neck.position.set(0, 0.012 + (yc - 0.012) / 2, -D - 0.045); g.add(neck);
  }
  let on = true, img = null;
  const apply = () => { scrM.emissiveMap = on ? (img || noSig.t) : null; scrM.emissiveIntensity = on ? 1 : 0; ledM.emissive.set(on ? 0xffffff : 0xff8a20); ledM.emissiveIntensity = on ? 1.2 : 0.6; scrM.needsUpdate = true; };
  apply();
  const api = { get on() { return on; }, press(c) { if (c === 'power') { on = !on; apply(); } }, release() {}, drag() {}, tick() {} };
  g.userData = { W, H, yc, stand, screen, api, mass: stand === 'floor' ? 4.6 + 14 : 4.6 + 1.8, hidden: [screen],
    setImage: (t) => { if (t !== img) { img = t; apply(); } }, center: () => head.localToWorld(new THREE.Vector3()),
    ports: { video: port(EN ? 'Video input (HDMI / Ethernet)' : 'Wejście obrazu (HDMI / Ethernet)', DOMAIN.sig, 'HDMI'), power: port(EN ? 'Supply 230 V' : 'Zasilanie 230 V', DOMAIN.el, 'IEC C13') } };
  return g;
}
