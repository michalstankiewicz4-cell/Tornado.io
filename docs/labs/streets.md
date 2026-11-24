# Laboratorium ulic (`labs/streets.html`)

Próbki tras z **StreetKit** (`js/models/streets/streetkit.js`), żeby było widać, jak będą wyglądać ulice, chodniki
i drogi. Strona `js/labs/streets/streets.js`.

## StreetKit

Trasa = przekrój prowadzony po linii (krzywa Catmulla–Roma przez punkty `[[x, z], …]`). Przekrój to pasy od osi na
zewnątrz, po obu stronach: jezdnia (`lanes` × `laneW`, opcjonalnie pas dzielący `median`), potem `strips`:
krawężnik, chodnik, droga dla rowerów, zieleń, pobocze z kruszywa, obrzeże — każdy z szerokością `w`, wysokością `h`
(nad jezdnią) i nawierzchnią `s`. Lica krawężników tam, gdzie zmienia się wysokość.

| Przekrój (`PROFILES`) | Co to |
|---|---|
| `city` | ulica miejska: 2 × 3,25 m, oś przerywana, krawężnik 14 cm, chodnik z płyt 2,5 m, zieleń |
| `avenue` | aleja: dwie jezdnie po 2 pasy, pas dzielący z trawnikiem, chodnik z kostki, droga dla rowerów, chodnik z płyt |
| `village` | droga wiejska: stary asfalt, pobocza z kruszywa, rów z trawą |
| `path` | ścieżka z kruszywa z obrzeżem |
| `cycle` | droga dla rowerów z czerwonej kostki i chodnik |

Nawierzchnie (`SURFACES`): asfalt, asfalt stary, kostka, kostka czerwona, kruszywo, krawężnik granitowy, trawnik (MatKit)
i **płyty chodnikowe** z własnego generatora tekstur (`SLABS`: prawdziwe kwadraty ze spoinami, odcień każdej płyty,
wypukłości w mapie wysokości) — wersje do wyboru: 50 × 50 szare, 35 × 35, 30 × 30 grafitowe, 50 × 50 stare (spękane,
przekrzywione, z mchem w spoinach), 50 × 50 szachownica, 100 × 50 granitowe (na mijankę), płyty z wypustkami dla
niewidomych (żółte), trylinka (sześciokąty z otworami).

## Sygnalizator

`buildTrafficLight({ arm, height, backplate })` — słup ocynkowany (albo z wysięgnikiem nad jezdnię, w −x: słup po prawej
stronie jezdni), komora z soczewkami 300 mm (czerwone, żółte, zielone), daszki, tarcza z białą obwódką; przód +z.
`set(stan)`: `red`, `redYellow`, `green`, `yellow`, `yellowBlink`, `off`. Cykl jak w Polsce (`signalAt(t, SIGNAL_TIMES,
przesunięcie)`): zielone 20 s → żółte 3 s → czerwone → czerwone z żółtym 1,5 s; dwie fazy na przemian (faza B przesunięta
o `SIGNAL_TIMES.half`) z 2 s, gdy wszędzie jest czerwone. Oznakowanie poziome: linie ciągłe, przerywane, przejścia dla pieszych (zebra), linie zatrzymania.

```js
import { buildStreet, buildCrossing, PROFILES } from '../js/models/streets/streetkit.js';
scene.add(buildStreet([[-40, 0], [0, 10], [40, 0]], PROFILES.city).group);
scene.add(buildCrossing('city', { arms: 4, arm: 30, corner: 6 }).group);   // 3 wloty — skrzyżowanie T
```

## Latarnie i znaki

`buildLamp(type)` — latarnie (`LAMPS`): **modern** (współczesna LED, słup ocynkowany 8 m z wysięgnikiem), **double**
(dwa wysięgniki, 9 m — aleja, pas dzielący), **park** (stylizowana parkowa, żeliwny słup 4 m z latarnią, ciepłe
światło), **old** (stara betonowa 9 m z oprawą sodową, pomarańczowe światło). `on(true)` zapala: oprawa świeci,
światło pada w dół na ulicę (bez cieni — latarni bywa dużo). Przód oprawy: +z (do jezdni).

