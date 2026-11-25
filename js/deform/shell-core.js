// DeformKit — rdzeń obliczeń powłoki (bez Three.js: działa na głównym wątku i w wątku js/deform/shell-worker.js).
// Opis metody: js/deform/shell.js.
//   buildShell(geoms, opts) → stan    geoms: [{ pos: Float32Array (x, y, z…), idx: Uint32Array | null }]
//   stepShell(stan, dt, C) → stan.awake
//     C: { ground: y | null, boxes: [{ half: [3], m: [16], inv: [16], prevInv: [16], aabb: [6], friction, plastic }],
//          others: [Float32Array (x, y, z…)] — cząstki innych powłok (stan z poprzedniego kroku): odpychanie na odległość
//            2 × radius, każda strona przesuwa swoje cząstki o połowę wcisku (obie razem — cały),
//          yield: true — plastyczność także bez docisku prasy (np. gdy prasa naciska przez inne beczki) }
export const DEFAULTS = { mass: 18, stretch: 1, bend: 0.6, yieldStretch: 0.03, yieldBend: 0.006, weld: 0.002, substeps: 2, iterations: 30, friction: 0.7, radius: 0.004, gravity: 9.81 };

export function buildShell(geoms, opts = {}) {
  const O = { ...DEFAULTS, ...opts };
  // zgrzewanie wierzchołków po położeniu
  const key = (x, y, z) => `${Math.round(x / O.weld)},${Math.round(y / O.weld)},${Math.round(z / O.weld)}`;
  const map = new Map(), P = [], tris = [];
  for (const { pos, idx } of geoms) {
    const n = pos.length / 3, m = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const k = key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      let id = map.get(k); if (id === undefined) { id = P.length / 3; P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); map.set(k, id); }
      m[i] = id;
    }
    const L = idx ? idx.length : n;
    for (let i = 0; i < L; i += 3) { const a = m[idx ? idx[i] : i], b = m[idx ? idx[i + 1] : i + 1], c = m[idx ? idx[i + 2] : i + 2]; if (a !== b && b !== c && a !== c) tris.push(a, b, c); }
  }
  const N = P.length / 3, X = new Float32Array(P), T = Int32Array.from(tris);
  // więzy: krawędzie, pary naprzeciw krawędzi, cięciwy przez wierzchołek (sąsiedzi prawie w linii)
  const edges = new Map(), nb = Array.from({ length: N }, () => []);
  for (let t = 0; t < T.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = T[t + e], b = T[t + (e + 1) % 3], o = T[t + (e + 2) % 3], k = a < b ? a * N + b : b * N + a;
    const E = edges.get(k); if (E) E.push(o); else edges.set(k, [a, b, o]);
  }
  const SA = [], SB = [], BA = [], BB = [], pairs = new Set();
  const addB = (a, b) => { const k = a < b ? a * N + b : b * N + a; if (!pairs.has(k)) { pairs.add(k); BA.push(a); BB.push(b); } };
  for (const E of edges.values()) { SA.push(E[0]); SB.push(E[1]); nb[E[0]].push(E[1]); nb[E[1]].push(E[0]); if (E.length >= 4 && E[2] !== E[3]) addB(E[2], E[3]); }
  for (let v = 0; v < N; v++) {
    const L = nb[v];
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const u = L[i] * 3, w = L[j] * 3, c = v * 3;
      const ax = X[u] - X[c], ay = X[u + 1] - X[c + 1], az = X[u + 2] - X[c + 2], bx = X[w] - X[c], by = X[w + 1] - X[c + 1], bz = X[w + 2] - X[c + 2];
      if ((ax * bx + ay * by + az * bz) / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz) || 1) < -0.866) addB(L[i], L[j]);
    }
  }
  const len = (A, B) => Float32Array.from(A, (a, i) => Math.hypot(X[a * 3] - X[B[i] * 3], X[a * 3 + 1] - X[B[i] * 3 + 1], X[a * 3 + 2] - X[B[i] * 3 + 2]));
  return {
    O, N, X, PREV: X.slice(), V: new Float32Array(N * 3), W: new Float32Array(N).fill(N / O.mass), T,
    sA: Int32Array.from(SA), sB: Int32Array.from(SB), sL: len(SA, SB), bA: Int32Array.from(BA), bB: Int32Array.from(BB), bL: len(BA, BB),
    awake: true, still: 0,
  };
}

