// Grunt: trawa z tekstur rysowanych kodem (bez plików) — kolor z plamami suchej i bujnej trawy, źdźbła, mapa normalnych
// z tej samej wysokości. grassMaterial({ tile }) → MeshStandardMaterial (kolory wierzchołków mnożą barwę: pola, droga)
import * as THREE from '../../vendor/three/three.module.js';

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
let cached = null;
export function grassMaterial({ tile = 3 } = {}) {
  if (cached) return cached;
  const N = 512, r = rng(7);
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#56653a'; g.fillRect(0, 0, N, N);
  // plamy (zawinięte na brzegach kafelka)
  const blob = (x, y, rad, col) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2); } };
  for (let i = 0; i < 60; i++) blob(r() * N, r() * N, 30 + r() * 90, ['rgba(120,128,60,0.35)', 'rgba(60,82,40,0.4)', 'rgba(110,96,60,0.25)', 'rgba(70,96,46,0.35)'][i % 4]);
  // źdźbła
  const h = document.createElement('canvas'); h.width = h.height = N; const hg = h.getContext('2d'); hg.fillStyle = '#808080'; hg.fillRect(0, 0, N, N);
  for (let i = 0; i < 9000; i++) {
    const x = r() * N, y = r() * N, L = 3 + r() * 9, a = -Math.PI / 2 + (r() - 0.5) * 1.2, l = 25 + r() * 30;
    g.strokeStyle = `hsla(${70 + r() * 30},${30 + r() * 25}%,${l}%,0.7)`; g.lineWidth = 1 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    hg.strokeStyle = `rgba(255,255,255,${0.3 + r() * 0.4})`; hg.lineWidth = 1.2; hg.beginPath(); hg.moveTo(x, y); hg.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); hg.stroke();
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(h);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  cached = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.95, metalness: 0, vertexColors: true });
  cached.userData.tile = tile;
  return cached;
}
// płaski kawałek gruntu (laboratorium): krąg o promieniu R z UV w metrach / tile
export function groundDisc(R = 120, tile = 3) {
  const geo = new THREE.CircleGeometry(R, 96).rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv, col = new Float32Array(p.count * 3).fill(1);
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / tile, p.getZ(i) / tile);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, grassMaterial({ tile })); m.receiveShadow = true;
  return m;
}
