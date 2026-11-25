// MechKit — sterowanie: wyłączniki, potencjometr, przycisk, falownik z pokrętłem. Elementy obsługiwane na modelu:
// części do kliknięcia albo przeciągnięcia mają userData.control = nazwa; model zwraca stan i metody:
//   press(nazwa) / release(nazwa) / drag(nazwa, dy) — dy: przesunięcie myszy w pikselach (w górę ujemne), tick(dt) — animacje
// Przód obudowy patrzy w +z, montaż na płycie y = 0. Wymiary prawdziwe (otwór 22,5 mm na przyciski i lampki itd.).
import * as THREE from '../../../vendor/three/three.module.js';
import { materials } from './mechkit.js';

const TAU = Math.PI * 2;
const mesh = (g, m, shadow = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; return o; };
const plastic = (color, rough = 0.45) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
let P = null;
export function plastics() {
  if (P) return P;
  P = {
    grey: plastic(0xd4d4cc, 0.55),      // RAL 7035 — obudowy
    dark: plastic(0x2a2c2f, 0.5), black: plastic(0x141516, 0.35),
    red: plastic(0xc8221c, 0.35), green: plastic(0x1f8a3a, 0.35), yellow: plastic(0xe8c21c, 0.4), blue: plastic(0x1f56b0, 0.35), white: plastic(0xeeeeea, 0.4),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.15, metalness: 1 }),
  };
  return P;
}
export const BUTTON_COLORS = { green: 'zielony (start)', red: 'czerwony (stop)', yellow: 'żółty', blue: 'niebieski (reset)', black: 'czarny', white: 'biały' };
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { t, c }; };

/* ---------------- obudowa natynkowa ---------------- */
// puszka z tworzywa: korpus, pokrywa z zaokrąglonym obrzeżem, 4 wkręty; front w +z, środek frontu w (0, h/2, d)
export function enclosure({ w = 0.08, h = 0.08, d = 0.06, mat = 'grey' } = {}) {
  const Pm = plastics(), M = materials(), g = new THREE.Group(); g.name = 'Obudowa natynkowa IP65';
  const body = mesh(new THREE.BoxGeometry(w, h, d - 0.006), Pm[mat]); body.position.set(0, h / 2, (d - 0.006) / 2); g.add(body);
  const lid = mesh(new THREE.BoxGeometry(w - 0.002, h - 0.002, 0.006), Pm[mat]); lid.position.set(0, h / 2, d - 0.003); g.add(lid);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const s = mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.0012, 16).rotateX(Math.PI / 2), M.steel); s.position.set(sx * (w / 2 - 0.007), h / 2 + sy * (h / 2 - 0.007), d + 0.0005); g.add(s);
  }
  for (const sx of [-1, 1]) { const foot = mesh(new THREE.BoxGeometry(0.012, 0.004, d * 0.6), Pm[mat]); foot.position.set(sx * (w / 2 + 0.005), 0.002, d * 0.4); g.add(foot); }
  g.userData.front = new THREE.Vector3(0, h / 2, d);
  return g;
}

