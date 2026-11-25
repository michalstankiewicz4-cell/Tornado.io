# Zmiany

## 0.20.3 — 2026-11-25
- DeformKit: blacha nie przenika już prasy, a górne beczki dolnych. Przyczyna: gdy wątek beczki był zajęty, zaległe
  kroki liczyły się potem razem z ostatnim położeniem prasy i sąsiadów — prasa przeskakiwała kilka kroków naraz,
  blacha lądowała w jej środku i wychodziła najbliższą ścianą (także górą). Teraz każdy krok idzie do wątku z własnymi
  zderzaczami (`steps`), a `shell.pending` mówi, że krok jeszcze się liczy. W żywej pętli było do ~1000 cząstek w prasie,
  teraz 0.
- Laboratorium deformacji 0.3.3: nowy krok dopiero, gdy wszystkie beczki skończyły poprzedni (gdy wątki nie nadążają,
  symulacja zwalnia zamiast się rozjeżdżać). Beczki w kontenerze ustawiane bez wcisku: każda podnoszona, aż jest
  co najmniej 1 cm ponad stykiem z już postawionymi (pochylona zaczynała wciśnięta w stojącą i miała wgnieciony koniec).

## 0.20.2 — 2026-11-25
- DeformKit: zgniecione beczki nie drgają, nie kręcą się i nie pełzną. Przyczyną był konflikt dwóch pamięci kształtu:
  granica trwałego wydłużenia krawędzi (0.20.1) trzymała krawędzie krótsze, niż chciał zapamiętany kształt — stale
  rozciągnięte o ok. 30 %, drgały, a tarcie o grunt zamieniało to w ruch. Granica wyłączona (`stretchLimit: 0`, zostaje
  jako opcja); wyciskaniu w szczelinę zapobiega wyjście z prasy ścianą wejścia i wąska szczelina. Po zejściu z prasy
  kształt spoczynkowy przez 1 s dopasowuje się do odskoku blachy (`relax`). Przyciąganie do kształtu bez składowej
  obrotowej (nie może kręcić beczką). Prasa bez tarcia na ścianach bocznych — blacha zawinięta na krawędź nie jedzie
  już z prasą do góry i nie wisi w powietrzu.

## 0.20.1 — 2026-11-25
- DeformKit: blacha nie płynie już jak plastelina — trwałe wydłużenie lub skrócenie krawędzi najwyżej o 10 % długości
  pierwotnej (`stretchLimit`), dalej blacha tylko się gnie. Cząstka wciśnięta w bryłę wychodzi tą ścianą, którą weszła
  (wcześniej przy krawędzi prasy uciekała bokiem w szczelinę). Zderzenia z bryłami i gruntem liczone po odpychaniu
  między beczkami — sąsiad nie wpycha blachy w dno.
- Laboratorium deformacji 0.3.1: w kontenerze szczelina między prasą a ścianami 1,5 cm (była 5 cm); gęstsze wieka
  w siatce fizycznej beczek kontenera (co ok. 4 cm) — górna beczka nie przenika przez wieka stojących.

## 0.20.0 — 2026-11-25
- Laboratorium deformacji 0.3.0: kamera przesuwana klawiszami W A S D; kliknięcie beczki przykleja ją do kursora
  (punkt chwytu prowadzony po płaszczyźnie pionowej zwróconej do kamery — w górę podnosi), kolejne kliknięcie puszcza.
- DeformKit: beczki nie gną się już same pod własnym ciężarem (wcześniej w podporach pod 45° i 68° do 13 cm, pionowa
  i leżąca 2–3 cm — metoda była za miękka). Doszło utrzymanie kształtu (dopasowanie kształtu spoczynkowego: przesunięcie
  i obrót, `shape`), odkształcenie sprężyste do kilku milimetrów; przy docisku nadmiar ponad `yieldShape` (4 mm)
  zmienia kształt spoczynkowy na stałe — zgniatanie prasą bez zmian. Chwyt `pin` w kroku powłoki.

## 0.19.0 — 2026-11-25
- Laboratorium deformacji 0.2.0: przycisk **Podnieś prasy** (U) — prasy wracają na górę z prędkością 20 cm/s, beczki
  zostają zgniecione, suwak wraca na zero. Przełącznik scen **Plansza | Kontener**: kontener bez dachu (wnętrze
  2,2 × 1,3 m) z siedmioma beczkami w dwóch warstwach (stojące, leżące w poprzek i wzdłuż, górne spadają na dolne
  i układają się same), jedna prasa na cały kontener, suwak **Ściany** — przezroczystość kontenera.
- DeformKit: zderzenia między powłokami (`others` w kroku — cząstki sąsiednich beczek z poprzedniego kroku, siatka
  haszowana), plastyczność także przy nacisku przez inne beczki (`yield`), `shell.box()`; `settled()` czeka tylko na
  kroki zlecone do chwili wywołania.

## 0.18.0 — 2026-11-25
- Laboratorium deformacji 0.1.0 (`labs/deformation.html`, opis `docs/labs/deformation.md`): pięć stalowych beczek
  200 l (pionowo, ~23°, 45°, ~68°, bokiem) w podporach, nad każdą prasa; suwak szybkości zgniatania od zera.
- DeformKit (`js/deform/`): powłoka z blachy (PBD na zgrubnej siatce, zginanie, plastyczność przy docisku, zderzenia
  z gruntem i bryłami), siatki modelu osadzone na powłoce; każda powłoka w swoim wątku. Model zostaje osobno — bez
  DeformKit jest zwykłym, sztywnym modelem.

