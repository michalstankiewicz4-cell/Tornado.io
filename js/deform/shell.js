// DeformKit — powłoka z cienkiej blachy, która się trwale gniecie (beczka, puszka, karoseria).
// Dwie siatki: rzadka siatka fizyczna (cząstki = wierzchołki zgrzane po położeniu) i szczegółowe siatki do rysowania
// osadzone w niej (każdy wierzchołek zna najbliższy trójkąt siatki fizycznej: współrzędne barycentryczne i odsunięcie
// wzdłuż normalnej — obręcze, rąbki, korki jadą za blachą). Rzadka siatka i dużo iteracji: metoda PBD zbiega się
// szybko, blacha jest sztywna i składa się w fałdy zamiast płynąć jak plastelina.
//   więzy długości     krawędzie trójkątów — blacha prawie się nie rozciąga
//   więzy zginania     pary naprzeciw wspólnej krawędzi i cięciwy przez wierzchołek (sąsiedzi prawie w linii)
//   plastyczność       gdy odkształcenie przekroczy granicę, długość spoczynkowa idzie za kształtem — zgięcie zostaje;
//                      włącza ją dociśnięcie prostopadłościanem z `plastic` (prasa), nie sam ciężar
//   zderzenia          grunt i prostopadłościany (prasa ruchoma, podpory nieruchome) z tarciem
//
// createShell(simGeometries, opts) → shell
//   simGeometries: [BufferGeometry] w układzie świata (siatka fizyczna)
//   opts: { mass, stretch, bend, yieldStretch, yieldBend, weld, substeps, iterations, friction, radius, gravity }
//   shell.embed(object3d)             siatki obiektu (w układzie świata) jadą za blachą; zwraca obiekt
//   shell.step(dt, { ground, boxes }) krok; box z makeBox(half, matrix, friction), box.set(matrix) co klatkę
//   shell.wake(), shell.awake, shell.bounds() → [ymin, ymax], shell.box() → [xmin, ymin, zmin, xmax, ymax, zmax],
//   shell.stats() → { particles, constraints, crush }
//   step(dt, { …, others: [shell.particles innych powłok], yield, pin }) — zderzenia między powłokami (js/deform/shell-core.js)
//   opts.worker: true — obliczenia w osobnym wątku (js/deform/shell-worker.js, rdzeń js/deform/shell-core.js): krok
//     wraca w następnej klatce, wiele powłok liczy się równolegle; shell.settled() → Promise (po wysłanych krokach)
import * as THREE from '../../vendor/three/three.module.js';
import { buildShell, stepShell } from './shell-core.js';

export function makeBox(half, matrix = new THREE.Matrix4(), friction = 0.6) {
  const b = { half, friction, plastic: false, matrix: matrix.clone(), inv: matrix.clone().invert(), prevInv: matrix.clone().invert(), aabb: new THREE.Box3() };
  const upd = () => { b.aabb.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(half[0] * 2, half[1] * 2, half[2] * 2)).applyMatrix4(b.matrix); };
  b.set = (m) => { b.prevInv.copy(b.inv); b.matrix.copy(m); b.inv.copy(m).invert(); upd(); };
  // dane dla rdzenia (same liczby — idą też do wątku)
  b.data = () => ({ half: b.half, m: b.matrix.elements, inv: b.inv.elements, prevInv: b.prevInv.elements, aabb: [...b.aabb.min.toArray(), ...b.aabb.max.toArray()], friction: b.friction, plastic: b.plastic });
  upd();
  return b;
}
const colliders = (C) => ({ ground: C.ground ?? null, boxes: (C.boxes || []).map((b) => b.data()), others: C.others || null, yield: !!C.yield, pin: C.pin || null });

