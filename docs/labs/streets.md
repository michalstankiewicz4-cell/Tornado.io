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

Nawierzchnie (`SURFACES`, MatKit): asfalt, asfalt stary, płyty chodnikowe, kostka, kostka czerwona, kruszywo, krawężnik
granitowy, trawnik. Oznakowanie poziome: linie ciągłe, przerywane, przejścia dla pieszych (zebra), linie zatrzymania.

```js
import { buildStreet, buildCrossing, PROFILES } from '../js/models/streets/streetkit.js';
scene.add(buildStreet([[-40, 0], [0, 10], [40, 0]], PROFILES.city).group);
scene.add(buildCrossing('city', { arms: 4, arm: 30, corner: 6 }).group);   // 3 wloty — skrzyżowanie T
```

## Próbki

Prosta ulica, łuk, skrzyżowanie (4 wloty), skrzyżowanie T, aleja, droga wiejska, ścieżka, droga dla rowerów. Okno
Przekrój: pasy, szerokość pasa, nawierzchnia jezdni, oznakowanie, szerokość i nawierzchnia chodnika, wysokość
krawężnika, promień łuku na skrzyżowaniu. Kamery: orbita, pieszy, z góry, kierowca.

Dla AI: `StreetsApi.scene(id)`, `set({ profile, lanes, laneW, road, marks, walkW, curbH, walk, corner })`, `camera(name)`.
