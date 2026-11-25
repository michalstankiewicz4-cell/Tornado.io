# Laboratorium mechaniki

`labs/mechanics.html`, skrypt `js/labs/mechanics/mechanics.js`, modele MechKit `js/models/mech/mechkit.js`, napęd
`js/behaviors/mech/drive.js` (środowisko ląd).

Kategoria 1 — **transmisja ruchu**. Dwa tryby (przełącznik na pasku):

## Przedmioty

Każdy przedmiot osobno na stole (na statywie z czopem wzdłuż osi obrotu; silnik i oprawa łożyska — na blacie). Okno
**Przedmioty** — wybór, okno **Ustawienia** — parametry przedmiotu i prędkość obrotu podglądu, okno **Element** —
wyliczone dane, ostrzeżenia i porty. Katalog: `js/labs/mechanics/items.js` (`ITEMS`: `params` i `build(p)`).

| Przedmiot | Ustawienia | Ostrzeżenia |
| --- | --- | --- |
| Zębatka walcowa | zęby, moduł, kąt przyporu, szerokość, otwór, materiał, otwory odciążające, piasta | podcięcie stopy (z < 2/sin²α), za duży otwór |
| Para zębatek | zęby obu kół, moduł, szerokość, materiał koła | — (przełożenie, odległość osi, wskaźnik przyporu) |
| Przekładnia planetarna | zęby słonecznego i satelitów, liczba satelitów, moduł, szerokość | warunek montażu (zs + zr)/n, kolizja satelitów |
| Koło koronowe | zęby, moduł, szerokość, wieniec, materiał | — |
| Koło łańcuchowe | zęby, łańcuch 06B / 08A / 10A / 12A, materiał | mniej niż 13 zębów (efekt wielokąta) |
| Napęd łańcuchowy | zęby obu kół, łańcuch, odległość osi | — (liczba ogniw parzysta, odległość dobrana) |
| Koło pasowe | średnica, profil SPZ / SPA / SPB, liczba rowków, materiał | średnica poniżej zalecanej |
| Napęd pasowy | średnice, profil, liczba pasów, odległość osi | kąt opasania poniżej 120° |
| Wał | długość, średnica, materiał, rowek wpustu | — |
| Łożysko w oprawie | otwór (UCP204–208), wysokość osi | — |
| Sprzęgło kłowe | średnica, gwiazda (92 Sh A, 98 Sh A, 64 Sh D) | — |
| Sprzęgło kołnierzowe | średnica, liczba śrub | — |
| Przegub Cardana | kąt łamania, podwójny (układ Z) | — (przełożenie chwilowe na żywo) |
| Silnik elektryczny | moc 0,18–7,5 kW (wielkość IEC), bieguny, kolor | — |
| Hamulec tarczowy | średnica, grubość, otwory | — |
| Wyłącznik | rodzaj (krzywkowy, główny, dźwigniowy), bieguny, prąd | — (stan 0 / I na żywo) |
| Potencjometr | rezystancja, charakterystyka (B / A), kolor pokrętła | — (położenie, napięcie suwaka) |
| Przycisk 22 mm | kolor, chwilowy / z podtrzymaniem, styk NO / NC, podświetlenie, grzybkowy | — (styk na żywo) |
| Falownik z pokrętłem | moc, częstotliwość maks., rampa, bieguny silnika | — (zadana i wyjściowa Hz, U/f, obroty) |
| Grzybek bezpieczeństwa | styki (1 NC, 2 NC, 1 NC + 1 NO) | — (zatrzaśnięty / zwolniony) |
| Lampka sygnalizacyjna | kolor, zasilanie 24 V / 230 V | — (świeci / zgaszona) |
| Przełącznik wyboru | pozycje 0–I / I–0–II, powrót sprężyną, rączka | — (pozycja, styki) |
| Wyłącznik krańcowy | dźwignia z rolką / popychacz | — (najechany, styki NO / NC) |
| Stycznik | prąd AC-3, cewka, styk pomocniczy | — (cewka, styki główne i pomocniczy) |
| Przewód | przekrój, kolor izolacji, długość | — (rezystancja, obciążalność, spadek napięcia) |
| Źródło zasilania AC (umowne) | fazy, napięcie, częstotliwość, prąd maks. | — (wyjście, napięcie szczytowe) |
| Źródło zasilania DC (umowne) | napięcie, prąd maks. | — (wyjście) |

Grupa **Sterowanie** obsługiwana jest na modelu: klik — dźwignia, przycisk, RUN / STOP; przeciąganie w górę / w dół —
pokrętło (części z `userData.control`, modele w `js/models/mech/controls.js` z `api.press / release / drag / tick`).

## Maszyna

Jedna maszyna na żeliwnym łożu, złożona z elementów połączonych portami:

