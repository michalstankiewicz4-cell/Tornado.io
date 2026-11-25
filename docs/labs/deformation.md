# Laboratorium deformacji

`labs/deformation.html`, skrypt `js/labs/deformation/deformation.js`, silnik DeformKit `js/deform/`.

Pięć stalowych beczek 200 l (JunkKit, `js/models/junkyard/items/barrel.js`) na jednej planszy: pionowo, ~23°, 45°,
~68° i bokiem. Pochylone stoją w kołyskach w kształcie L, leżąca między klinami — podpory trzymają beczkę, ale prasa
może ją zgnieść. Nad każdą beczką prasa (blok), suwak **Prasa** reguluje szybkość zgniatania od zera (cm/s),
**Od nowa** (R) przywraca beczki, **Podnieś prasy** (U) cofa prasy na górę (20 cm/s; beczki zostają zgniecione).
Prasa zatrzymuje się na podporach.

Kamera: przeciągnij — obrót, kółko — odległość, W A S D — przesuwanie. Kliknięcie beczki przykleja ją do kursora
(w górę podnosi), kolejne kliknięcie puszcza.

## Kontener

Przełącznik **Plansza | Kontener** na pasku. Kontener bez dachu (wnętrze 2,2 × 1,3 m, ściany 1,6 m, na dwóch płozach)
z siedmioma beczkami w dwóch warstwach: dwie stojące, leżąca w poprzek, leżąca wzdłuż, stojąca; na górze leżąca na
stojących i pochylona — zaczynają nieco wyżej, spadają i układają się same. Jedna prasa na cały kontener zjeżdża do
8 cm nad dno. Suwak **Ściany** ustawia przezroczystość kontenera (od 0 — niewidoczne ściany).

Beczki odpychają się cząstkami (DeformKit `others`). Ich siatka fizyczna jest cofnięta o promień styku (2,5 cm), więc
osadzony model dotyka sąsiada blachą. W kontenerze plastyczność działa też wtedy, gdy prasa naciska przez inne beczki.

## Model i deformacja są osobno

Beczka to zwykły model JunkKit — nie wie o deformacji. DeformKit tylko się do niego podpina:

```js
const model = barrel.build(0, wariant);                  // czysty model — w grze wystarczy, gdy deformacja niepotrzebna
const shell = createShell([siatkaFizyczna], { mass: 18, worker: true });
shell.embed(model);                                       // od teraz siatki modelu idą za powłoką
shell.step(dt, { ground: 0, boxes: [prasa, ...podpory] });
```

Bez `createShell` model zostaje sztywny i nic nie kosztuje.

## DeformKit (`js/deform/`)

- `shell-core.js` — obliczenia bez Three.js: powłoka PBD (position based dynamics) na zgrubnej siatce (beczka: 32 × 16
  + wieka). Więzy: krawędzie (rozciąganie), pary naprzeciw krawędzi i cięciwy przez wierzchołek (zginanie). Plastyczność:
  nadmiar odkształcenia ponad granicę przechodzi w nową długość spoczynkową — tylko przy docisku prasą. Utrzymanie
  kształtu (`shape`): cząstki ciągnięte do kształtu spoczynkowego przesuniętego i obróconego jak beczka — bez tego
  powłoka uginała się pod własnym ciężarem; przy docisku odchyłka ponad `yieldShape` (4 mm) zmienia kształt
  spoczynkowy. Chwyt (`pin`): wybrane cząstki ciągnięte do punktu. Zderzenia z
  gruntem i prostopadłościanami (`makeBox`) z tarciem. Spoczynek po 0,5 s bez ruchu.
- `shell.js` — `createShell`, `makeBox`, `embed` (siatki do rysowania osadzone na trójkątach siatki fizycznej:
  współrzędne barycentryczne i odsunięcie wzdłuż normalnej).
- Zderzenia między powłokami: `step(dt, { others: [cząstki sąsiadów] })` — każda powłoka odsuwa swoje cząstki o
  połowę wcisku (stan sąsiadów z poprzedniego kroku, siatka haszowana).
- `shell-worker.js` — `worker: true`: każda powłoka w swoim wątku, liczą się równolegle; wynik w następnej klatce.

## API (`window.DeformationApi`)

`speed(cm/s)`, `lift()`, `scene('board' | 'container')`, `alpha(0–1)`, `reset()`, `state()`, `run(sekundy) → Promise`, `view(cel, odległość, yaw, pitch)`, `rigs`.

Ciśnienie powietrza w beczce nie jest liczone.