/* ---------------- wyłącznik ---------------- */
// kind: 'lever' — dźwigniowy (tulejka M12 z nakrętką, dźwignia 20°), 'cam' — krzywkowy obrotowy 0–I (pokrętło, tabliczka),
// 'main' — główny (czerwona rączka na żółtej tabliczce, 0 / I, z kłódką)
export function switchUnit({ kind = 'cam', poles = 3, amps = 16 } = {}) {
  const Pm = plastics(), M = materials(), g = new THREE.Group(), main = kind === 'main';
  const box = enclosure({ w: main ? 0.1 : 0.08, h: main ? 0.12 : 0.08, d: 0.07, mat: 'grey' }); g.add(box);
  const f = box.userData.front, pivot = new THREE.Group(); pivot.position.copy(f); g.add(pivot);
  let on = false, ang = 0;
  const target = () => (kind === 'lever' ? (on ? -0.4 : 0.4) : (on ? -Math.PI / 2 : 0));
  if (kind === 'lever') {
    // tulejka wchodzi 2 mm w pokrywę, nakrętka 0,2 mm nad pokrywą — bez wspólnych płaszczyzn
    const bush = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.014, 24).rotateX(Math.PI / 2), M.steel); bush.position.set(0, 0, 0.005); pivot.add(bush);
    const nut = mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.003, 6).rotateX(Math.PI / 2), M.steel); nut.position.set(0, 0, 0.0017); pivot.add(nut);
    const arm = new THREE.Group(); arm.position.z = 0.011; pivot.add(arm);
    const lever = mesh(new THREE.CylinderGeometry(0.0022, 0.0032, 0.022, 16), Pm.chrome); lever.position.y = 0.011; arm.add(lever);
    const tip = mesh(new THREE.SphereGeometry(0.0034, 16, 12), M.steel); tip.position.y = 0.022; arm.add(tip);
    for (const o of [lever, tip]) o.userData.control = 'toggle';
    const plate = canvasTex(128, 192, (c, w, h) => { c.fillStyle = '#e6e6e0'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.font = 'bold 44px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('I', 64, 30); c.fillText('O', 64, 164); });
    const pl = mesh(new THREE.PlaneGeometry(0.032, 0.048), new THREE.MeshStandardMaterial({ map: plate.t, roughness: 0.6 })); pl.position.z = 0.0002; pivot.add(pl);   // I u góry, O u dołu — nad i pod dźwignią
    g.userData.anim = (a) => { arm.rotation.x = a; };
  } else {
    const pc = main ? '#e8c21c' : '#e6e6e0';
    const plate = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = pc; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.font = 'bold 44px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('0', 128, 34); c.fillText('I', 222, 128);   // 0 u góry, I w prawo (obrót o 90° w prawo)
      if (main) { c.font = 'bold 18px sans-serif'; c.fillText('WYŁĄCZNIK GŁÓWNY', 128, 228); }
    });
    const s = main ? 0.064 : 0.048;
    const pl = mesh(new THREE.BoxGeometry(s, s, 0.0015), [Pm.grey, Pm.grey, Pm.grey, Pm.grey, new THREE.MeshStandardMaterial({ map: plate.t, roughness: 0.5 }), Pm.grey]); pl.position.z = 0.00075; pivot.add(pl);
    const knob = new THREE.Group(); knob.position.z = 0.0015; pivot.add(knob);
    const base = mesh(new THREE.CylinderGeometry(main ? 0.017 : 0.013, main ? 0.019 : 0.015, 0.008, 32).rotateX(Math.PI / 2), main ? Pm.red : Pm.black); base.position.z = 0.004; knob.add(base);
    const handle = mesh(new THREE.BoxGeometry(main ? 0.012 : 0.008, main ? 0.05 : 0.034, main ? 0.016 : 0.012), main ? Pm.red : Pm.black); handle.position.z = main ? 0.016 : 0.013; knob.add(handle);
    const mark = mesh(new THREE.BoxGeometry(0.0018, 0.008, 0.0008), Pm.white); mark.position.set(0, (main ? 0.05 : 0.034) / 2 - 0.006, (main ? 0.024 : 0.019) + 0.0004); knob.add(mark);
    for (const o of [base, handle, mark]) o.userData.control = 'toggle';
    g.userData.anim = (a) => { knob.rotation.z = a; };
  }
  g.userData.anim(target()); ang = target();
  const api = {
    get on() { return on; },
    press(c) { if (c === 'toggle') on = !on; }, release() {}, drag() {},
    tick(dt) { const t = target(); ang += (t - ang) * Math.min(1, dt * 18); g.userData.anim(ang); },
  };
  Object.assign(g.userData, { kind, poles, amps, mass: main ? 0.62 : 0.35, api });
  return g;
}

