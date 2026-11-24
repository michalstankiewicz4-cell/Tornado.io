// Laboratorium ulic: próbki StreetKit (js/models/streets/streetkit.js) na trawie pod niebem SkyKit — prosta ulica, łuk,
// skrzyżowania (4 i 3 wloty), aleja, droga wiejska, ścieżka, droga dla rowerów. Przekrój i nawierzchnie na suwakach.
// Dla AI: StreetsApi.
import * as THREE from '../../../vendor/three/three.module.js';
import { createStage, WEATHER } from '../../core/stage.js';
import { groundDisc } from '../../world/ground.js';
import { PROFILES, SURFACES, surface, buildStreet, buildCrossing, buildTrafficLight, signalAt, SIGNAL_STATES, SIGNAL_TIMES, buildLamp, LAMPS, buildSign, SIGNS, alongStreet, buildViaduct, VIADUCT_PROFILE, BOLLARDS, buildBollards, RAILS, buildRail, NOISE, buildNoiseWall, buildMilepost, buildMileposts, PARKING, buildParking, buildTunnel, TUNNEL_PROFILE, TUNNEL_BOX_PROFILE, buildFootbridge } from '../../models/streets/streetkit.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach((k) => e.append(k)); return e; };
const KEY = 'tornado.streets.v1';
let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { saved = null; }

