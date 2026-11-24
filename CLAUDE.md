# Zasady pracy w Tornado.io

- Odpowiadaj po polsku.
- Nigdy nie dodawaj własnych pomysłów — tylko je proponuj; implementuj to, o co poproszono.
- Po każdym zadaniu: commit i push na `main` (jedyna gałąź; GitHub Pages wdraża ją sam — `.github/workflows/static.yml`).

## Co to jest

Gra przeglądarkowa: sterujesz małą trąbą powietrzną, która rośnie, gdy zjada rzeczy. Małe i średnie lekkie rzeczy
zjada (rośnie), średnie ciężkie podnosi i nosi w wirze — można nimi rzucać w budynki, które pękają tak, jak są
zbudowane (szyby, mury, dachówki, stropy). Mechanizm rozpadu (DestructKit) ma potem trafić do GameLaboratory.

## Skąd jest kod

- Kopiowany z GameLaboratory (kopie, nie linki): UI (`ui/`, `fonts/`), Three.js r186 (`vendor/three/`), niebo SkyKit
  (`js/envs/sky/skykit.js`), trąba (`js/envs/sky/tornado.js` — dopisane `rc`, `top`, `vmax` w `set()` i okrągły pył),
  potok kamery (`js/render/sea/look.js`), MatKit (`js/render/materials/`), PlantKit (`js/models/plants/plantkit.js`),
  RockKit (`js/models/rocks/`), ogień FireKit (`js/render/effects/fire/`), przedmioty JunkKit (`js/models/junkyard/items/`), CityKit z budynkami Warszawy
  z OpenStreetMap (`js/models/city/`, w tym `landmarks/` — Pałac Kultury i wieżowce).
- Nowe: DestructKit (`js/destruct/`), HouseKit (`js/models/houses/`), scena (`js/core/stage.js`), grunt i przedmioty
  (`js/world/`), gra (`js/game/`), laboratorium zniszczeń (`labs/destruction.html`, `js/labs/destruction/`),
  ulice StreetKit (`js/models/streets/`) i laboratorium ulic (`labs/streets.html`) — próbki, w grze jeszcze nieużyte.

## DestructKit — zniszczenie wynikające z budowy modelu

- Budynek = części (HouseKit): każda to wielokąt wypukły wyciągnięty na grubość, z materiałem i podporami.
- Materiał (`js/destruct/materials.js`) wybiera wzór pękania (`js/destruct/patterns.js`): mur — warstwy i cegły,
  beton — Woronoj, deski — wzdłuż słojów, szkło — promieniście, dachówka — rzędy, blacha — arkusze, belka — odcinki.
- Statyka: część stoi, dopóki stoi to, na czym się opiera (`need` — ułamek podpór); kawałki pękniętej części trzymają się,
  dopóki łączą się (wspólną krawędzią) z podporą. Część bez podparcia spada w całości i pęka o ziemię.
- Rysowanie: jeden BatchedMesh na materiał. Fizyka odłamków: `js/destruct/physics.js` (środowisko ląd).
- Budynki miasta w grze: wygląd z CityKit (laboratorium miasta), części do zniszczenia z tych samych danych
  (`js/models/houses/landmark-house.js`) ukryte do pierwszego uszkodzenia (`world.addHouse(…, { hidden: true })`).
  Własne budynki miasta HouseKit (`pkin`, `tower`, `highrise`) są w grze wyłączone (`OWN_CITY`), nie kasować.
- Pożary: wygląd FireKit (z GameLaboratory: `labs/effects-land.html` — zmiany ognia najpierw tam, potem kopia),
  rozprzestrzenianie `js/destruct/burn.js`. Palą się tylko materiały z polem `burn` (materials.js), palne przedmioty
  (`ITEM_BURN`), drzewa i trawa; niepalne nie przenoszą ognia.
- Nie poprawiamy wyglądu pojedynczych budynków ręcznie — poprawka idzie do wzoru albo do HouseKit, ogólnie.

## Wygląd

- Jeden wygląd: UI z GameLaboratory (ciemne szkło, złote nagłówki), tokeny w `ui/style/tokens.css`.
- Bez `<style>` i `style=` w stronach (CSP `style-src 'self'`); własne reguły strony w `ui/pages/<strona>.css`.
- Nowy CSS właściwościami logicznymi (`inset-inline-start`, `margin-inline-end`…).
- Grafika realistyczna: tekstury z MatKit, prawdziwe wymiary i masy (metry, kg).

## Wersje

- `ui/data/versions.js` (gra: `app`, laboratoria osobno), zmiany w `CHANGELOG.md`. x.y.z — y: funkcja, z: poprawka.