1. silnik indukcyjny 1,1 kW (falownik — prędkość z suwaka) → sprzęgło kłowe z gwiazdą z poliuretanu → wał 1,
2. para zębatek 20 : 40 (moduł 4, zarys ewolwentowy, α = 20°; mała ze stali, duża z mosiądzu),
3. przekładnia dwustopniowa współosiowa 16 : 48 i 24 : 40 (moduł 3) w obudowie z akrylu na profilach 20 × 20,
4. łańcuch rolkowy 08A (podziałka 12,7 mm) na kołach 18 i 27 zębów — odległość osi dobrana do parzystej liczby ogniw,
5. pas klinowy SPA na kołach Ø 160 i Ø 80 (żeliwo, rowek 36°),
6. sprzęgło kołnierzowe sztywne, wał przegubowy z dwoma przegubami Cardana (25°, układ Z),
7. przekładnia planetarna: słoneczne 24, 3 satelity 24, korona 72 (stała) — i = 4,
8. hamulec tarczowy i tarcza z podziałką na wale wyjściowym.

Suwaki na pasku: **Silnik** (obr/min, od zera), **Hamulec** (N·m na wyjściu), **Obudowy** (przezroczystość akrylu).
Kliknięcie elementu (albo nazwy w oknie Napęd) — okno **Element**: właściwości (wymiary, materiał, masa, bezwładność),
prędkość, kierunek, moment, moc, sprawność od silnika i **porty** — z czym każdy jest połączony, wejście czy wyjście.
Kamera: przeciągnij — obrót, kółko — odległość, W A S D — przesuwanie; przyciski stanowisk w oknie Kamera.

## Elementy i porty

Każdy element ma właściwości i porty (`ports: [{ id, name, kind }]`). Połączenie łączy port jednego elementu z portem
drugiego i ma rodzaj:

| Połączenie | Związek kątów | Sprawność |
| --- | --- | --- |
| wał, sprzęgło | ten sam kąt | 1 / 0,995 |
| zazębienie | θb = −(za/zb)(θa − ψ) + ψ + π + π/zb (ψ — kierunek osi b od osi a: ząb a naprzeciw wrębu b) | 0,98 |
| łańcuch, pas | θb = θa · za/zb (ten sam kierunek; pas skrzyżowany — przeciwny) | 0,97 / 0,95 |
| przegub Cardana | z geometrii: sworzeń b ⟂ sworzeń a i ⟂ osi b — przełożenie zmienia się w czasie obrotu | 0,99 |
| przekładnia planetarna | θjarzma = θsłonecznego · zs/(zs + zr) (Willis, korona stała) | 0,97 |

Napęd przechodzi graf od silnika; część osiągnięta dwiema drogami jest sprawdzana — gdy przełożenia się nie zgadzają,
mechanizm jest zakleszczony i stoi. Prędkość każdej części to pochodna jej kąta po kącie silnika (różnica centralna),
więc działa też dla połączeń o zmiennym przełożeniu.

## Dynamika

Silnik: moment proporcjonalny do poślizgu (prędkość synchroniczna z falownika), ograniczony do 18 N·m. Bezwładność
zredukowana na wał silnika J = Σ Jᵢ·(ωᵢ/ω_s)² (masy i bezwładności z wymiarów elementów). Hamulec obciąża wyjście;
moment przenoszony przez element wynika z mocy hamulca i sprawności połączeń od tego elementu do wyjścia.

## MechKit

`gear` (zarys ewolwentowy, otwory odciążające, piasty), `ringGear`, `sprocket` (gniazda rolek wg ISO 606), `chainLoop`
(ogniwa jako instancje: rolki, płytki wewnętrzne i zewnętrzne, sworznie), `beltLoop` (przekrój SPA prowadzony po drodze,
nadruk przesuwany teksturą), `loopPath` (droga wokół dwóch kół: styczne i łuki), `chainDistance`, `pulley`, `shaft`
(z rowkiem wpustu — widać obrót), `pillowBlock` (oprawa UCP, wysoka — na słupku), `jawCoupling`, `flangeCoupling`,
`yoke`, `cross`, `motor`, `housing`, `tubeHousing`. Materiały z MatKit: stal szlifowana, stal ulepszona, mosiądz, stal
czerniona, żeliwo, aluminium, farba; akryl i guma jako materiały Three.js.

## API (`window.MechanicsApi`)

`mode('items' | 'machine')`, `item(id, ustawienia)`, `items()`, `control(nazwa, 'press' | 'release' | dy)`, `rpm(v)`, `brake(N·m)`, `alpha(0–1)`, `state()`, `elements()`, `select(id)`, `view(cel, odległość, yaw, pitch)`,
`run(sekundy)`, `drive`.
