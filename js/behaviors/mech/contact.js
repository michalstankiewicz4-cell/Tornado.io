// Bryły zderzeń zazębienia (środowisko ląd, tryb „Fizyka” laboratorium mechaniki). Ząb koła to wielokąt wypukły
// (zarys ewolwentowy odcięty cięciwą na kole stóp — MechKit.toothHulls), koło w płaszczyźnie obrotu — z zębów,
// test zderzenia — osie rozdzielające (SAT) między zębami dwóch kół. Z tego, a nie ze wzoru, wychodzi strefa swobody
// zazębienia: dla kąta koła a szukamy, o ile można obrócić koło b w przód i w tył od położenia nominalnego, zanim
// ząb dotknie zęba (połowienie przedziału do 10⁻⁸ rad). Wynik — tabela [lo, hi] po fazie koła a w obrębie jednej
// podziałki (wzór powtarza się co ząb), czyli luz razem z jego zmiennością wzdłuż przyporu (zarys z odcinków).
//
//   const map = planeMap(spinA, spinB)   // płaszczyzna koła b → płaszczyzna koła a (osie równoległe)
//   const z = meshZone({ hullsA, hullsB, za, zb, map, rel, samples })
//   z.zone(θa, out) → out.lo, out.hi (C = θb − rel(θa) w [lo, hi] — zęby się nie dotykają)
//   z.hit(θa, θb) → czy bryły zębów się przenikają;  z.pen — ile próbek nominalnych już się przenikało (0 = dobrze)

const TAU = Math.PI * 2;
const wrap = (a) => a - TAU * Math.round(a / TAU);

// macierz płaszczyzny: punkt (u, v) koła b (lokalne y, z części wirującej przy θ = 0) → (y, z) w układzie koła a
export function planeMap(spinA, spinB) {
  const base = (s) => { const r = s.rotation.x; s.rotation.x = 0; s.updateWorldMatrix(true, false); const m = s.matrixWorld.clone(); s.rotation.x = r; s.updateWorldMatrix(true, false); return m; };
  const M = base(spinA).invert().multiply(base(spinB)), e = M.elements;   // kolumnami: e[4..6] — oś y koła b, e[8..10] — oś z, e[12..14] — początek
  return { a00: e[5], a01: e[9], a10: e[6], a11: e[10], tx: e[13], ty: e[14], parallel: Math.abs(Math.abs(e[0]) - 1) < 1e-6, dx: e[12] };
}

// rzut wielokąta na oś — przedział
function proj(P, n, nx, ny, out) { let lo = Infinity, hi = -Infinity; for (let i = 0; i < n; i += 2) { const d = P[i] * nx + P[i + 1] * ny; if (d < lo) lo = d; if (d > hi) hi = d; } out[0] = lo; out[1] = hi; }
const IA = [0, 0], IB = [0, 0];
function separated(P, np, Q, nq) {   // oś rozdzielająca wśród normalnych krawędzi P (bez założeń o kierunku obiegu)
  for (let i = 0; i < np; i += 2) {
    const j = (i + 2) % np, nx = P[j + 1] - P[i + 1], ny = P[i] - P[j];
    proj(P, np, nx, ny, IA); proj(Q, nq, nx, ny, IB);
    if (IB[0] > IA[1] || IA[0] > IB[1]) return true;
  }
  return false;
}
const overlap = (P, np, Q, nq) => !separated(P, np, Q, nq) && !separated(Q, nq, P, np);

