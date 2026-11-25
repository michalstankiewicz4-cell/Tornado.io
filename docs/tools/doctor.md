# Doktor modeli (`tools/doctor.html`, `tools/doctor.py`)

Kopia doktora z GameLaboratory (`tools/doctor/modeldoctor.js`, wspólne `common.js`) z dwoma ulepszeniami ogólnymi
(do przeniesienia z powrotem do GameLaboratory):

- `opts.ground` — wysokość gruntu, na którym model stoi (ulice, wyposażenie, budynki): nikt nie ogląda go spod ziemi —
  `seethrough` pomija promienie, które najpierw trafiają w grunt, a `facing` liczy grunt jako trafienie promienia w dół;
- `floating` uwzględnia siatki powielane (`InstancedMesh` — słupki, pręty, stopnie): same nie są badane, ale łączą to,
  czego dotykają (wcześniej rury barierek „wisiały w powietrzu”, bo słupki były niewidoczne dla testu);
- `facing` zaczyna promienie najwyżej 1 cm od ściany (było 0,2 % modelu — na 40-metrowej ulicy 8 cm, więcej niż
  krawężnik).

Modele: `tools/doctor/sources.js` — StreetKit (wszystkie przekroje, skrzyżowania, sygnalizatory, latarnie, znaki, słupki,
barierki, ekrany, pikietaż, parkingi, wiadukty, tunele, rampa, kładki, przejście podziemne) i HouseKit (każda część
budynku jako osobna siatka, jak w DestructKit przed zniszczeniem).

Użycie: `python3 tools/doctor.py` (wszystkie), `python3 tools/doctor.py streets/` (wybrane); kod wyjścia 1 przy błędzie.
Modeli nie poprawiamy ręcznie pod doktora — poprawka idzie do budującego kodu (StreetKit, HouseKit), ogólnie.

## Modele Tornado.io w doktorze

`tools/doctor/sources.js`: ulice (`streets/…`), budynki HouseKit (`houses/…`), przedmioty laboratorium mechaniki
(`mech/…` — z katalogu `js/labs/mechanics/items.js`, ustawienia domyślne i warianty skrajne z `MECH_VARIANTS`) i beczka
z laboratorium deformacji (`deform/…`). Przedmioty w skali milimetrów mają `planeEps: 0.0002` (domyślne 0,01 m jest dla
ulic i budynków). Uruchomienie dla jednej rodziny: `python3 tools/doctor.py mech/`.
