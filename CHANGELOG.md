# Zmiany

## 0.9.0 — 2026-11-24
- Laboratorium ulic 0.5.0: słupki (stalowe, żeliwne, betonowe, prowadzące U-1a), barierki (U-12a, miejska
  grafitowa, bariera energochłonna) i ekrany dźwiękochłonne (kasety, przezroczyste, mieszane) — próbka i opcje
  w oknie Wyposażenie.

## 0.8.0 — 2026-11-24
- Laboratorium ulic 0.4.0: wiadukty — prosty nad ulicą, na łuku (estakada) i łącznica zjeżdżająca pętlą; trasy
  z wysokością w StreetKit, pomost z barierami i poręczą, nasypy ze skarpami, przyczółki, filary z oczepem.

## 0.7.0 — 2026-11-24
- Laboratorium ulic 0.3.0: latarnie (współczesna LED, podwójna, parkowa stylizowana, stara betonowa z sodówką) —
  po zmroku świecą i oświetlają ulicę; polskie znaki drogowe (A-7, A-16, A-17, B-1, B-2, B-20, B-33, B-36, C-12, C-13,
  D-1, D-6, D-18); próbka „Latarnie i znaki”, okno Wyposażenie (latarnie wzdłuż ulic, znaki na skrzyżowaniach).

## 0.6.0 — 2026-11-24
- Laboratorium ulic 0.2.0: wersje płyt chodnikowych do wyboru (50 × 50, 35 × 35, 30 × 30 grafitowe, stare spękane,
  szachownica, 100 × 50 granitowe, z wypustkami dla niewidomych, trylinka) — własny generator tekstur w StreetKit.
- Sygnalizator świetlny (czerwone, żółte, zielone) na słupie i na wysięgniku; cykl jak w Polsce, dwie fazy na
  skrzyżowaniach, żółte migające; próbka „Sygnalizator” i okno Sygnalizacja.

## 0.5.0 — 2026-11-24
- Laboratorium ulic 0.1.0 (`labs/streets.html`) i StreetKit (`js/models/streets/streetkit.js`): trasy z przekroju po
  linii — ulica miejska, aleja z dwiema jezdniami, droga wiejska, ścieżka, droga dla rowerów; łuki, skrzyżowania
  (4 i 3 wloty) z łukami krawężników, przejściami dla pieszych i liniami zatrzymania; nawierzchnie z MatKit.

## 0.4.1 — 2026-11-24
- C — kamera przesunięta strzałkami wraca nad trąbę.

## 0.4.0 — 2026-11-24
- Pożary. Wygląd: FireKit z laboratorium efektów GameLaboratory (`js/render/effects/fire/firekit.js`, kopia) — płomienie
  w barwach temperatury, dym i iskry według paliwa, światło ognia. Rozprzestrzenianie: DestructKit
  (`js/destruct/burn.js`) — palą się tylko materiały palne: deski, stropy drewniane, belki, ramy okien, drzwi, papa,
  gazety, kartony, opony, drewniane odłamki, drzewa, trawa i zboże (wierzchołki terenu); ciepło przechodzi na palne
  rzeczy obok (z wiatrem szybciej), spalone części czernieją, tracą wytrzymałość i rozpadają się, papier znika,
  drzewa zostają czarne, wypalona ziemia ciemnieje.
- Prawy przycisk myszy (kliknięcie): podpalenie w celu; przeciągnięcie prawym nadal obraca kamerę.
- Strzałki przesuwają kamerę (trąba tylko na W A S D).

## 0.3.1 — 2026-11-24
- Okna i panele domyślnie zamknięte (OPCJE → Okna), konsola też; własne klucze zapisu (`tornado.windows:*`,
  `tornado.console`, `tornado.viewfit`) — wcześniej wspólne z GameLaboratory na tej samej domenie.

## 0.3.0 — 2026-11-24
- Miasto z laboratorium miasta GameLaboratory (CityKit, OpenStreetMap): Pałac Kultury (pl. Defilad 1), Złota 44,
  Emilii Plater 49, Chmielna 69, Al. Jerozolimskie 54, rondo ONZ 1, Twarda 2/4, pl. Europejski 1, Chłodna 51 —
  w układzie jak w mapie (na zachód od Pałacu), odległości ściśnięte do 70 %. Wygląd: model z laboratorium (wersja
  z wypalonymi fasadami); te same dane przeliczone na części (`js/models/houses/landmark-house.js`) czekają ukryte
  i zastępują model przy pierwszym uszkodzeniu. Plac z płyt betonowych, drzewa i śmieci w mieście.
- Moje budynki miasta (HouseKit `pkin`, `tower`, `highrise`) ukryte w grze (`OWN_CITY = false`), zostają w kodzie
  i w laboratorium zniszczeń.
- DestructKit: budynki ukryte do pierwszego uszkodzenia (`hidden`, `onReveal`), materiały rejestrowane z zewnątrz.
- Laboratorium zniszczeń 0.3.0: budynki Warszawy z mapy na liście.
- GitHub Pages: `upload-pages-artifact@v4` (z `deploy-pages@v5` v3 nie działał), `checkout@v5`.

## 0.2.0 — 2026-11-24
- Miasto na wschodzie mapy: Pałac Kultury i Nauki (człony tarasowe, wieżyczki, iglica do 237 m), trzy szklane
  wieżowce biurowe (betonowy rdzeń, słupy, stropy, ściana osłonowa) i cztery wieżowce mieszkalne; plac, aleje drzew.
- HouseKit: rodzaje `tower`, `highrise`, `pkin`; ściany bez ram okien (wysokie budynki), ściana osłonowa, słupy
  o dowolnym kształcie; materiały: okładzina ceramiczna, szkło fasadowe, panel aluminiowy, kratownica stalowa.
- Trąba rośnie wolniej: R = 1,2 + 1,0 · ∛V (było 1,6).
- Laboratorium zniszczeń 0.2.0: nowe budynki, większy grunt.

## 0.1.0 — 2026-11-24
- Gra: wioska wzdłuż polnej drogi (20 budynków, ok. 170 drzew, ok. 600 przedmiotów), trąba gracza: zjada małe
  i średnie lekkie rzeczy i rośnie, cięższe nosi w wirze i rzuca nimi w cel, wiatr niszczy budynki według materiału.
- Laboratorium zniszczeń 0.1.0: budynki z części (dom z cegły, „kostka”, stodoła, garaż, szopa, blok), pękanie
  według materiału, statyka, odłamki, uderzenie, rzut przedmiotem, trąba powietrzna; wioska.
- DestructKit, HouseKit; UI, SkyKit, MatKit, PlantKit, RockKit, JunkKit (przedmioty) skopiowane z GameLaboratory.