// próbki: linia trasy albo skrzyżowanie; przekrój domyślny
const SCENES = {
  straight: { label: 'Prosta ulica', profile: 'city', note: 'Ulica miejska: dwa pasy ruchu po 3,25 m z osią przerywaną, krawężnik 14 cm, chodnik z płyt 2,5 m, pas zieleni.', line: [[-40, 0], [40, 0]] },
  curve: { label: 'Łuk', profile: 'city', note: 'Ta sama ulica prowadzona po łuku — przekrój idzie za linią (krzywa Catmulla–Roma).', line: [[-40, -18], [-15, -16], [5, -4], [18, 14], [24, 40]] },
  crossing: { label: 'Skrzyżowanie', profile: 'city', note: 'Cztery wloty, łuki krawężników i chodników na narożach, przejścia dla pieszych (zebra), linie zatrzymania na pasach wjazdowych.', crossing: 4 },
  tee: { label: 'Skrzyżowanie T', profile: 'city', note: 'Trzy wloty; po stronie bez wlotu prosty chodnik wzdłuż brzegu skrzyżowania.', crossing: 3 },
  avenue: { label: 'Aleja', profile: 'avenue', note: 'Dwie jezdnie po dwa pasy, pas dzielący z trawnikiem, chodnik z kostki, droga dla rowerów z czerwonej kostki, drugi chodnik z płyt.', line: [[-45, 0], [45, 0]] },
  village: { label: 'Droga wiejska', profile: 'village', note: 'Stary asfalt bez oznakowania i krawężników, pobocza z kruszywa, rów z trawą.', line: [[-45, 10], [-20, 4], [0, 8], [20, -2], [45, -8]] },
  path: { label: 'Ścieżka', profile: 'path', note: 'Ścieżka z kruszywa z obrzeżem, kręta, przez trawnik.', line: [[-30, -10], [-15, 6], [0, -2], [12, 12], [28, 4]] },
  signal: { label: 'Sygnalizator', profile: 'city', note: 'Sygnalizator dla pojazdów: komora z soczewkami 300 mm (czerwone, żółte, zielone), daszki, tarcza z białą obwódką; na słupie przy chodniku i na wysięgniku nad jezdnią. Cykl jak w Polsce, nocą żółte migające.', line: [[-20, 0], [20, 0]], signals: true },
  viaduct: { label: 'Wiadukt prosty', profile: 'city', note: 'Prosty wiadukt drogowy nad ulicą: wjazdy po nasypach ze skarpami, przyczółki, w środku pomost na filarach z oczepem (bez filarów na jezdni pod spodem), bariery betonowe z poręczą, prześwit ok. 6,5 m.',
    viaduct: [[-95, 0, 0.3], [-65, 0, 2.6], [-38, 0, 6.4], [-16, 0, 7.7], [0, 0, 7.9], [16, 0, 7.7], [38, 0, 6.4], [65, 0, 2.6], [95, 0, 0.3]], under: [[0, -60], [0, 60]], lanes: 2 },
  viaductCurve: { label: 'Wiadukt na łuku (estakada)', profile: 'city', note: 'Estakada skręcająca po łuku na wysokości ok. 9 m, na filarach co 24 m; wjazdy po nasypach na obu końcach.',
    viaduct: [[-95, -35, 0.3], [-62, -32, 4.2], [-32, -20, 8.4], [-8, 2, 9.2], [10, 28, 9.4], [34, 46, 8.8], [64, 52, 4.4], [96, 50, 0.3]], lanes: 2 },
  viaductRamp: { label: 'Łącznica (zjazd po pętli)', profile: 'city', note: 'Skręcająca łącznica: jeden szeroki pas zjeżdża pętlą o promieniu 34 m z wysokości 8 m na ziemię, na filarach, a nisko — po nasypie.',
    viaduct: Array.from({ length: 11 }, (_, k) => { const a = k * Math.PI * 1.6 / 10 - 0.6; return [Math.cos(a) * 34, Math.sin(a) * 34, 8.4 * (1 - k / 10) + 0.3]; }), lanes: 1 },
  tunnel: { label: 'Tunel przez górę', profile: 'city', note: 'Tunel drogowy przez wzgórze: dojazdy w przekopie ze skarpami, portale — betonowe ściany czołowe z otworem, obudowa łukowa (ściany i sklepienie półkoliste), jasne okładziny ścian do 3 m, oprawy pod sklepieniem co 8 m, chodniki służbowe.', tunnel: 'arch' },
  tunnelBox: { label: 'Tunel z podporami (2 × 2 pasy)', profile: 'city', note: 'Tunel dwukierunkowy o przekroju prostokątnym: dwie jezdnie po dwa pasy, pośrodku wysepka z rzędem słupów co 6 m, strop płaski 5,2 m; w portalu dwa otwory rozdzielone filarem.', tunnel: 'box' },
  footbridge: { label: 'Kładka ze schodami', profile: 'city', note: 'Kładka dla pieszych nad ulicą: pomost stalowy na wysokości 5 m (skrajnia 4,6 m), balustrady szklane z pochwytem, na końcach spoczniki na słupach i schody betonowe w dwóch biegach ze spocznikiem pośrednim (stopnie 15 × 30 cm).', line: [[-40, 0], [40, 0]], footbridge: 'stairs' },
  footbridgeLift: { label: 'Kładka ze schodami i windą', profile: 'city', note: 'Ta sama kładka, a przy każdym spoczniku winda w przeszklonym szybie ze stalową ramą — wejście z chodnika na dole i ze spocznika na górze.', line: [[-40, 0], [40, 0]], footbridge: 'lift' },
  furniture: { label: 'Latarnie i znaki', profile: 'city', note: 'Cztery rodzaje latarni (współczesna LED, podwójna, parkowa stylizowana, stara betonowa z sodówką) i polskie znaki drogowe: ostrzegawcze, zakazu, nakazu, informacyjne. Po zmroku latarnie się zapalają.', line: [[-40, 0], [40, 0]], furniture: true },
  barriers: { label: 'Słupki, barierki, ekrany', profile: 'city', note: 'Słupki: stalowy blokujący z pasami odblaskowymi, żeliwny grafitowy, żeliwne połączone łańcuchem, betonowy walec, prowadzący U-1a; pikietaż — słupki hektometrowe 1–9 i kilometrowy z czerwoną głowicą. Barierki: ochronna U-12a (czerwono-biała), miejska grafitowa, bariera energochłonna stalowa. Za zieleńcem ekrany dźwiękochłonne: kasety pochłaniające, przezroczysty z pasami przeciw ptakom, kasety z przeszkleniem u góry.', line: [[-45, 0], [45, 0]], barriers: true },
  parking: { label: 'Miejsca parkingowe', profile: 'city', note: 'Pas postojowy przy jezdni: miejsca równoległe (2,5 × 6 m), skośne 60° i prostopadłe (2,5 × 5 m), wyznaczone liniami P-18. Na początku każdego pasa miejsca dla osób z niepełnosprawnością (3,6 m): niebieska powierzchnia z symbolem P-24, znak D-18 z tabliczką T-29. Rodzaj miejsc — w oknie Wyposażenie.', line: [[-40, 0], [40, 0]], parking: true },
  cycle: { label: 'Droga dla rowerów', profile: 'cycle', note: 'Czerwona kostka z osią przerywaną, niski krawężnik, chodnik z szarej kostki obok.', line: [[-35, 6], [-5, -4], [35, 2]] },
};
const S = { bollards: false, bollardType: 'steel', rails: false, railType: 'u12a', noise: false, noiseType: 'metal', noiseH: 4, mileposts: false, parking: 'none', parkDisabled: true, lamps: true, lampType: 'modern', lampEvery: 30, signs: true, lampsOn: 'auto', signal: 'cycle', scene: 'straight', profile: 'city', lanes: 2, laneW: 3.25, road: 'asphalt', marks: true, walkW: 2.5, curbH: 0.14, walk: 'slabs', corner: 6, weather: 'fair', sunEl: 32, sunAz: 215, ...(saved || {}) };
if (!SCENES[S.scene]) S.scene = 'straight'; if (!PROFILES[S.profile]) S.profile = 'city';
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* prywatny tryb */ } };

