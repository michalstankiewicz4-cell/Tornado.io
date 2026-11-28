// Złącze śrubowe dokręcane nakrętką (środowisko ląd, VDI 2230 w uproszczeniu). Obrót nakrętki φ przesuwa ją o P·φ/2π;
// po dojściu do oporu (podkładka) dalszy obrót to wydłużenie śruby i ściśnięcie blach: F = δ · k_s·k_p / (k_s + k_p).
//   podatność śruby: łeb 0,5d, część gładka, gwint wolny w zacisku, gwint w nakrętce 0,5d, nakrętka 0,4d (E = 205 GPa);
//   blachy: przekrój zastępczy stożka (VDI 2230: A = π/4·(d_w² − d_h²) + π/8·d_w·(D_A − d_w)·((x + 1)² − 1),
//   x = ∛(l_k·d_w / D_A²)), D_A — szerokość blach;
//   moment dokręcania: M = F·(0,16·P + 0,58·μ_G·d₂ + μ_K·D_Km/2); naprężenie zredukowane σ_red = √(σ² + 3τ²),
//   σ = F / A_s, τ = M_G / W_p (M_G — moment w gwincie, W_p = π·d_s³/16, d_s = (d₂ + d₃)/2);
//   granica plastyczności: σ_red ≥ R_e — siła przestaje rosnąć (śruba płynie), wydłużenie trwałe; zerwanie przy wydłużeniu
//   trwałym większym niż A·l (wydłużenie przy zerwaniu klasy na długości gwintu wolnego — skupia się tam odkształcenie).
// createBoltedJoint({ D, d, cls, lk, plain, len, m, DA, muG, muK, gap }) → { turn(dφ), state, recommended(), info }
export const ENV = ['land'];
const E = 205e9;
const ELONG = { '4.6': 0.22, '5.6': 0.2, '8.8': 0.12, '10.9': 0.09, '12.9': 0.08, 'A2-70': 0.3 };   // A — wydłużenie przy zerwaniu (ISO 898-1, ISO 3506)

export function createBoltedJoint({ D, d, cls, Rm, Re, lk, plain, len, m, DA = 0.04, muG = 0.12, muK = 0.12, gap = 3 }) {
  const P = D.P, AN = Math.PI * d * d / 4, A3 = Math.PI * D.d3 * D.d3 / 4, ds = (D.d2 + D.d3) / 2, Wp = Math.PI * ds ** 3 / 16;
  const lThr = Math.max(0, lk - Math.min(plain, lk));   // gwint wolny w zacisku
  const ls = Math.min(plain, lk);
  const deltaS = (0.5 * d) / (E * AN) + ls / (E * AN) + lThr / (E * A3) + (0.5 * d) / (E * A3) + (0.4 * d) / (E * AN);
  const dw = D.dw, dh = D.dh, DAe = Math.max(DA, dw + 1e-4), x = Math.cbrt(lk * dw / (DAe * DAe));
  const Ap = Math.PI / 4 * (dw * dw - dh * dh) + Math.PI / 8 * dw * (DAe - dw) * ((x + 1) ** 2 - 1);
  const ks = 1 / deltaS, kp = E * Ap / lk, k = ks * kp / (ks + kp);
  const DKm = (dw + dh) / 2, kG = 0.16 * P + 0.58 * muG * D.d2, kT = kG + muK * DKm / 2;
  const sred = (F) => { const s = F / D.As, t = F * kG / Wp; return Math.sqrt(s * s + 3 * t * t); };
  const Fy = Re / Math.sqrt(1 / D.As ** 2 + 3 * (kG / Wp) ** 2);   // siła, przy której σ_red = R_e
  const Fbreak = Rm * D.As;   // nośność graniczna (rozciąganie po zdjęciu skręcania — informacyjnie)
  const plMax = (ELONG[cls] || 0.12) * Math.max(lThr, 2 * P) * 0.5;   // wydłużenie trwałe do zerwania (część długości zacisku z gwintem)
  // stan: φ — kąt nakrętki od położenia początkowego (luźno, gap obrotów przed oporem)
  const st = { phi: 0, phi0: gap * Math.PI * 2, F: 0, T: 0, sred: 0, util: 0, plastic: 0, broken: false, yielded: false, snug: false };
  function update() {
    if (st.broken) { st.F = 0; st.T = 0; st.sred = 0; st.util = 0; return st; }
    const delta = (st.phi - st.phi0) / (Math.PI * 2) * P - st.plastic;   // wcisk sprężysty (minus trwałe wydłużenie)
    let F = Math.max(0, delta) * k;
    if (F > Fy) { st.plastic += (F - Fy) / k; F = Fy; st.yielded = true; }   // płynięcie: nadmiar przechodzi w wydłużenie trwałe
    if (st.plastic > plMax) { st.broken = true; F = 0; }
    st.snug = st.phi >= st.phi0 - 1e-9; st.F = F; st.T = F * kT; st.sred = sred(F); st.util = st.sred / Re;
    return st;
  }
  function turn(dphi) { if (st.broken) return update(); st.phi = Math.max(0, st.phi + dphi); return update(); }
  // dokręcenie do zalecanej siły (wykorzystanie 90 % R_e) albo zadanego kąta
  const Frec = 0.9 * Fy;
  function setForce(F) { st.plastic = 0; st.broken = false; st.yielded = false; st.phi = st.phi0 + F / k / P * Math.PI * 2; return update(); }
  update();
  return { state: st, turn, update, setForce, recommended: () => ({ F: Frec, T: Frec * kT }), k, ks, kp, Fy, Fbreak, kG, kT, lThr, Ap, posAdvance: () => Math.min(st.phi, st.phi0) / (Math.PI * 2) * P, info: { deltaS, Ap, x, DKm } };
}
