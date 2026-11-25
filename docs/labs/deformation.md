# Laboratorium deformacji

`labs/deformation.html`, skrypt `js/labs/deformation/deformation.js`, silnik DeformKit `js/deform/`.

Pięć stalowych beczek 200 l (JunkKit, `js/models/junkyard/items/barrel.js`) na jednej planszy: pionowo, ~23°, 45°,
~68° i bokiem. Pochylone stoją w kołyskach w kształcie L, leżąca między klinami — podpory trzymają beczkę, ale prasa
może ją zgnieść. Nad każdą beczką prasa (blok), suwak **Prasa** reguluje szybkość zgniatania od zera (cm/s),
**Od nowa** (R) przywraca beczki. Prasa zatrzymuje się na podporach.

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
  nadmiar odkształcenia ponad granicę przechodzi w nową długość spoczynkową — tylko przy docisku prasą. Zderzenia z
  gruntem i prostopadłościanami (`makeBox`) z tarciem. Spoczynek po 0,5 s bez ruchu.
- `shell.js` — `createShell`, `makeBox`, `embed` (siatki do rysowania osadzone na trójkątach siatki fizycznej:
  współrzędne barycentryczne i odsunięcie wzdłuż normalnej).
- `shell-worker.js` — `worker: true`: każda powłoka w swoim wątku, liczą się równolegle; wynik w następnej klatce.

## API (`window.DeformationApi`)

`speed(cm/s)`, `reset()`, `state()`, `run(sekundy) → Promise`, `view(cel, odległość, yaw, pitch)`, `rigs`.

Ciśnienie powietrza w beczce nie jest liczone.