/* ---------------- potencjometr ---------------- */
// panelowy z pokrętłem Ø 25 mm, skala 0–10 na 270°; taper: 'lin' (B) albo 'log' (A, 10 % przy połowie obrotu)
export function potentiometer({ ohms = 10000, taper = 'lin', knob = 'black' } = {}) {
  const Pm = plastics(), M = materials(), g = new THREE.Group();
  const box = enclosure({ w: 0.08, h: 0.08, d: 0.06 }); g.add(box);
  const f = box.userData.front, pivot = new THREE.Group(); pivot.position.copy(f); g.add(pivot);
  const scale = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#e6e6e0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#111'; c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 20px sans-serif';
    for (let k = 0; k <= 50; k++) {   // 270°: od −135° (lewy dół) do +135° (prawy dół), 0 u góry
      const a = (-135 + 270 * k / 50) * Math.PI / 180, r0 = k % 5 ? 98 : 90; c.lineWidth = k % 5 ? 2 : 4;
      c.beginPath(); c.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0); c.lineTo(128 + Math.sin(a) * 108, 128 - Math.cos(a) * 108); c.stroke();
      if (k % 5 === 0) c.fillText(String(k / 5), 128 + Math.sin(a) * 72, 128 - Math.cos(a) * 72);
    }
  });
  const pl = mesh(new THREE.CircleGeometry(0.03, 48), new THREE.MeshStandardMaterial({ map: scale.t, roughness: 0.5 })); pl.position.z = 0.0003; pivot.add(pl);
  const nut = mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.0025, 6).rotateX(Math.PI / 2), M.steel); nut.position.z = 0.0016; pivot.add(nut);
  const kn = new THREE.Group(); kn.position.z = 0.003; pivot.add(kn);
  const body = mesh(new THREE.CylinderGeometry(0.0115, 0.0125, 0.016, 40).rotateX(Math.PI / 2), Pm[knob] || Pm.black); body.position.z = 0.008; kn.add(body);
  const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0012, 0.0012, 0.014), Pm[knob] || Pm.black, 24);
  const m4 = new THREE.Matrix4(); for (let k = 0; k < 24; k++) { const a = k * TAU / 24; m4.makeRotationZ(a).setPosition(Math.sin(a) * 0.0122, Math.cos(a) * 0.0122, 0.008); ribs.setMatrixAt(k, m4); } kn.add(ribs);
  const cap = mesh(new THREE.CylinderGeometry(0.009, 0.0105, 0.002, 40).rotateX(Math.PI / 2), M.alu); cap.position.z = 0.0168; kn.add(cap);
  const line = mesh(new THREE.BoxGeometry(0.0016, 0.0085, 0.0006), Pm.white); line.position.set(0, 0.0045, 0.0181); kn.add(line);
  for (const o of [body, cap, line]) o.userData.control = 'knob';
  let pos = 0.5;   // położenie 0…1
  const apply = () => { kn.rotation.z = -(-135 + 270 * pos) * Math.PI / 180; };
  apply();
  const ratio = () => (taper === 'log' ? (Math.pow(10, 2 * pos) - 1) / 99 : pos);   // log: ok. 10 % przy połowie (krzywa A)
  const api = { get pos() { return pos; }, set pos(v) { pos = Math.max(0, Math.min(1, v)); apply(); }, ratio, press() {}, release() {}, drag(c, dy) { if (c === 'knob') { pos = Math.max(0, Math.min(1, pos - dy / 300)); apply(); } }, tick() {} };
  Object.assign(g.userData, { ohms, taper, mass: 0.22, api });
  return g;
}

