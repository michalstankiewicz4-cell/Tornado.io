// Napęd fizyczny (środowisko ląd) — tryb „Fizyka” laboratorium mechaniki. Każdy element ma własny kąt i prędkość
// (stopień swobody), połączenia z napędu (js/behaviors/mech/drive.js: te same porty i związki kątów) są wiązaniami
// rozwiązywanymi metodą XPBD na kątach: C = θb − f(θa), gradient z pochodnej f. Siły nie są „przełożeniem z wzoru”:
// silnik daje moment swojemu wirnikowi, hamulec — tarczy, a reszta porusza się dlatego, że wiązania nie pozwalają
// się rozjechać. Momenty przenoszone przez połączenia — z mnożników wiązań (λ / h²).
// Punkty fizyki (po kolei):
//   1. luz w zazębieniu — wiązanie z martwą strefą ±luz/2 (z geometrii zębów): w środku strefy koła się nie dotykają,
//      przy zmianie kierunku napędzane stoi, aż ząb przejdzie luz i przyłoży się drugą flanką.
//   (dalej: sprężystość połączeń — compliance, poślizg pasa, nierówny bieg łańcucha, bryły zderzeń, obwód elektryczny)
//   const ph = createPhysics(drive, { motorId, brakeId, backlash: (edge) => luz kątowy koła b (rad) | 0 })
//   ph.step(dt, { w0, brake, Tmax, slip, rated }) → stan;  ph.state, ph.edges (stan każdego połączenia)
export const ENV = ['land'];
const TAU = Math.PI * 2;

export function createPhysics(drive, { motorId, brakeId, backlash = () => 0, substeps = 48, iterations = 6, bearing = 0.0004 } = {}) {
  const motor = drive.els.get(motorId), brake = brakeId ? drive.els.get(brakeId) : null;
  const order = drive.order;   // drzewo połączeń od silnika (jak w napędzie kinematycznym)
  const nodes = [motor, ...order.map((e) => e.b)];
  const idx = new Map(nodes.map((n, i) => [n, i]));
  const N = nodes.length, th = new Float64Array(N), om = new Float64Array(N), prev = new Float64Array(N), w = new Float64Array(N);
  nodes.forEach((n, i) => { th[i] = n.theta; om[i] = n.omega || 0; w[i] = 1 / Math.max(n.J || 0, 1e-6); });
  const E = order.map((e) => ({ e, a: idx.get(e.a), b: idx.get(e.b), dead: Math.max(0, backlash(e) || 0) / 2, lam: 0, T: 0, C: 0, contact: 0 }));
  const st = { omega: 0, Tm: 0, Tb: 0, P: 0, t: 0 };

  // jedno wiązanie: przesunięcie θa i θb tak, by C wróciło do strefy [−dead, +dead] (sztywno — compliance 0)
  function solve(c, h2) {
    const ta = th[c.a], tb = th[c.b], f = c.e.rel(ta, tb), C = tb - f;
    c.C = C;
    let ex = 0;
    if (C > c.dead) ex = C - c.dead; else if (C < -c.dead) ex = C + c.dead;
    if (!ex) return;
    const eps = 1e-5, ga = -(c.e.rel(ta + eps, tb) - c.e.rel(ta - eps, tb)) / (2 * eps), gb = 1;
    const dl = -ex / (w[c.a] * ga * ga + w[c.b] * gb * gb);
    th[c.a] += w[c.a] * ga * dl; th[c.b] += w[c.b] * gb * dl;
    c.lam += dl;
  }

  function step(dt, { w0 = 0, brake: Tbrake = 0, Tmax = 18, slip = 0.06, rated = 1450 } = {}) {
    if (dt <= 0) return st;
    const n = Math.max(1, Math.round(substeps * dt * 60)), h = dt / n, h2 = h * h, k = Tmax / (2.5 * slip * rated * TAU / 60);
    const im = idx.get(motor), ib = brake ? idx.get(brake) : -1;
    for (const c of E) c.T = 0;
    let Tm = 0, Tb = 0;
    for (let s = 0; s < n; s++) {
      // momenty zewnętrzne: silnik (poślizg — falownik zadaje prędkość synchroniczną w0), łożyska (opór lepki)
      Tm = Math.max(-Tmax, Math.min(Tmax, k * (w0 - om[im])));
      om[im] += h * Tm * w[im];
      for (let i = 0; i < N; i++) om[i] -= om[i] * Math.min(1, bearing * w[i] * h);
      // hamulec: tarcie suche — zatrzymuje, ale nie zawraca (najwyżej do zera w kroku)
      if (ib >= 0 && Tbrake > 0) { const dw = Tbrake * w[ib] * h; Tb = Math.abs(om[ib]) <= dw ? om[ib] / (w[ib] * h) : Math.sign(om[ib]) * Tbrake; om[ib] = Math.abs(om[ib]) <= dw ? 0 : om[ib] - Math.sign(om[ib]) * dw; }
      for (let i = 0; i < N; i++) { prev[i] = th[i]; th[i] += om[i] * h; }
      for (const c of E) c.lam = 0;
      for (let it = 0; it < iterations; it++) {   // tam i z powrotem po drzewie — szybka zbieżność łańcucha połączeń
        for (let j = 0; j < E.length; j++) solve(E[j], h2);
        for (let j = E.length - 1; j >= 0; j--) solve(E[j], h2);
      }
      for (let i = 0; i < N; i++) om[i] = (th[i] - prev[i]) / h;
      for (const c of E) c.T += c.lam / h2 / n;   // średni moment w połączeniu w tej klatce (na kole b)
    }
    // stan dla rysowania i okien
    nodes.forEach((nd, i) => { nd.theta = th[i]; nd.omega = om[i]; nd.r = om[im] ? om[i] / om[im] : nd.r; });
    for (const c of E) {
      c.contact = c.dead ? (c.C >= c.dead - 1e-6 ? 1 : c.C <= -c.dead + 1e-6 ? -1 : 0) : 0;
      c.e.b.T = Math.abs(c.T);
    }
    motor.T = Tm;
    Object.assign(st, { omega: om[im], Tm, Tb, P: Tm * om[im], t: st.t + dt, Pout: ib >= 0 ? Math.abs(Tb * om[ib]) : 0 });
    return st;
  }
  // ustawienie stanu z kąta i prędkości z napędu kinematycznego (przy wejściu w tryb)
  function sync() { nodes.forEach((nd, i) => { th[i] = nd.theta; om[i] = nd.omega || 0; }); }
  return { step, sync, state: st, edges: E, nodes };
}