## 0.17.0 — 2026-11-25
- Drobny gruz na karcie graficznej (`js/destruct/chips.js`): przy pęknięciu części i rozbiciu spadającej sypią się
  okruchy (cegła, tynk, szkło, drzazgi — barwa z materiału, odcień budynku, zwęglenie). Lot liczy shader (rzut z oporem
  powietrza, obrót, leżenie na ziemi, zapadanie się pod koniec życia, 5–9 s); procesor zapisuje tylko start. Do 24 tys.
  okruchów naraz, jedno wywołanie rysowania. Tylko do oglądania — fizyczne odłamki bez zmian (trąba je je, uderzają,
  palą się). Laboratorium zniszczeń 0.3.2: też z gruzem.

## 0.16.0 — 2026-11-25
- Fizyka odłamków w osobnym wątku (Web Worker, `js/destruct/physics-worker.js`): krok brył (te same obliczenia
  `physics.js`) liczy się poza głównym wątkiem, wynik wraca w następnej klatce — to, co w międzyczasie zmienił główny
  wątek (prędkość od trąby, odbicie od muru), dodaje się do wyniku. Środowisko wątku: `js/game/physics-env.js` (grunt
  z `js/game/height.js`, wiatr trąby — stan wysyłany co klatkę). Bez wątku i w `TornadoApi.simulate` — krok na
  głównym wątku jak dotąd.
- Budynki Warszawy ukryte do pierwszego uszkodzenia nie zajmują pamięci karty (ok. 1 mln wierzchołków mniej na
  starcie): siatki ich części trafiają na kartę dopiero przy odsłonięciu, po kawałku (5 ms na klatkę), a do końca gra
  pokazuje model z laboratorium miasta; materiały (tekstury MatKit) przygotowane przy ładowaniu.

## 0.15.2 — 2026-11-25
- Wydajność pod GPU: batche budynków (DestructKit) bez odrzucania części poza kadrem na CPU — karta rysuje wszystkie
  widoczne kawałki (pętla po ~45 tys. częściach przy każdym przebiegu obrazu i cieni zeszła z ~4 ms do ~1 ms na klatkę;
  zostaje tylko sortowanie szkła); częściowe wysyłanie danych na kartę (`js/render/partial-upload.js`) — ruch odłamka,
  przedmiotu, wyrwanie i zwęglenie drzewa, spalona trawa wysyłają tylko zmienione macierze, barwy i wierzchołki zamiast
  całych buforów co klatkę.

## 0.15.1 — 2026-11-25
- Usunięte nieużywane budynki miasta HouseKit (`tower`, `highrise`, `pkin`) i ich kod w grze (`OWN_CITY`); w grze
  zostają domy HouseKit i budynki Warszawy z CityKit. Laboratorium zniszczeń 0.3.1: bez tych trzech rodzajów.

## 0.15.0 — 2026-11-24
- Doktor modeli (`tools/doctor.html`, `tools/doctor.py`, opis `docs/tools/doctor.md`): kopia z GameLaboratory
  z ulepszeniami ogólnymi (grunt `opts.ground`, siatki powielane w teście `floating`, promienie `facing` najwyżej 1 cm
  od ściany); bada wszystkie modele StreetKit i HouseKit — 0 błędów.
- StreetKit (laboratorium ulic 0.10.1), poprawki znalezione przez doktora: spód pomostu wiaduktu zwrócony w dół
  (spod wiaduktu prześwitywał), portal tunelu na wyjeździe zbudowany na lewą stronę i otwór portalu w płaszczyźnie
  obudowy, naroża skrzyżowań zamknięte od strony kwartału, krawężnik zewnętrzny i łuki krawężników sięgają pod
  nawierzchnię, zaślepione końce ekranów dźwiękochłonnych i murów rampy (ze stopą), słup latarni parkowej do kołnierza
  latarni (latarnia wisiała 30 cm nad słupem), soczewki i tarcza sygnalizatora, obejmy i tył znaków, głowica słupka
  kilometrowego, słupki poręczy wiaduktu, winda i przejście podziemne bez nakładających się ścian.

## 0.14.0 — 2026-11-24
- Laboratorium ulic 0.10.0: kładka ze schodami naprzemiennymi, przejście podziemne pod ulicą (klatki schodowe
  z attyką), tunel pod równym terenem (zjazd rampą między murami oporowymi, odcinek pod ziemią, wyjazd).

## 0.13.0 — 2026-11-24
- Laboratorium ulic 0.9.0: kładka dla pieszych nad ulicą — ze schodami oraz ze schodami i windą (przeszklone szyby).

## 0.12.0 — 2026-11-24
- Laboratorium ulic 0.8.0: tunele przez górę — łukowy (dwa pasy) i prostokątny dwukierunkowy 2 × 2 pasy ze słupami
  pośrodku; portale z ścianą czołową, okładziny, oświetlenie, dojazdy w przekopie.
- StreetKit: lica krawężników zwrócone do jezdni (wcześniej odwrócone — z drogi prześwitywał grunt), normalne ścian
  zgodne z kierunkiem lica (bariery wiaduktu, ekrany, cokoły — poprawne cieniowanie).

## 0.11.0 — 2026-11-24
- Laboratorium ulic 0.7.0: miejsca parkingowe — równoległe, skośne 60° i prostopadłe na pasie postojowym, miejsca
  dla osób z niepełnosprawnością (P-24, znak D-18 z tabliczką T-29); próbka i wybór w oknie Wyposażenie.

## 0.10.0 — 2026-11-24
- Laboratorium ulic 0.6.0: słupki połączone łańcuchem, ekrany dźwiękochłonne na wiaduktach (na koronie barier),
  słupki pikietażowe — hektometrowe co 100 m i kilometrowe (próbka i opcja w oknie Wyposażenie).

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