/* ---------------- przycisk 22 mm ---------------- */
// chwilowy albo z podtrzymaniem, styk NO (zwierny) albo NC (rozwierny), podświetlenie; obudowa jednootworowa
export function pushButton({ color = 'green', mode = 'momentary', contact = 'NO', lit = false, mushroom = false } = {}) {
  const Pm = plastics(), M = materials(), g = new THREE.Group();
  const box = enclosure({ w: 0.07, h: 0.07, d: 0.065, mat: 'grey' }); g.add(box);
  const f = box.userData.front, pivot = new THREE.Group(); pivot.position.copy(f); g.add(pivot);
  const bezel = mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.006, 40).rotateX(Math.PI / 2), Pm.chrome); bezel.position.z = 0.003; pivot.add(bezel);
  const ring = mesh(new THREE.TorusGeometry(0.0145, 0.0012, 10, 40), Pm.chrome); ring.position.z = 0.006; pivot.add(ring);
  const capMat = (Pm[color] || Pm.green).clone();
  if (lit) { capMat.transparent = true; capMat.opacity = 0.92; capMat.emissive = capMat.color.clone(); capMat.emissiveIntensity = 0; }
  const cap = new THREE.Group(); pivot.add(cap);
  const head = mushroom ? mesh(new THREE.SphereGeometry(0.02, 32, 16, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.45), capMat) : mesh(new THREE.CylinderGeometry(0.0118, 0.0118, 0.006, 40).rotateX(Math.PI / 2), capMat);
  head.position.z = mushroom ? 0.008 : 0.008; cap.add(head);
  if (mushroom) { const stem = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 32).rotateX(Math.PI / 2), capMat); stem.position.z = 0.006; cap.add(stem); }
  head.userData.control = 'button';
  // blok styków za płytą (widać przy przezroczystej obudowie — tu w środku puszki)
  const blk = mesh(new THREE.BoxGeometry(0.03, 0.032, 0.03), Pm.dark); blk.position.set(f.x, f.y, f.z - 0.026); g.add(blk);
  let down = false, latched = false, depth = 0;
  const pressedNow = () => (mode === 'latch' ? latched : down);
  const closed = () => (contact === 'NO' ? pressedNow() : !pressedNow());
  const api = {
    get pressed() { return pressedNow(); }, get closed() { return closed(); },
    press(c) { if (c !== 'button') return; down = true; if (mode === 'latch') latched = !latched; },
    release() { down = false; }, drag() {},
    tick(dt) { const t = down ? 0.0035 : mode === 'latch' && latched ? 0.002 : 0; depth += (t - depth) * Math.min(1, dt * 30); cap.position.z = -depth; if (lit) capMat.emissiveIntensity = closed() ? 1.6 : 0; },
  };
  Object.assign(g.userData, { color, mode, contact, lit, mass: 0.12, api });
  return g;
}