export function meshZone({ hullsA, hullsB, za, zb, map, rel, samples = 48 }) {
  const { a00, a01, a10, a11, tx, ty } = map, det = a00 * a11 - a01 * a10;
  // kierunek do drugiej osi: od a w układzie a, od b w układzie b (odwrotność części liniowej)
  const psiA = Math.atan2(ty, tx), psiB = Math.atan2((-a10 * -tx + a00 * -ty) / det, (a11 * -tx - a01 * -ty) / det);
  const flat = (h) => Float64Array.from(h.flat()), HA = hullsA.map(flat), HB = hullsB.map(flat);
  const rA = Math.max(...hullsA.flat().map((p) => Math.hypot(p[0], p[1]))), rB = Math.max(...hullsB.flat().map((p) => Math.hypot(p[0], p[1])));
  const near = 2;   // zęby w pobliżu linii środków: ±2 podziałki z każdej strony
  const bufA = HA.map((h) => new Float64Array(h.length)), bufB = HB.map((h) => new Float64Array(h.length));
  const pickA = [], pickB = [];
  function place(ta, tb) {
    pickA.length = 0; pickB.length = 0;
    const ca = Math.cos(ta), sa = Math.sin(ta), cb = Math.cos(tb), sb = Math.sin(tb);
    for (let i = 0; i < za; i++) {
      if (Math.abs(wrap(i * TAU / za + ta - psiA)) > (near + 0.5) * TAU / za) continue;
      const s = HA[i], d = bufA[i];
      for (let k = 0; k < s.length; k += 2) { d[k] = s[k] * ca - s[k + 1] * sa; d[k + 1] = s[k] * sa + s[k + 1] * ca; }
      pickA.push(d);
    }
    for (let j = 0; j < zb; j++) {
      if (Math.abs(wrap(j * TAU / zb + tb - psiB)) > (near + 0.5) * TAU / zb) continue;
      const s = HB[j], d = bufB[j];
      for (let k = 0; k < s.length; k += 2) { const u = s[k] * cb - s[k + 1] * sb, v = s[k] * sb + s[k + 1] * cb; d[k] = a00 * u + a01 * v + tx; d[k + 1] = a10 * u + a11 * v + ty; }
      pickB.push(d);
    }
  }
  function hit(ta, tb) {
    place(ta, tb);
    for (const P of pickA) for (const Q of pickB) if (overlap(P, P.length, Q, Q.length)) return true;
    return false;
  }
  // strefa swobody z brył: od położenia nominalnego krok po kroku w przód / w tył, potem połowienie przedziału
  const period = TAU / za, pitchB = TAU / zb, lo = new Float64Array(samples), hi = new Float64Array(samples);
  let pen = 0;
  const edge = (ta, tb0, s) => {
    const step = pitchB / 64; let a = 0, b = 0;
    for (let d = step; d <= pitchB; d += step) { if (hit(ta, tb0 + s * d)) { b = d; break; } a = d; }
    if (!b) return s * pitchB;   // nie dotknął w całej podziałce (koła rozsunięte)
    for (let k = 0; k < 26; k++) { const m = (a + b) / 2; if (hit(ta, tb0 + s * m)) b = m; else a = m; }
    return s * a;
  };
  for (let k = 0; k < samples; k++) {
    const ta = k * period / samples, tb0 = rel(ta, 0);
    if (hit(ta, tb0)) { pen++; lo[k] = hi[k] = 0; continue; }
    hi[k] = edge(ta, tb0, 1); lo[k] = edge(ta, tb0, -1);
  }
  const stat = (arr) => ({ min: Math.min(...arr), max: Math.max(...arr) });
  const width = Array.from(hi, (h, k) => h - lo[k]);
  function zone(ta, out) {
    let f = (ta / period) % 1; if (f < 0) f += 1;
    const x = f * samples, i = Math.floor(x) % samples, j = (i + 1) % samples, u = x - Math.floor(x);
    out.lo = lo[i] + (lo[j] - lo[i]) * u; out.hi = hi[i] + (hi[j] - hi[i]) * u;
    return out;
  }
  return { zone, hit, lo, hi, pen, samples, width: { ...stat(width), mean: width.reduce((a, b) => a + b, 0) / samples }, hi0: stat(hi), lo0: stat(lo), center: Math.hypot(tx, ty), rA, rB };
}