function solve(S, A, B, L, k) {
  const X = S.X, W = S.W, n = A.length;
  for (let c = 0; c < n; c++) {
    const a = A[c] * 3, b = B[c] * 3, wa = W[A[c]], wb = W[B[c]], ws = wa + wb; if (!ws) continue;
    const dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
    const s = k * (d - L[c]) / (d * ws);
    X[a] += dx * s * wa; X[a + 1] += dy * s * wa; X[a + 2] += dz * s * wa;
    X[b] -= dx * s * wb; X[b + 1] -= dy * s * wb; X[b + 2] -= dz * s * wb;
  }
}
// plastyczność: nadmiar ponad granicę przechodzi w nową długość spoczynkową
function yieldTo(S, A, B, L, y) {
  const X = S.X;
  for (let c = 0; c < A.length; c++) {
    const a = A[c] * 3, b = B[c] * 3, d = Math.hypot(X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]), lim = L[c] * y, e = d - L[c];
    if (e > lim) L[c] += e - lim; else if (e < -lim) L[c] += e + lim;
  }
}
// grunt i prostopadłościany: najpłytsze wyjście przez ścianę, tarcie — styczne położenie względem bryły jak przed krokiem
function collide(S, C) {
  const { X, PREV, N, O } = S, r = O.radius, gy = C.ground, boxes = C.boxes || [], f = O.friction;
  let pressed = false;
  for (let i = 0; i < N; i++) {
    const p = i * 3;
    if (gy != null && X[p + 1] < gy + r) { X[p + 1] = gy + r; X[p] += (PREV[p] - X[p]) * f; X[p + 2] += (PREV[p + 2] - X[p + 2]) * f; }
    for (let k = 0; k < boxes.length; k++) {
      const B = boxes[k], bb = B.aabb, x = X[p], y = X[p + 1], z = X[p + 2];
      if (x < bb[0] - r || x > bb[3] + r || y < bb[1] - r || y > bb[4] + r || z < bb[2] - r || z > bb[5] + r) continue;
      const e = B.inv, lx = e[0] * x + e[4] * y + e[8] * z + e[12], ly = e[1] * x + e[5] * y + e[9] * z + e[13], lz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const ex = B.half[0] + r, ey = B.half[1] + r, ez = B.half[2] + r, px = ex - Math.abs(lx), py = ey - Math.abs(ly), pz = ez - Math.abs(lz);
      if (px <= 0 || py <= 0 || pz <= 0) continue;
      const q = B.prevInv, ox = PREV[p], oy = PREV[p + 1], oz = PREV[p + 2];
      const qx = q[0] * ox + q[4] * oy + q[8] * oz + q[12], qy = q[1] * ox + q[5] * oy + q[9] * oz + q[13], qz = q[2] * ox + q[6] * oy + q[10] * oz + q[14], bf = B.friction;
      let nx = lx, ny = ly, nz = lz;
      if (py <= px && py <= pz) { ny = Math.sign(ly || 1) * ey; nx += (qx - nx) * bf; nz += (qz - nz) * bf; }
      else if (px <= pz) { nx = Math.sign(lx || 1) * ex; ny += (qy - ny) * bf; nz += (qz - nz) * bf; }
      else { nz = Math.sign(lz || 1) * ez; nx += (qx - nx) * bf; ny += (qy - ny) * bf; }
      const m = B.m;
      X[p] = m[0] * nx + m[4] * ny + m[8] * nz + m[12]; X[p + 1] = m[1] * nx + m[5] * ny + m[9] * nz + m[13]; X[p + 2] = m[2] * nx + m[6] * ny + m[10] * nz + m[14];
      if (B.plastic) pressed = true;
    }
  }
  return pressed;
}