/* ---------------- falownik z panelem ---------------- */
// przemiennik częstotliwości: radiator, panel z wyświetlaczem (Hz), pokrętło zadawania, RUN / STOP; częstotliwość
// narasta i opada po rampie (czas od 0 do fmax)
export function inverter({ kW = 1.1, fmax = 50, ramp = 5 } = {}) {
  const Pm = plastics(), M = materials(), g = new THREE.Group(), k = Math.cbrt(Math.max(0.37, kW) / 1.1);
  const W = 0.1 * k, H = 0.17 * k, D = 0.13 * k;
  const sink = mesh(new THREE.BoxGeometry(W, H, 0.02), M.alu); sink.position.set(0, H / 2, 0.01); g.add(sink);
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.002, H * 0.96, 0.03), M.alu, 9); fins.castShadow = true;
  const m4 = new THREE.Matrix4(); for (let i = 0; i < 9; i++) { m4.makeTranslation(-W / 2 + W * (i + 0.5) / 9, H / 2, -0.015); fins.setMatrixAt(i, m4); } g.add(fins);
  const body = mesh(new THREE.BoxGeometry(W * 0.98, H * 0.98, D - 0.02), Pm.dark); body.position.set(0, H / 2, 0.02 + (D - 0.02) / 2); g.add(body);
  const fz = D + 0.0005, panel = new THREE.Group(); panel.position.set(0, H * 0.66, fz); g.add(panel);
  const pw = W * 0.8, ph = H * 0.36;
  const face = mesh(new THREE.BoxGeometry(pw, ph, 0.002), Pm.black); face.position.z = 0.001; panel.add(face);
  const disp = canvasTex(256, 96, () => {});
  const dm = new THREE.MeshStandardMaterial({ map: disp.t, emissive: 0xffffff, emissiveMap: disp.t, emissiveIntensity: 0.9, roughness: 0.3 });
  const screen = mesh(new THREE.PlaneGeometry(pw * 0.78, pw * 0.78 * 96 / 256), dm); screen.position.set(0, ph * 0.26, 0.0022); panel.add(screen);
  const btn = (col, x, label) => {
    const b = mesh(new THREE.CylinderGeometry(0.0055 * k + 0.002, 0.0055 * k + 0.002, 0.003, 24).rotateX(Math.PI / 2), Pm[col]); b.position.set(x, -ph * 0.28, 0.0035); b.userData.control = label; panel.add(b); return b;
  };
  const bRun = btn('green', -pw * 0.3, 'run'), bStop = btn('red', pw * 0.3, 'stop');
  const kn = new THREE.Group(); kn.position.set(0, -ph * 0.22, 0.002); panel.add(kn);
  const kb = mesh(new THREE.CylinderGeometry(0.009 * k + 0.002, 0.0095 * k + 0.002, 0.008, 32).rotateX(Math.PI / 2), Pm.dark); kb.position.z = 0.004; kn.add(kb);
  const kl = mesh(new THREE.BoxGeometry(0.0014, 0.006 * k + 0.002, 0.0006), Pm.white); kl.position.set(0, 0.004 * k + 0.001, 0.0083); kn.add(kl);
  for (const o of [kb, kl]) o.userData.control = 'knob';
  const label = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#16181a'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8cccf'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText(`${String(kW).replace('.', ',')} kW  3 × 400 V`, w / 2, 40); });
  const lab = mesh(new THREE.PlaneGeometry(W * 0.7, W * 0.7 / 4), new THREE.MeshStandardMaterial({ map: label.t, roughness: 0.6 })); lab.position.set(0, H * 0.2, fz + 0.0005); g.add(lab);
  const term = mesh(new THREE.BoxGeometry(W * 0.9, H * 0.12, 0.006), Pm.dark); term.position.set(0, H * 0.07, fz); g.add(term);
  let set = 0.6, f = 0, run = false;
  const draw = () => {
    const c = disp.c.getContext('2d'); c.fillStyle = '#0b1a10'; c.fillRect(0, 0, 256, 96);
    c.fillStyle = run ? '#5dff8a' : '#2f8a4a'; c.font = 'bold 60px monospace'; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText(f.toFixed(1), 196, 50); c.font = 'bold 26px monospace'; c.fillText('Hz', 248, 62);
    c.font = '18px monospace'; c.textAlign = 'left'; c.fillText(run ? 'RUN' : 'STOP', 8, 20);
    disp.t.needsUpdate = true;
  };
  const apply = () => { kn.rotation.z = -(-135 + 270 * set) * Math.PI / 180; };
  apply(); draw();
  let last = '';
  const api = {
    get f() { return f; }, get set() { return set * fmax; }, get run() { return run; },
    press(c) { if (c === 'run') run = true; if (c === 'stop') run = false; if (c === 'run' || c === 'stop') { const b = c === 'run' ? bRun : bStop; b.position.z = 0.002; setTimeout(() => { b.position.z = 0.0035; }, 160); } },
    release() {}, drag(c, dy) { if (c === 'knob') { set = Math.max(0, Math.min(1, set - dy / 300)); apply(); } },
    tick(dt) {
      const target = run ? set * fmax : 0, step = fmax / Math.max(0.1, ramp) * dt;
      f = Math.abs(target - f) <= step ? target : f + Math.sign(target - f) * step;
      const s = f.toFixed(1) + run; if (s !== last) { last = s; draw(); }
    },
  };
  Object.assign(g.userData, { kW, fmax, ramp, mass: 1.4 * k * k * k, api });
  return g;
}

export const ControlKit = { enclosure, switchUnit, potentiometer, pushButton, inverter, plastics, BUTTON_COLORS };