`buildSign(id)` — polskie znaki drogowe (`SIGNS`), tarcze rysowane na płótnie, tył szary, słupek ocynkowany: A-7 ustąp
pierwszeństwa, A-16 przejście dla pieszych, A-17 dzieci (ostrzegawcze: żółte tło, czerwona obwódka); B-1, B-2 zakaz
wjazdu, B-20 STOP, B-33 ograniczenie 50, B-36 zakaz zatrzymywania; C-12 ruch okrężny, C-13 droga dla rowerów; D-1 droga
z pierwszeństwem, D-6 przejście dla pieszych, D-18 parking.

`alongStreet(points, every, offset)` — miejsca co `every` m wzdłuż trasy, odsunięte od osi, z obrotem przodem do osi.

## Słupki, barierki, ekrany dźwiękochłonne

Wzdłuż linii trasy, przy odsunięciu od osi: `buildBollards(points, type, { offset, every, y })` — `BOLLARDS`: stalowy
blokujący (Ø 114 mm, 1 m, pasy odblaskowe), żeliwny grafitowy, betonowy walec (Ø 0,6 m), prowadzący U-1a;
`buildRail(points, type, { offset, y })` — `RAILS`: ochronna U-12a (czerwono-biała, 1,1 m), miejska grafitowa
z prętami, bariera energochłonna (prowadnica falista na słupkach co 2 m, od strony jezdni);
`buildNoiseWall(points, type, { offset, height, y })` — `NOISE`: kasety pochłaniające, przezroczysty PMMA z pasami
przeciw ptakom, kasety z przeszkleniem u góry; cokół betonowy 0,5 m, słupy HEB 200 co 4 m. Słupki i słupy to
`InstancedMesh`. W oknie Wyposażenie: słupki i barierka przy krawężniku, ekrany za ostatnim pasem przekroju (rodzaj,
wysokość 2–6 m) — na próbkach z jedną linią trasy.

## Wiadukty

Trasa może mieć wysokość: punkty `[x, z, y]`. `buildViaduct(points3, profile, { pierEvery, deck, fillBelow, avoid })` —
pomost z przekrojem `VIADUCT_PROFILE` (dwa pasy 3,5 m, krawężnik, wąski chodnik), płyta pomostu 1,3 m (spód i boki
z betonu), bariery betonowe z poręczą stalową, a pod spodem: nasyp ze skarpami 1 : 1,5 (darń) tam, gdzie pomost jest
niżej niż `fillBelow` (5 m), ściany przyczółków na przejściu i filary z oczepem (dwa słupy Ø 1,2 m) co `pierEvery` m
wyżej; `avoid(x, z)` — gdzie nie stawiać filarów (jezdnia pod wiaduktem).

## Próbki

Prosta ulica, łuk, skrzyżowanie (4 wloty, sygnalizatory na wlotach), skrzyżowanie T, aleja, droga wiejska, ścieżka,
słupki, barierki i ekrany, wiadukt prosty (nad ulicą), wiadukt na łuku (estakada), łącznica (zjazd po pętli), sygnalizator (na słupie i na
wysięgniku), latarnie i znaki (wszystkie rodzaje), droga dla rowerów. Okno Sygnalizacja:
cykl albo stały stan. Okno Wyposażenie: latarnie wzdłuż ulic (rodzaj, co ile, kiedy świecą — po zmroku, zawsze, nigdy),
znaki na skrzyżowaniach (D-6 przy przejściach, A-7 na bocznym wlocie skrzyżowania T). Okno
Przekrój: pasy, szerokość pasa, nawierzchnia jezdni, oznakowanie, szerokość i nawierzchnia chodnika, wysokość
krawężnika, promień łuku na skrzyżowaniu. Kamery: orbita, pieszy, z góry, kierowca.

Dla AI: `StreetsApi.scene(id)`, `set({ profile, lanes, laneW, road, marks, walkW, curbH, walk, corner })`, `camera(name)`,
`signal(tryb)` (`cycle` albo stan), `view([x, y, z], odległość, obrót, pochylenie)`.