// siatka haszowana cząstek innych powłok (komórka = odległość styku); stała w czasie kroku
function othersGrid(S, others) {
  let n = 0; for (const P of others) n += P.length / 3;
  if (!n) return null;
  const D = S.O.radius * 2, inv = 1 / D;
  let size = 1; while (size < n * 2) size <<= 1;
  const G = S._grid && S._grid.size === size && S._grid.cap >= n ? S._grid : (S._grid = { size, cap: n, start: new Int32Array(size + 1), ent: new Int32Array(n), P: new Float32Array(n * 3), cell: new Int32Array(n) });
  if (G.P.length < n * 3) { G.P = new Float32Array(n * 3); G.ent = new Int32Array(n); G.cell = new Int32Array(n); G.cap = n; }
  const P = G.P, start = G.start, cell = G.cell, ent = G.ent, m = size - 1, bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let o = 0; for (const Q of others) { P.set(Q, o); o += Q.length; }
  start.fill(0);
  for (let j = 0; j < n; j++) {
    const x = P[j * 3], y = P[j * 3 + 1], z = P[j * 3 + 2];
    if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (z < bb[2]) bb[2] = z; if (x > bb[3]) bb[3] = x; if (y > bb[4]) bb[4] = y; if (z > bb[5]) bb[5] = z;
    const c = hash(Math.floor(x * inv), Math.floor(y * inv), Math.floor(z * inv)) & m; cell[j] = c; start[c + 1]++;
  }
  for (let c = 0; c < size; c++) start[c + 1] += start[c];
  const fill = start.slice(0, size);
  for (let j = 0; j < n; j++) ent[fill[cell[j]]++] = j;
  G.n = n; G.D = D; G.inv = inv; G.bb = bb;
  return G;
}
const hash = (i, j, k) => (Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791)) >>> 0;
function collideOthers(S, G) {
  const { X, N } = S, { P, start, ent, D, inv, bb, size } = G, m = size - 1, D2 = D * D;
  let hit = false;
  for (let i = 0; i < N; i++) {
    const p = i * 3, x = X[p], y = X[p + 1], z = X[p + 2];
    if (x < bb[0] - D || x > bb[3] + D || y < bb[1] - D || y > bb[4] + D || z < bb[2] - D || z > bb[5] + D) continue;
    const ix = Math.floor(x * inv), iy = Math.floor(y * inv), iz = Math.floor(z * inv);
    let dx = 0, dy = 0, dz = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const h = hash(ix + a, iy + b, iz + c) & m;
      for (let e = start[h], E = start[h + 1]; e < E; e++) {
        const q = ent[e] * 3, ux = x - P[q], uy = y - P[q + 1], uz = z - P[q + 2], d2 = ux * ux + uy * uy + uz * uz;
        if (d2 >= D2 || d2 < 1e-12) continue;
        const d = Math.sqrt(d2), k = 0.5 * (D - d) / d; dx += ux * k; dy += uy * k; dz += uz * k;
      }
    }
    if (dx || dy || dz) { X[p] += dx; X[p + 1] += dy; X[p + 2] += dz; hit = true; }
  }
  return hit;
}

export function stepShell(S, dt, C = {}) {
  if (!S.awake || dt <= 0) return S.awake;
  const { O, N, X, PREV, V } = S, sub = O.substeps, h = dt / sub, g = O.gravity * h;
  const G = C.others && C.others.length ? othersGrid(S, C.others) : null;
  let pressed = !!C.yield;
  for (let s = 0; s < sub; s++) {
    for (let i = 0; i < N; i++) {
      const p = i * 3; PREV[p] = X[p]; PREV[p + 1] = X[p + 1]; PREV[p + 2] = X[p + 2];
      V[p + 1] -= g;
      X[p] += V[p] * h; X[p + 1] += V[p + 1] * h; X[p + 2] += V[p + 2] * h;
    }
    for (let it = 0; it < O.iterations; it++) {
      solve(S, S.sA, S.sB, S.sL, O.stretch);
      solve(S, S.bA, S.bB, S.bL, O.bend);
      if (collide(S, C)) pressed = true;
      if (G) collideOthers(S, G);
    }
    let mv = 0;
    for (let i = 0; i < N * 3; i++) { const v = (X[i] - PREV[i]) / h; V[i] = v * 0.99; const av = v < 0 ? -v : v; if (av > mv) mv = av; }
    S.still = mv < 0.005 ? S.still + h : 0;
  }
  // plastyczność tylko przy docisku prasą (sam ciężar: drobne ugięcie metody nie narasta krok po kroku)
  if (pressed) { yieldTo(S, S.sA, S.sB, S.sL, O.yieldStretch); yieldTo(S, S.bA, S.bB, S.bL, O.yieldBend); }
  if (S.still > 0.5) { S.awake = false; V.fill(0); }   // spoczynek — bez liczenia, aż coś obudzi
  return S.awake;
}