const stage = createStage($('view'));
const { scene, camera, renderer } = stage;
scene.add(groundDisc(200));
const holder = new THREE.Group(); scene.add(holder);

// przekrój z suwaków (na bazie wybranego profilu): jezdnia, krawężnik, chodnik o zadanej szerokości i nawierzchni
function profile() {
  const P = JSON.parse(JSON.stringify(PROFILES[S.profile]));
  P.lanes = S.lanes; P.laneW = S.laneW; P.road = S.road; if (!S.marks) P.marks = null;
  for (const st of P.strips) {
    if (st.k === 'curb' || st.k === 'sidewalk' || st.k === 'cycle' || st.k === 'verge' || st.k === 'edge') st.h = st.k === 'verge' && st.h < 0 ? st.h : Math.max(0, S.curbH) || 0.001;
    if (st.k === 'sidewalk') { st.w = S.walkW; st.s = S.walk; }
  }
  P.strips = P.strips.filter((st) => st.w > 0.01);
  const sc = SCENES[S.scene], pk = parkType();
  if (pk && sc.line && P.lanes > 1 && !P.median) P.strips.unshift({ k: 'parking', w: PARKING[pk].depth, h: 0, s: S.road });
  return P;
}
// rodzaj miejsc: z okna Wyposażenie; próbka „Miejsca parkingowe” bez wybranego — prostopadłe
const parkType = () => (S.parking !== 'none' ? S.parking : SCENES[S.scene].parking ? 'perpendicular' : null);
let built = { tris: 0, ms: 0 }, lights = [], lamps = [];
function rebuild() {
  holder.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); holder.clear();
  const t0 = performance.now(), sc = SCENES[S.scene], P = profile();
  let r;
  if (sc.viaduct) {
    // pomost: przekrój wiaduktu z suwakami szerokości pasa i nawierzchni; jedna łącznica — jeden szeroki pas
    const V = { ...VIADUCT_PROFILE, laneW: sc.lanes === 1 ? Math.max(4.5, S.laneW) : S.laneW, lanes: sc.lanes, road: S.road, marks: S.marks ? (sc.lanes === 1 ? { edge: true } : VIADUCT_PROFILE.marks) : null };
    const underHalf = sc.under ? P.lanes * P.laneW / 2 + P.strips.reduce((a, x) => a + x.w, 0) + 1 : 0;
    r = buildViaduct(sc.viaduct, V, { avoid: sc.under ? (x) => Math.abs(x) < underHalf : null, rail: !S.noise });
    // ekrany na koronie barier pomostu (bez cokołu; poręcz wtedy zdjęta)
    if (S.noise) for (const sd of [1, -1]) holder.add(buildNoiseWall(sc.viaduct, S.noiseType, { offset: sd * r.barrierAt, y: r.barrierTop, height: S.noiseH, plinth: 0 }).group);
    if (sc.under) holder.add(buildStreet(sc.under, P).group);
  } else if (sc.tunnel) {
    // wzgórze: grzbiet w poprzek drogi; portale tam, gdzie nad sklepieniem jest ≥ 2 m gruntu; dojazdy w przekopie
    const box = sc.tunnel === 'box', TP = { ...(box ? TUNNEL_BOX_PROFILE : TUNNEL_PROFILE), road: S.road, marks: S.marks ? (box ? TUNNEL_BOX_PROFILE : TUNNEL_PROFILE).marks : null };
    const probe = buildTunnel([[-1, 0], [1, 0]], TP, { type: sc.tunnel, lights: false }); const top = probe.top, th = probe.half;
    let Px = 0; while (hill(Px, 0) > top + 2) Px += 0.5;
    r = buildStreet([[-140, 0], [140, 0]], TP);
    const tn = buildTunnel([[-Px, 0], [Px, 0]], TP, { type: sc.tunnel, ground: hill }); holder.add(tn.group);
    holder.add(terrain(Px, th + 1.2));
    r.length = 280; r.width = 2 * th;
  } else r = sc.crossing ? buildCrossing(P, { arms: sc.crossing, arm: 32, corner: S.corner }) : buildStreet(sc.line, P);
  holder.add(r.group); holder.position.y = 0.02;
  // sygnalizatory: skrzyżowanie — na każdym wlocie po prawej stronie wjeżdżających (fazy A/B na przemian),
  // próbka „Sygnalizator” — na słupie przy chodniku i na wysięgniku nad jezdnią
  lights = [];
  const half = P.lanes * P.laneW / 2 + (P.median || 0) / 2, walk = P.strips.reduce((a, x) => a + x.w, 0);
  // pas postojowy (pierwszy w przekroju) — chodnik i wyposażenie zaczynają się za nim
  const park = P.strips[0] && P.strips[0].k === 'parking' ? P.strips[0].w : 0, ST = park ? P.strips.slice(1) : P.strips, hp = half + park;
  if (sc.crossing) {
    const R0 = half + S.corner, ALL = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for (let i = 0; i < sc.crossing; i++) {
      const [dx, dz] = ALL[i], tl = buildTrafficLight({ arm: P.lanes > 2 ? half : 0 });
      tl.group.position.set(dx * (R0 + 0.8) + dz * (half + 0.9), 0.14, dz * (R0 + 0.8) - dx * (half + 0.9));
      tl.group.rotation.y = Math.atan2(dx, dz);
      holder.add(tl.group); lights.push({ tl, phase: i % 2 ? SIGNAL_TIMES.half : 0 });
    }
  }
  // latarnie i znaki
  lamps = [];
  const edge = hp + (ST[0] && ST[0].k === 'curb' ? ST[0].w : 0) + 0.6;
  const putLamp = (type, x, z, rot) => { const L = buildLamp(type); L.group.position.set(x, ST[0] ? Math.max(0, ST[0].h) : 0, z); L.group.rotation.y = rot; holder.add(L.group); lamps.push(L); };
  const putSign = (id, x, z, rot, tab = null) => { const sg = buildSign(id, { tab }); sg.group.position.set(x, ST[0] ? Math.max(0, ST[0].h) : 0, z); sg.group.rotation.y = rot; holder.add(sg.group); };
  if (sc.furniture) {
    const types = Object.keys(LAMPS);
    types.forEach((t, i) => { const x = -30 + i * 20; putLamp(t, x, edge, Math.PI); putLamp(t, x + 10, -edge, 0); });
    Object.keys(SIGNS).forEach((id, i) => putSign(id, -33 + i * 5.2, edge + 1.8, 0));
  } else if (S.lamps && !sc.barriers) {
    if (sc.line) for (const sd of [1, -1]) for (const q of alongStreet(sc.line, S.lampEvery, sd * edge, sd > 0 ? S.lampEvery / 2 : S.lampEvery)) putLamp(S.lampType, q.x, q.z, q.rot);
    if (sc.under) for (const sd of [1, -1]) for (const q of alongStreet(sc.under, S.lampEvery, sd * edge, sd > 0 ? S.lampEvery / 2 : S.lampEvery)) if (Math.abs(q.z) > 14) putLamp(S.lampType, q.x, q.z, q.rot);
    if (sc.crossing) {
      const R0 = half + S.corner, ALL = [[1, 0], [0, 1], [-1, 0], [0, -1]];
      for (let i = 0; i < sc.crossing; i++) { const [dx, dz] = ALL[i]; for (const q of alongStreet([[dx * R0, dz * R0], [dx * (R0 + 32), dz * (R0 + 32)]], S.lampEvery, edge, 8)) putLamp(S.lampType, q.x, q.z, q.rot); }
    }
  }
  // słupki, barierki, ekrany: przy krawężniku (albo poboczu) i za ostatnim pasem przekroju
  const s0 = ST[0], kerb = hp + (s0 && (s0.k === 'curb' || s0.k === 'shoulder') ? s0.w : 0), walkY = s0 ? Math.max(0, s0.h) : 0, outer = half + walk + 0.6;
  const seg = (x0, x1) => [[x0, 0], [x1, 0]];
  if (sc.barriers) {
    [['steel', -45, -35], ['warsaw', -33, -23], ['chain', -21, -11], ['concrete', -9, -1]].forEach(([t, a, b]) => holder.add(buildBollards(seg(a, b), t, { offset: kerb + 0.45, y: walkY }).group));
    holder.add(buildBollards(seg(33, 45), 'delineator', { offset: kerb + 0.3, y: walkY, every: 3 }).group);
    [['u12a', 1, 15], ['city', 17, 31]].forEach(([t, a, b]) => holder.add(buildRail(seg(a, b), t, { offset: kerb + 0.3, y: walkY }).group));
    holder.add(buildRail(seg(-45, -5), 'guardrail', { offset: -(kerb + 0.35), y: walkY }).group);
    // pikietaż: słupki hektometrowe 1–9 i kilometrowy (próbki w rzędzie)
    for (let i = 0; i < 10; i++) { const m = buildMilepost(12, (i + 1) % 10); m.group.position.set(-2 + i * 4.6, walkY, -(kerb + 0.5)); holder.add(m.group); }
    [['metal', -45, -16], ['glass', -14, 14], ['mixed', 16, 45]].forEach(([t, a, b]) => holder.add(buildNoiseWall(seg(a, b), t, { offset: -outer, height: S.noiseH }).group));
  } else if (sc.line) {
    for (const sd of [1, -1]) {
      if (S.rails) holder.add(buildRail(sc.line, S.railType, { offset: sd * (kerb + 0.3), y: walkY }).group);
      if (S.bollards) holder.add(buildBollards(sc.line, S.bollardType, { offset: sd * (kerb + (S.rails ? 0.75 : 0.45)), y: walkY }).group);
      if (S.noise) holder.add(buildNoiseWall(sc.line, S.noiseType, { offset: sd * outer, height: S.noiseH }).group);
      if (S.mileposts) holder.add(buildMileposts(sc.line, { offset: sd * (kerb + (S.rails ? 1.1 : 0.6)), y: walkY, start: 12 * 1000 + 950, every: 100 }).group);
    }
  }
  // kładka nad ulicą (środek nad osią, schody poza chodnikiem)
  if (sc.footbridge) { const fb = buildFootbridge({ span: 2 * (half + walk) + 1, lift: sc.footbridge === 'lift' }); holder.add(fb.group); }
  // miejsca parkingowe: oznakowanie pasa postojowego, przy miejscach dla niepełnosprawnych znak D-18 z T-29
  if (park && sc.line) {
    for (const sd of [1, -1]) {
      const pk = buildParking(sc.line, parkType(), { inner: half, side: sd, disabled: S.parkDisabled ? (parkType() === 'parallel' ? 1 : 2) : 0 });
      holder.add(pk.group);
      const first = pk.stalls.filter((x) => x.disabled);
      if (first.length) for (const q of alongStreet(sc.line, 1000, sd * (kerb + 0.4), first[0].s)) putSign('D-18', q.x, q.z, q.rot, 'T-29');
    }
  }
  if (S.signs && sc.crossing) {
    // przy przejściach D-6 (po prawej stronie wjeżdżających), na skrzyżowaniu T wlot boczny: A-7 ustąp pierwszeństwa
    const R0 = half + S.corner, ALL = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for (let i = 0; i < sc.crossing; i++) {
      const [dx, dz] = ALL[i], d = R0 + 6.5, o = half + 1.4;
      putSign(sc.crossing === 3 && i === 1 ? 'A-7' : 'D-6', dx * d + dz * o, dz * d - dx * o, Math.atan2(dx, dz));
    }
  }
  if (sc.signals) {
    // ruch prawostronny: jadący na −x mają prawą stronę po −z, jadący na +x — po +z; sygnał przodem do nadjeżdżających
    const a = buildTrafficLight(); a.group.position.set(-4, 0.14, -(half + 0.9)); a.group.rotation.y = Math.PI / 2; holder.add(a.group); lights.push({ tl: a, phase: 0 });
    const b = buildTrafficLight({ arm: half + 0.6 }); b.group.position.set(4, 0.14, half + 0.9); b.group.rotation.y = -Math.PI / 2; holder.add(b.group); lights.push({ tl: b, phase: 0 });
  }
  let tris = 0; holder.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  built = { tris, ms: performance.now() - t0, len: r.length, width: r.width };
  $('sName').textContent = sc.label; $('sNote').textContent = sc.note;
  const roadW = P.lanes * P.laneW;
  $('sStats').replaceChildren(...[['Przekrój', PROFILES[S.profile].label], ['Jezdnia', `${P.lanes} × ${P.laneW.toFixed(2)} m = ${roadW.toFixed(2)} m`], ...(r.width ? [['Cała szerokość', `${r.width.toFixed(1)} m`]] : []), ...(r.length ? [['Długość', `${r.length.toFixed(0)} m`]] : []), ['Trójkąty', Math.round(tris).toLocaleString('pl')]]
    .flatMap(([a, b]) => [el('span', { textContent: a }), el('b', { textContent: String(b) })]));
  window.LabPerf.modelRows([['Siatki', holder.children[0] ? countMeshes() : 0], ['Trójkąty', Math.round(tris).toLocaleString('pl')], ['Zbudowane w', Math.round(built.ms) + ' ms']]);
  save();
}
// wzgórze do próbki tunelu (wysokość w m) i teren: środek nad tunelem bez zmian, dojazdy w przekopie (skarpy 1 : 0,8)
function hill(x, z) {
  const r = Math.exp(-((x / 46) ** 2)) * Math.exp(-((z / 80) ** 4)), n = 1 + 0.05 * Math.sin(x * 0.11 + z * 0.07) + 0.03 * Math.sin(z * 0.17 - x * 0.05);
  return 34 * r * n - 0.4;
}
function terrain(Px, c) {
  const g = new THREE.Group(), mat = surface('sod');
  const part = (x0, x1, cut) => {
    const nx = Math.max(2, Math.round((x1 - x0) / 1)), nz = 200, P = [], U = [], I = [];
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const x = x0 + (x1 - x0) * i / nx, z = -100 + 200 * j / nz;
      let y = hill(x, z); if (cut) y = Math.min(y, Math.abs(z) < c ? -0.08 : (Math.abs(z) - c) * 1.25 - 0.08);
      P.push(x, Math.max(-0.08, y), z); U.push(x / 3, z / 3);
      if (i && j) { const a = (i - 1) * (nz + 1) + j - 1, b = i * (nz + 1) + j - 1; I.push(a, a + 1, b, a + 1, b + 1, b); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = m.castShadow = true; g.add(m);
  };
  part(-Px, Px, false); part(-110, -Px, true); part(Px, 110, true);
  return g;
}
const countMeshes = () => { let n = 0; holder.traverse((o) => { if (o.isMesh) n++; }); return n; };

/* ---------------- panele ---------------- */
$('scene').replaceChildren(...Object.entries(SCENES).map(([k, v]) => el('option', { value: k, textContent: v.label })));
$('profile').replaceChildren(...Object.entries(PROFILES).map(([k, v]) => el('option', { value: k, textContent: v.label })));
$('road').replaceChildren(...Object.entries(SURFACES).filter(([, v]) => !v.slab).map(([k, v]) => el('option', { value: k, textContent: v.label })));
// chodnik: wersje płyt chodnikowych osobną grupą, potem inne nawierzchnie
{ const og = (label, list) => { const g = document.createElement('optgroup'); g.label = label; g.append(...list.map(([k, v]) => el('option', { value: k, textContent: v.label }))); return g; };
  const all = Object.entries(SURFACES); $('walk').replaceChildren(og('Płyty chodnikowe', all.filter(([, v]) => v.slab)), og('Inne', all.filter(([, v]) => !v.slab))); }
function fromProfile() {
  const P = PROFILES[S.profile], sw = P.strips.find((x) => x.k === 'sidewalk'), curb = P.strips.find((x) => x.k === 'curb' || x.k === 'sidewalk' || x.k === 'edge');
  Object.assign(S, { lanes: P.lanes, laneW: P.laneW, road: P.road, marks: !!P.marks, walkW: sw ? sw.w : 0, walk: sw ? sw.s : 'slabs', curbH: curb ? Math.max(0, curb.h) : 0 });
}
const fmt = { lanes: (v) => String(v), laneW: (v) => `${(+v).toFixed(2)} m`, walkW: (v) => `${(+v).toFixed(1)} m`, curbH: (v) => `${Math.round(v * 100)} cm`, corner: (v) => `${(+v).toFixed(1)} m` };
function show() {
  $('scene').value = S.scene; $('profile').value = S.profile; $('road').value = S.road; $('walk').value = S.walk; $('marks').checked = S.marks;
  for (const [k, f] of Object.entries(fmt)) { $(k).value = S[k]; $(k + 'V').textContent = f(S[k]); }
}
$('scene').onchange = () => { S.scene = $('scene').value; S.profile = SCENES[S.scene].profile; fromProfile(); show(); rebuild(); frame0(); };
$('profile').onchange = () => { S.profile = $('profile').value; fromProfile(); show(); rebuild(); };
$('road').onchange = () => { S.road = $('road').value; rebuild(); };
$('walk').onchange = () => { S.walk = $('walk').value; rebuild(); };
$('marks').onchange = () => { S.marks = $('marks').checked; rebuild(); };
for (const [k, f] of Object.entries(fmt)) { $(k).oninput = () => { S[k] = +$(k).value; $(k + 'V').textContent = f(S[k]); }; $(k).onchange = () => rebuild(); }
$('lampType').replaceChildren(...Object.entries(LAMPS).map(([k, v]) => el('option', { value: k, textContent: v.label })));
$('lampType').value = S.lampType; $('lampType').onchange = () => { S.lampType = $('lampType').value; rebuild(); };
$('lampsOn').value = S.lampsOn; $('lampsOn').onchange = () => { S.lampsOn = $('lampsOn').value; save(); };
for (const k of ['lamps', 'signs']) { $(k).checked = S[k]; $(k).onchange = () => { S[k] = $(k).checked; rebuild(); }; }
$('lampEvery').value = S.lampEvery; $('lampEveryV').textContent = S.lampEvery + ' m';
$('lampEvery').oninput = () => { S.lampEvery = +$('lampEvery').value; $('lampEveryV').textContent = S.lampEvery + ' m'; }; $('lampEvery').onchange = () => rebuild();
$('bollardType').replaceChildren(...Object.entries(BOLLARDS).map(([k, v]) => el('option', { value: k, textContent: v.label })));
$('railType').replaceChildren(...Object.entries(RAILS).map(([k, v]) => el('option', { value: k, textContent: v.label })));
$('noiseType').replaceChildren(...Object.entries(NOISE).map(([k, v]) => el('option', { value: k, textContent: v.label })));
for (const k of ['bollardType', 'railType', 'noiseType']) { $(k).value = S[k]; $(k).onchange = () => { S[k] = $(k).value; rebuild(); }; }
$('parking').replaceChildren(el('option', { value: 'none', textContent: 'Brak' }), ...Object.entries(PARKING).map(([k, v]) => el('option', { value: k, textContent: v.label })));
$('parking').value = S.parking; $('parking').onchange = () => { S.parking = $('parking').value; rebuild(); };
for (const k of ['bollards', 'rails', 'noise', 'mileposts', 'parkDisabled']) { $(k).checked = S[k]; $(k).onchange = () => { S[k] = $(k).checked; rebuild(); }; }
$('noiseH').value = S.noiseH; $('noiseHV').textContent = S.noiseH.toFixed(1) + ' m';
$('noiseH').oninput = () => { S.noiseH = +$('noiseH').value; $('noiseHV').textContent = S.noiseH.toFixed(1) + ' m'; }; $('noiseH').onchange = () => rebuild();
$('signal').replaceChildren(el('option', { value: 'cycle', textContent: 'Cykl (dwie fazy)' }), ...Object.entries(SIGNAL_STATES).map(([k, v]) => el('option', { value: k, textContent: v })));
$('signal').value = S.signal; $('signal').onchange = () => { S.signal = $('signal').value; save(); };
$('weather').replaceChildren(...Object.entries(WEATHER).map(([k, w]) => el('option', { value: k, textContent: w.label || k })));
$('weather').value = S.weather; $('weather').onchange = () => { S.weather = $('weather').value; sky(); save(); };
for (const k of ['sunEl', 'sunAz']) { $(k).value = S[k]; $(k + 'V').textContent = S[k] + '°'; $(k).oninput = () => { S[k] = +$(k).value; $(k + 'V').textContent = S[k] + '°'; sky(); save(); }; }
function sky() { stage.setSky({ weather: S.weather, sunEl: S.sunEl, sunAz: S.sunAz }); }
addEventListener('keydown', (e) => { if (e.code === 'KeyH' && !e.target.closest('input,select,textarea')) document.querySelectorAll('[data-window]').forEach((p) => p.classList.toggle('hidden-panel')); });

/* ---------------- kamera ---------------- */
const orbit = { target: new THREE.Vector3(0, 0, 0), dist: 45, yaw: 0.7, pitch: 0.45 };
const CAMS = { Orbita: { yaw: 0.7, pitch: 0.45, dist: 45 }, Pieszy: { yaw: 0.25, pitch: 0.03, dist: 9 }, 'Z góry': { yaw: 0, pitch: 1.45, dist: 70 }, Kierowca: { yaw: Math.PI / 2, pitch: 0.06, dist: 16 } };
$('cams').replaceChildren(...Object.entries(CAMS).map(([k, v]) => { const b = el('button', { type: 'button', textContent: k }); b.onclick = () => Object.assign(orbit, v); return b; }));
function frame0() {
  if (SCENES[S.scene].viaduct) { Object.assign(orbit, { dist: 120, yaw: 0.65, pitch: 0.3 }); orbit.target.set(0, 3, 5); return; }
  if (SCENES[S.scene].footbridge) { Object.assign(orbit, { dist: 34, yaw: 0.75, pitch: 0.22 }); orbit.target.set(2, 3, 0); return; }
  if (SCENES[S.scene].tunnel) { Object.assign(orbit, { dist: 70, yaw: 1.05, pitch: 0.28 }); orbit.target.set(30, 6, 0); return; }
  if (SCENES[S.scene].parking) { Object.assign(orbit, { dist: 30, yaw: 0.45, pitch: 0.42 }); orbit.target.set(-24, 0.5, 0); return; }
  if (SCENES[S.scene].barriers) { Object.assign(orbit, { dist: 34, yaw: 0.35, pitch: 0.16 }); orbit.target.set(0, 1.5, 0); return; }
  if (SCENES[S.scene].furniture) { Object.assign(orbit, { dist: 26, yaw: 0.25, pitch: 0.12 }); orbit.target.set(-12, 2.5, 3); return; }
  if (SCENES[S.scene].signals) { Object.assign(orbit, { dist: 13, yaw: -1.25, pitch: 0.12 }); orbit.target.set(0, 2.2, 0); return; }
  orbit.dist = SCENES[S.scene].crossing ? 60 : 50; orbit.target.set(0, 0, 0);
}
const cv = renderer.domElement; let drag = null;
cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; orbit.yaw -= dx * 0.005; orbit.pitch = Math.max(0.01, Math.min(1.52, orbit.pitch + dy * 0.004)); });
cv.addEventListener('pointerup', () => { drag = null; });
cv.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.min(300, Math.max(2, orbit.dist * Math.exp(e.deltaY * 0.0011))); }, { passive: false });