export function createShell(simGeometries, opts = {}) {
  const geoms = simGeometries.map((g) => ({ pos: Float32Array.from(g.attributes.position.array), idx: g.index ? Uint32Array.from(g.index.array) : null }));
  const S = buildShell(geoms, opts), { N, X, T } = S, NT = T.length / 3, key = (x, y, z) => `${Math.round(x / S.O.weld)},${Math.round(y / S.O.weld)},${Math.round(z / S.O.weld)}`;
  const yr = () => { let lo = Infinity, hi = -Infinity; for (let i = 1; i < N * 3; i += 3) { if (X[i] < lo) lo = X[i]; if (X[i] > hi) hi = X[i]; } return [lo, hi]; };
  const h0 = (([lo, hi]) => hi - lo)(yr());

  // --- normalne trójkątów siatki fizycznej (do osadzenia)
  const TN = new Float32Array(NT * 3);
  function triNormals() {
    for (let t = 0; t < NT; t++) {
      const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
      const ux = X[b] - X[a], uy = X[b + 1] - X[a + 1], uz = X[b + 2] - X[a + 2], vx = X[c] - X[a], vy = X[c + 1] - X[a + 1], vz = X[c + 2] - X[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      TN[t * 3] = nx / l; TN[t * 3 + 1] = ny / l; TN[t * 3 + 2] = nz / l;
    }
  }
  triNormals();
  // --- osadzanie siatek do rysowania: najbliższy trójkąt (siatka przestrzenna środków trójkątów), barycentryczne, odsunięcie
  const embeds = [];
  const CELL = 0.12, grid = new Map(), gk = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
  for (let t = 0; t < NT; t++) {
    const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
    const k = gk((X[a] + X[b] + X[c]) / 3, (X[a + 1] + X[b + 1] + X[c + 1]) / 3, (X[a + 2] + X[b + 2] + X[c + 2]) / 3);
    let L = grid.get(k); if (!L) grid.set(k, L = []); L.push(t);
  }
  const _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Vector3(), _bc = new THREE.Vector3(), _n = new THREE.Vector3(), _tri = new THREE.Triangle();
  function nearestTri(p) {
    let best = -1, bd = Infinity;
    const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), cz = Math.floor(p.z / CELL);
    for (let r = 1; r <= 4 && best < 0; r++) for (let i = cx - r; i <= cx + r; i++) for (let j = cy - r; j <= cy + r; j++) for (let k = cz - r; k <= cz + r; k++) {
      const L = grid.get(`${i},${j},${k}`); if (!L) continue;
      for (const t of L) {
        _a.fromArray(X, T[t * 3] * 3); _b.fromArray(X, T[t * 3 + 1] * 3); _c.fromArray(X, T[t * 3 + 2] * 3);
        _tri.set(_a, _b, _c).closestPointToPoint(p, _q); const d = _q.distanceToSquared(p);
        if (d < bd) { bd = d; best = t; }
      }
    }
    return best;
  }
  function embed(obj) {
    obj.updateMatrixWorld(true);
    obj.traverse((m) => {
      if (!m.isMesh) return;
      const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld);
      // siatka w układzie świata; obiekt bez własnego przesunięcia
      m.geometry = g; m.matrixAutoUpdate = false; m.matrix.identity(); m.matrixWorld.identity(); m.frustumCulled = false;
      const pos = g.attributes.position, n = pos.count, tri = new Int32Array(n), bary = new Float32Array(n * 3), off = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        _p.fromBufferAttribute(pos, i); const t = nearestTri(_p); tri[i] = t;
        _a.fromArray(X, T[t * 3] * 3); _b.fromArray(X, T[t * 3 + 1] * 3); _c.fromArray(X, T[t * 3 + 2] * 3);
        _tri.set(_a, _b, _c).closestPointToPoint(_p, _q); _tri.getBarycoord(_q, _bc);
        bary[i * 3] = _bc.x; bary[i * 3 + 1] = _bc.y; bary[i * 3 + 2] = _bc.z;
        _n.set(TN[t * 3], TN[t * 3 + 1], TN[t * 3 + 2]); off[i] = _p.sub(_q).dot(_n);
      }
      // wierzchołki w tym samym miejscu (szew bryły obrotowej): wspólna normalna, bez widocznej linii
      const same = new Map(), twin = new Int32Array(n).fill(-1);
      for (let i = 0; i < n; i++) { const k = key(pos.getX(i), pos.getY(i), pos.getZ(i)); const j = same.get(k); if (j === undefined) same.set(k, i); else twin[i] = j; }
      embeds.push({ m, g, tri, bary, off, twin, hasTwin: twin.some((x) => x >= 0) });
    });
    obj.traverse((o) => { o.matrixAutoUpdate = false; o.matrix.identity(); });   // przesunięcia siedzą już w siatkach
    obj.updateMatrixWorld(true);
    drawEmbeds();
    return obj;
  }
  function drawEmbeds() {
    triNormals();
    for (const E of embeds) {
      const pos = E.g.attributes.position.array, { tri, bary, off } = E, n = tri.length;
      for (let i = 0; i < n; i++) {
        const t = tri[i], a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3, u = bary[i * 3], v = bary[i * 3 + 1], w = bary[i * 3 + 2], d = off[i];
        pos[i * 3] = X[a] * u + X[b] * v + X[c] * w + TN[t * 3] * d;
        pos[i * 3 + 1] = X[a + 1] * u + X[b + 1] * v + X[c + 1] * w + TN[t * 3 + 1] * d;
        pos[i * 3 + 2] = X[a + 2] * u + X[b + 2] * v + X[c + 2] * w + TN[t * 3 + 2] * d;
      }
      E.g.attributes.position.needsUpdate = true;
      E.g.computeVertexNormals();
      if (E.hasTwin) {
        const nr = E.g.attributes.normal.array;
        for (let i = 0; i < n; i++) if (E.twin[i] >= 0) { const j = E.twin[i] * 3, q = i * 3; for (let k = 0; k < 3; k++) { const s = nr[q + k] + nr[j + k]; nr[q + k] = nr[j + k] = s; } }
        for (let i = 0; i < n; i++) { const l = Math.hypot(nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]) || 1; nr[i * 3] /= l; nr[i * 3 + 1] /= l; nr[i * 3 + 2] /= l; }
      }
      E.g.computeBoundingSphere();
    }
  }

  // --- krok: na miejscu albo w wątku (wynik w następnej klatce; kroki zebrane w czasie liczenia idą razem)
  let worker = null, busy = false, queue = [], wakeNext = false, waiters = [], asked = 0, sentTo = 0, done = 0;
  if (opts.worker && typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('./shell-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        if (e.data.ready) return;
        X.set(e.data.X); S.awake = e.data.awake || queue.length > 0; busy = false; done = sentTo; drawEmbeds();
        waiters = waiters.filter(([n, f]) => (n <= done ? (f(), false) : true));   // kroki zlecone do tej chwili gotowe
        if (queue.length) send();
      };
      worker.postMessage({ init: { geoms, opts } });
    } catch { worker = null; }
  }
  function send() {
    // każdy krok ze swoimi zderzaczami (położenie prasy i sąsiadów z chwili zlecenia) — bez przeskoku prasy o kilka kroków
    busy = true; sentTo = asked; const steps = queue; queue = [];
    worker.postMessage({ step: { steps, wake: wakeNext } }); wakeNext = false;
  }
  function step(dt, C = {}) {
    if (!S.awake || dt <= 0) return;
    if (worker) { asked++; queue.push({ dt, C: colliders(C) }); if (!busy) send(); return; }
    stepShell(S, dt, colliders(C));
    drawEmbeds();
  }
  return {
    embed, step,
    get particles() { return X; },   // położenia cząstek (x, y, z po kolei) — do pomiarów
    get triangles() { return T; },   // trójkąty siatki fizycznej (indeksy cząstek) — do podglądu
    get radius() { return S.O.radius; },
    wake() { S.awake = true; S.still = 0; wakeNext = true; },
    get awake() { return S.awake; },
    get threaded() { return !!worker; },
    get pending() { return busy || queue.length > 0; },   // krok w wątku jeszcze się liczy
    settled() { const n = asked; return !worker || done >= n ? Promise.resolve() : new Promise((r) => waiters.push([n, r])); },
    bounds: yr,
    box() { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < N * 3; i += 3) for (let k = 0; k < 3; k++) { const v = X[i + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; } return b; },
    stats() { const [lo, hi] = yr(); return { particles: N, constraints: S.sA.length + S.bA.length, crush: Math.max(0, 1 - (hi - lo) / h0) }; },
    dispose() { for (const E of embeds) E.g.dispose(); if (worker) worker.terminate(); },
  };
}