function loop() {
  const t = performance.now() / 1000;
  for (const { tl, phase } of lights) tl.set(S.signal === 'cycle' ? signalAt(t, SIGNAL_TIMES, phase) : S.signal, t);
  const night = S.lampsOn === 'on' || (S.lampsOn === 'auto' && S.sunEl < 4);
  for (const L of lamps) if (L.lit !== night) { L.on(night); L.lit = night; }
  if (lights.length && $('sigNow')) $('sigNow').textContent = lights.map((x) => SIGNAL_STATES[x.tl.state]).filter((v, i, a) => a.indexOf(v) === i).join(' · ');
  const c = Math.cos(orbit.pitch);
  camera.position.set(orbit.target.x + Math.sin(orbit.yaw) * c * orbit.dist, orbit.target.y + 1.6 + Math.sin(orbit.pitch) * orbit.dist, orbit.target.z + Math.cos(orbit.yaw) * c * orbit.dist);
  camera.lookAt(orbit.target.x, orbit.target.y + 1, orbit.target.z);
  stage.follow(orbit.target, 70);
  stage.render();
  requestAnimationFrame(loop);
}

// StreetsApi.scene(id), set({ profile, lanes, laneW, road, marks, walkW, curbH, walk, corner }), profiles, surfaces
window.StreetsApi = {
  scenes: Object.fromEntries(Object.entries(SCENES).map(([k, v]) => [k, v.label])), profiles: Object.fromEntries(Object.entries(PROFILES).map(([k, v]) => [k, v.label])), surfaces: Object.keys(SURFACES),
  scene(id) { $('scene').value = id; $('scene').onchange(); return { ...S }; },
  set(o = {}) { if (o.profile) { S.profile = o.profile; fromProfile(); } for (const k of Object.keys(o)) if (k in S && k !== 'profile') S[k] = o[k]; show(); rebuild(); return { ...S }; },
  camera(name) { if (CAMS[name]) Object.assign(orbit, CAMS[name]); },
  view(target = [0, 0, 0], dist = 20, yaw = 0.5, pitch = 0.2) { orbit.target.set(...target); Object.assign(orbit, { dist, yaw, pitch }); },
  signal(mode) { S.signal = mode; $('signal').value = mode; return lights.map((x) => x.tl.state); },
};

sky(); show(); rebuild(); frame0();
requestAnimationFrame(loop);
