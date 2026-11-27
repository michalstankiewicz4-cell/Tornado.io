# Zmiany

## 0.27.2 — 2026-11-27
- Przegub Cardana fizycznie (laboratorium mechaniki 0.12.2):
  - Sprawność zależna od kąta łamania (`drive.ujointEta`: straty łożysk igiełkowych krzyżaka, η = 1 − (2/π)·μ·(r_c/R)·
    (tg β + sin β) − 0,2 %) — dane w krzyżaku (`PHYS.ujoint`: μ, r_c, R); przy 25° 99,2 % na przegub.
  - Luz w łożyskach krzyżaka (luz promieniowy 20 µm → 0,088°) — strefa swobody wiązania w fizyce.
  - Kolizje widełek i krzyżaka w pełnym obrocie z brył modeli (`contact.js meshClash` — punkt w bryle zamkniętej,
    głębiej niż 0,3 mm) — w maszynie przy starcie, w przedmiocie przy każdym kącie; największy kąt łamania bez
    kolizji (połowienie przedziału): 45,9°. Okno Opis w trybie Fizyka i informacje przedmiotu.
- Poprawki znalezione kontrolą: widełki MechKit — ramię wchodziło w otwór oczka (w kubek łożyska), a przy 25° oczko
  drugich widełek wchodziło w piastę i mostek (ramię 50 → 70 mm); wał 9 zaczynał się w krzyżaku (teraz w piaście
  widełek).

## 0.27.1 — 2026-11-27
- Łożyska zamiast brył w uchwytach (laboratorium mechaniki 0.12.1, MechKit):
  - Oprawa UCP: wkładka łożyskowa z pierścieniami (zewnętrzny, poszerzony wewnętrzny z otworem na wał, uszczelnienia,
    wkręty) — wcześniej pełny walec, przez który przechodził wał.
  - Obudowa przekładni dwustopniowej: ścianki z otworami i oprawkami, w nich łożyska 6205-2RS (wcześniej pełne walce).
  - Przekładnia planetarna: satelity na łożyskach igiełkowych (gładki otwór — `gear({ key: false })`), dekle obudowy
    z łożyskami 6205-2RS; obudowa wydłużona (sworznie jarzma i tarcza nie trą o łożyska — kontrola zahaczeń).
  - Korbowód: oczka z tulejami z brązu; nakrętka śruby i kołnierz — pierścienie z otworem; oczka widełek przegubu
    Cardana — pierścienie z kubkami łożysk igiełkowych w otworze.
  - Wały: wpust tylko pod piastami (`shaft().setKeys`, laboratorium wylicza odcinki z połączeń) — łożyska obejmują
    gładki wał. `rollingBearing({ seal })` — uszczelnienia 2RS.
- Kontrola rolek łańcucha: faza łańcucha przy każdym kole z jego kąta (sprężyste wydłużenie cięgna nie daje
  fałszywego przenikania). Zacisk hamulca: mostek bez wspólnej płaszczyzny z obudowami klocków.

## 0.27.0 — 2026-11-27
- Laboratorium mechaniki 0.12.0 — plan, krok 1: **porty w danych modeli i ruch posuwisty**.
  - Porty z dziedziną i złączem w każdej części MechKit (`userData.ports`, `MechKit.DOMAIN`); `drive.connect` sprawdza
    złącza (`COMPAT`, zamiana ruchu `CONVERT`).
  - Napęd i fizyka: stopień swobody przesuwu (`dof: 'lin'`, współrzędna w metrach, J = masa), połączenia `rack`
    (koło ↔ listwa, faza z geometrii), `screw` (śruba ↔ nakrętka, gwint prawy / lewy), `crank` (korba → suwak, oba
    pierwiastki, ciągłość). Sprężyna szybsza niż krok liczona jak sztywna (stabilność).
  - Nowe części: listwa zębata (bryły zębów trapezowych — luz z brył jak w kołach), suwak w prowadnicy (z listwą),
    korbowód, śruba pociągowa (kulowa / trapezowa, czopy łożyskowe), nakrętka z wózkiem.
  - Maszyna i Fizyka: korba na tarczy z podziałką → korbowód → suwak z listwą → zębnik na śrubie kulowej Ø 20 × 20 →
    nakrętka (±13 mm). Okno Opis: położenia, prędkości, siły w korbowodzie i na nakrętce, luz listwy z brył.
  - Przedmioty: kategorie planu (1–5, puste — „w planie”), grupa „Zamiana ruchu” (listwa z zębnikiem, mechanizm
    korbowy, śruba pociągowa — sprawność, samohamowność), grupa „Łożyska” (kulkowe, walcowe, stożkowe, wzdłużne,
    igiełkowe, tuleja — nośność, trwałość L10, moment tarcia, prędkość graniczna, koszyk).
- Poprawka MechKit: oprawa łożyska (UCP) o innej średnicy niż 25 mm miała otwór przesunięty względem osi wału
  (kształt liczony z promieniem już przeskalowanym) — wykryte kontrolą zahaczeń.

## 0.26.2 — 2026-11-26
- Dane fizyczne i elektryczne przypisane do części (przygotowanie do przeniesienia do GameLaboratory):
  - MechKit: `userData.phys` (tabela `PHYS`: sztywność, tłumienie, sprawność, luz zęba, łańcuch, pas z napięciem
    i tarciem, przegub, przekładnia planetarna, łożysko), sztywność wału wg materiału (`G_MAT`), silnik
    `userData.elec` (`MOTOR_ELEC`), wspólna faza przekładni planetarnej `planetPhase()`.
  - ControlKit: `userData.elec` (tabela `ELEC`: stycznik, falownik, lampka; styki z numerami zacisków, źródło,
    wyłącznik, potencjometr).
  - `drive.js`: sprawność połączenia z danych części. Laboratorium mechaniki 0.11.1 i podgląd przedmiotów czytają
    dane z części — w laboratorium zostały tylko geometria połączeń i schemat instalacji (wyniki bez zmian:
    przełożenie 1 : 30, luz z brył, sprężystości). Poprawka: wejście sprzęgła kłowego (piasta na wale silnika) sztywne.

## 0.26.1 — 2026-11-26
- Laboratorium mechaniki 0.11.0 — praca i kierunek obrotów z kasety zamiast przycisków na falowniku: przełącznik S3
  I-0-II → wejścia cyfrowe falownika DI1 (w przód) / DI2 (wstecz), zasilane z jego 24 V DC (kabel W7 4×0,5, wejście
  aktywne ≥ 15 V). Falownik sterowany z zacisków (TERM): RUN i FWD / REV na panelu nie działają, STOP działa.
  Ochrona przed samoczynnym startem: po włączeniu zasilania albo STOP z panelu — dopiero po przestawieniu S3 na 0
  (wyświetlacz: BLOK). Okno Opis: położenie S3, napięcia DI1 / DI2, stan pracy. `MechanicsApi.circuit('dir', …)`.
- ControlKit: falownik `control('panel' | 'terminal')`, `inputs(DI1, DI2)`, rozruch 0,5 s po włączeniu zasilania;
  przełącznik wyboru I-0-II przechodzi zawsze przez 0 (nie przeskakuje z I na II), `pos` do ustawienia.

## 0.26.0 — 2026-11-26
- Laboratorium mechaniki 0.10.0 — tryb Fizyka, punkt 5: **obwód elektryczny** (`js/behaviors/mech/circuit.js`).
  - Instalacja przy silniku, obsługiwana na modelach: źródło X0 3 × 400/230 V (TN-S) → wyłącznik główny Q1 → stycznik
    K1 → falownik → silnik. Sterowanie 230 V: grzybek S0 (NC) → STOP S1 (NC) → START S2 (NO) ∥ podtrzymanie K1 13-14
    → cewka K1; lampka H1 „praca”; zadawanie potencjometrem R1 na wejście AI falownika (0–10 V = 0–50 Hz).
  - Obwód jako lista połączeń: sieci z zamkniętych styków i żył (union-find), fazory napięć źródła, wykrywanie zwarć,
    napięcia odbiorników; stycznik z progami zadziałania / odpadania i czasem 20 ms; falownik bez zasilania — silnik
    wybiega (fizyka: moment silnika 0).
  - Kable z przekrojem i długością (rezystancja żył → spadek napięcia), pobór falownika, prąd fazowy, napięcie U/f
    i prąd silnika w oknie Opis. `MechanicsApi.circuit()`.
- ControlKit: `cable()` (przewód wielożyłowy w powłoce z dławikami), stycznik `coil(v)`, lampka `power(v)`, falownik
  `power(v)`, `reference('panel' | 'ai')`, `ai(V)`. Fizyka: `step({ on })` — silnik bez zasilania.

## 0.25.4 — 2026-11-26
- Laboratorium mechaniki 0.9.0 — punkt 4, uzupełnienie brył zderzeń:
  - **Koła łańcuchowe**: zarys wg ISO 606 (gniazdo, kąt osadzenia, bok r_e, głowa d_a) z łuków, bryły zębów — części
    wypukłe (`MechKit.convexParts`: strzyżenie uszu + Hertel–Mehlhorn); rolki łańcucha jako walce; kontrola rolek
    z zębami na żywo.
  - **Koło koronowe**: bryły zębów wewnętrznych (`MechKit.ringHulls`); luz każdego satelity ze słonecznym i z koroną
    na żywo (ok. ±0,08 mm).
  - **Zahaczenia o obudowy i łożyska**: obrys obrotowy każdej części obrotowej a trójkąty części nieruchomych — raz
    przy starcie, ważne dla każdego kąta; zahaczające części podświetlone na czerwono w hitboksach.
  - `contact.js`: `contactPair` (zderzenie i odstęp dowolnych kół z części wypukłych, zazębienie zewnętrzne
    i wewnętrzne).
- Poprawki w generatorach (znalezione przez kontrole): korona przekładni planetarnej przesunięta o pół podziałki
  (zęby satelitów wchodziły w zęby korony) — MechKit.planetary i laboratorium; ogniwa łańcucha w gniazdach
  (`loopPath().seat`: przesunięcie ogniw, faza koła 2 — także w podglądzie przedmiotu); koło łańcuchowe wg ISO 606
  (rolki schodzące z koła wchodziły w zęby); hamulec tarczowy — zacisk okracza tarczę (dwie obudowy klocków, mostek
  nad krawędzią), laboratorium używa `MechKit.discBrake`, wspornik zacisku obok tarczy (przechodził przez nią).

## 0.25.3 — 2026-11-26
- Laboratorium mechaniki 0.8.0 — tryb Fizyka, punkt 4: **bryły zderzeń zębów**.
  - Ząb zębatki = wielokąt wypukły z zarysu modelu (`MechKit.toothHulls`), zderzenie zębów — osie rozdzielające (SAT)
    w płaszczyźnie obrotu (`js/behaviors/mech/contact.js`).
  - Strefa swobody zazębienia wychodzi ze zderzeń zębów (tabela po fazie koła, 48 próbek na podziałkę): wiązanie
    zazębienia ma granice zależne od kąta zamiast stałego ±luz/2. Luz z brył: 20 : 40 — 0,34–0,36 mm, 16 : 48 i 24 : 40
    — 0,25–0,26 mm; położenia nominalne bez przenikania (gdyby było — ostrzeżenie w konsoli i luz ze wzoru).
  - Hitboksy zębatek: bryły zębów, walec stóp i walce piast (także koło słoneczne i satelity przekładni planetarnej).
  - Okno Opis: luz każdego zazębienia z brył (teraz i zakres wzdłuż przyporu); Wydajność: liczba brył zębów.

## 0.25.2 — 2026-11-26
- Laboratorium mechaniki 0.7.0 — tryb Fizyka, punkt 3: **poślizg pasa, nierówny bieg łańcucha, straty tarcia**.
  - Pas SPA: moment graniczny z Eulera–Eytelweina (napięcie wstępne 2 × 300 N, μ 0,3 w rowku 36°, opasanie 169° →
    21,4 N·m), pełzanie sprężyste do 1,5 %, ponad granicą poślizg z tarciem kinetycznym (0,85 granicy). Okno Opis:
    poślizg z prędkości kół (s = 1 − ω₂ / (ω₁·d₁/d₂)), np. hamulec 20 N·m → 0,47 %, 100 N·m → POŚLIZG (wyjście stoi).
  - Łańcuch 08A: efekt wielokąta (z = 18, prędkość koła biernego ±0,76 % na każdy ząb).
  - Straty: sprawność każdego połączenia (zazębienie 98 %, łańcuch 97 %, pas 96 %, planetarna 97 %, przegub wg kąta,
    łożyska) — moment silnika rośnie o straty; w oknie Opis straty w W i sprawność całkowita (~78 %).
  - Hamulec jako wiązanie tarcia ograniczone momentem, liczone razem z połączeniami (wcześniej hamował tylko
    bezwładność tarczy — 100 N·m działało jak ~32 N·m). Prędkości w oknach — średnie z klatki.

## 0.25.1 — 2026-11-26
- Laboratorium mechaniki 0.6.0 — tryb Fizyka, punkt 2: **sprężystość połączeń**. Sztywności skrętne z wymiarów
  i materiałów: wał G·J_p/L (stal 80 GPa), gwiazda sprzęgła kłowego wg twardości (92 Sh A 1300, 98 Sh A 2300,
  64 Sh D 4500 N·m/rad), zazębienie ≈ 20 N/(mm·µm) × szerokość × r_b², łańcuch 08A i pas SPA — EA/L × r²; tłumienie
  ζ (stal 2 %, poliuretan 7 %, guma 8 %). Połączenia miękkie (< 10⁵ N·m/rad) to sprężyny skrętne liczone jawnie
  (96 podkroków na klatkę), bardzo sztywne — wiązania. Okno Opis: skręcenie, moment i sztywność każdego sprężystego
  połączenia na żywo (np. przy hamulcu 20 N·m: wał wyjściowy 0,40°, pas 1,8°, gwiazda 0,03°). W trybie Przedmioty:
  sztywność skrętna wału i sprzęgła kłowego.
- Uwaga: sprężystość jako podatność XPBD nie zbiegała się w kilku iteracjach wzdłuż długiego łańcucha połączeń
  (połączenia 10–50 razy miększe niż k) — stąd sprężyny jawne dla połączeń miękkich.

## 0.25.0 — 2026-11-26
- Laboratorium mechaniki 0.5.0: trzeci tryb **Fizyka** — ta sama maszyna liczona fizycznie (`js/behaviors/mech/physics.js`):
  każda część ma własny kąt i prędkość, połączenia z napędu (te same porty) są wiązaniami XPBD na kątach; silnik daje
  moment wirnikowi, hamulec — tarczy, reszta rusza przez wiązania. Momenty w połączeniach z mnożników wiązań.
  Przełożenia zgodne z kinematyką (wyjście 1 : 30).
  - Punkt 1 — **luz w zazębieniu** z geometrii zębów (0,08·m na kole podziałowym: 0,32 mm dla modułu 4, 0,24 mm dla 3):
    wiązanie z martwą strefą; przy zmianie kierunku napędzane koło stoi, aż ząb przejdzie luz i przyłoży się drugą
    flanką. Stan każdego zazębienia w oknie Opis („przylega flanką przednią / tylną”, „w luzie”).
  - **Regulator prędkości przy silniku** — falownik z pokrętłem, RUN / STOP i **FWD / REV** (zmiana kierunku obrotu:
    częstotliwość przechodzi przez zero po rampie), obsługa na modelu; suwak prędkości na pasku znika w tym trybie.
  - Pole **Hitboksy** (Maszyna i Fizyka): bryły zderzeń z geometrii — walce wzdłuż osi części obrotowych (obracają się
    z nimi) i prostopadłościany części nieruchomych.
- ControlKit: falownik z przyciskiem FWD / REV (częstotliwość ze znakiem). `MechanicsApi.regulator()`, `ratios()`.

## 0.24.1 — 2026-11-25
- Laboratorium mechaniki 0.4.1 — poprawki z przeglądu ChatGPT (odpowiedzi w `AI_COLLABORATION.md`): sterowanie puszczane
  także przy przerwanym geście (`pointercancel`, utrata przechwycenia, okno w tle) — przycisk chwilowy i krańcówka nie
  zostają wciśnięte; `MechanicsApi.run()` najwyżej 120 s na wywołanie (`Infinity` nie zawiesza strony), `rpm()`,
  `brake()`, `alpha()` pomijają nie-liczby i przycinają do zakresu; etykieta styków grzybka „1 NC + 1 NO”.

## 0.24.0 — 2026-11-25
- Laboratorium mechaniki 0.4.0 — nowe przedmioty, obsługa na modelu i stan na żywo:
  - Sterowanie: **grzybek bezpieczeństwa** (zatrzask, odblokowanie obrotem, styki NC / NO), **lampka sygnalizacyjna**
    (kolory, 24 V / 230 V, świeci z poświatą), **przełącznik wyboru** (0–I albo I–0–II, powrót sprężyną, rączka),
    **wyłącznik krańcowy** (dźwignia z rolką albo popychacz, styki NO + NC), **stycznik** (AC-3 9–32 A, cewka 230 V AC /
    24 V DC, styk pomocniczy, na szynie DIN; klik — test jak zasilona cewka).
  - Nowa grupa **Zasilanie i przewody**: **przewód** (linka Cu H07V-K 0,5–16 mm², kolory izolacji wg funkcji —
    L1 L2 L3 N PE, ± DC, sterowanie; żółto-zielony z paskami; długość; tulejki w kolorach DIN 46228-4; rezystancja,
    obciążalność, spadek napięcia), **źródło zasilania AC (umowne)** (1 / 3 fazy, 24–400 V, 50 / 60 Hz, zabezpieczenie;
    wyświetlacz z przebiegiem faz, gniazda L1–L3 N PE w kolorach), **źródło zasilania DC (umowne)** (1–60 V, prąd
    maks.). Umowne — „skąd bierze się prąd” w maszynie, nie konkretne urządzenie.
- ControlKit (`js/models/mech/controls.js`): `eStop`, `pilotLamp`, `selector`, `limitSwitch`, `contactor`, `wire`,
  `powerSource`. Doktor: 64 modele mechaniki — 0 błędów, 0 ostrzeżeń.

## 0.23.0 — 2026-11-25
- Laboratorium mechaniki 0.3.0: grupa **Sterowanie** — obsługa na modelu zamiast suwaków (klik: dźwignia, przycisk,
  RUN / STOP; przeciąganie w górę / w dół: pokrętło; kursor „rączka” nad częścią do obsługi), stan na żywo w oknie
  Element:
  - **wyłącznik** — krzywkowy obrotowy 0–I, główny (czerwona rączka, żółta tabliczka), dźwigniowy; bieguny, prąd,
  - **potencjometr** — 1–100 kΩ, liniowy (B) / logarytmiczny (A), skala 0–10 na 270°, napięcie suwaka przy 10 V,
  - **przycisk 22 mm** — chwilowy / z podtrzymaniem, styk NO / NC, kolory, podświetlenie (świeci przy zamkniętym
    styku), grzybkowy,
  - **falownik z pokrętłem** — moc, częstotliwość maks., rampa, bieguny silnika; wyświetlacz Hz, RUN / STOP,
    częstotliwość narasta po rampie, napięcie U/f i obroty synchroniczne.
  Porty: energia elektryczna, sygnał cyfrowy, sygnał analogowy 0–10 V, mocowanie. `MechanicsApi.control(nazwa, akcja)`.
- MechKit: `js/models/mech/controls.js` (ControlKit: obudowa natynkowa, wyłączniki, potencjometr, przycisk, falownik).
  Doktor: 11 nowych modeli — 0 błędów, 0 ostrzeżeń.

## 0.22.2 — 2026-11-25
- Poprawki z przeglądu ChatGPT (odpowiedzi pod każdym punktem w `AI_COLLABORATION.md`):
  - zapisane ustawienia laboratoriów wczytywane ostrożnie — wspólny `js/labs/shared/saved.js` (`loadState`, `pick`,
    `valid`): tylko znane klucze, ten sam typ, wartości z listy albo zakresu; wartość usunięta z programu albo zepsuta
    nie wykłada już strony (wcześniej np. stara nawierzchnia wykładała laboratorium ulic, nieliczbowa prędkość —
    laboratorium deformacji). Laboratoria deformacji 0.4.1, zniszczeń 0.3.3, ulic 0.10.2, mechaniki 0.2.2 (także
    ustawienia każdego przedmiotu, sprawdzane względem jego definicji);
  - `StreetsApi.set()`, `scene()`, `signal()` i `DestructionApi.build()` przyjmują tylko poprawne wartości
    (`set` zwraca odrzucone pola w `rejected`);
  - DeformKit: osadzanie wierzchołka daleko od siatki fizycznej (ponad ok. 0,5 m) — pełne przeszukanie trójkątów zamiast
    indeksu −1 i `NaN`; siatka fizyczna bez trójkątów zgłasza błąd;
  - laboratorium deformacji zwalnia geometrie prostopadłościanów (prasy, podpory, ściany kontenera) przy przebudowie;
  - doktor modeli: filtr, który nie pasuje do żadnego modelu, kończy się błędem (wcześniej „0 błędów” i sukces), licznik
    postępu liczy względem modeli z filtra.

## 0.22.1 — 2026-11-25
- Doktor modeli sprawdza przedmioty laboratorium mechaniki (`mech/…` — każdy przedmiot z katalogu, ustawienia domyślne
  i warianty skrajne, 37 modeli) i beczkę z laboratorium deformacji (`deform/…`, 6 modeli). Próg „tej samej płaszczyzny”
  dla przedmiotów w skali milimetrów 0,2 mm (domyślne 1 cm, dobrane do ulic, łączyło ścianki odległe o kilka mm).
- MechKit — poprawki znalezione przez doktora (ogólne, dla wszystkich rozmiarów): otwór z rowkiem wpustu mieści się pod
  stopą zęba (małe zębatki) i pod gniazdami rolek (małe koła łańcuchowe — piasta nie wychodzi już na lewą stronę);
  otwory odciążające dużych zębatek nie nachodzą na siebie; wał bez denek pod fazkami; piasty zachodzą w tarczę zamiast
  stykać się płaszczyzną; sworznie satelitów z luzem w otworach; kły i gwiazda sprzęgła kłowego, łby śrub sprzęgła
  kołnierzowego, widełki przegubu Cardana i osłona wentylatora silnika — bez wspólnych płaszczyzn (migotania); usunięty
  klocek hamulca schowany w zacisku. Laboratorium mechaniki 0.2.1. Wynik: 43 modele, 0 błędów, 0 ostrzeżeń.

## 0.22.0 — 2026-11-25
- Laboratorium mechaniki 0.2.0: tryb **Przedmioty** (domyślny) — każdy przedmiot osobno na stole, na statywie z czopem
  wzdłuż osi obrotu (silnik i oprawa łożyska — na blacie). Okno Przedmioty (zębatka walcowa, para zębatek, przekładnia
  planetarna, koło koronowe, koło łańcuchowe, napęd łańcuchowy, koło pasowe, napęd pasowy, wał, łożysko w oprawie,
  sprzęgło kłowe, sprzęgło kołnierzowe, przegub Cardana, silnik, hamulec tarczowy), okno Ustawienia (np. liczba zębów,
  moduł, kąt przyporu, materiał, rodzaj łańcucha, profil i liczba rowków, moc i liczba biegunów silnika, kąt przegubu)
  i okno Element — wyliczone dane, ostrzeżenia (podcięcie zęba, warunek montażu satelitów, kąt opasania, efekt
  wielokąta…) i porty. Dotychczasowa maszyna — tryb **Maszyna**.
- MechKit: kąt przyporu i wyłączane otwory odciążające zębatek, profile pasów SPZ / SPA / SPB i koła wielorowkowe,
  łańcuchy 06B–12A, wał bez rowka wpustu, oprawy łożysk pod różne średnice wałów, gwiazdy sprzęgła kłowego (twardości),
  liczba śrub sprzęgła kołnierzowego, silniki IEC 0,18–7,5 kW (wielkość mechaniczna, masa, bezwładność, 2 / 4 / 6
  biegunów), przekładnia planetarna (`planetary`) i hamulec tarczowy (`discBrake`) jako przedmioty. Napęd: `pose(θ)`.

## 0.21.0 — 2026-11-25
- Laboratorium mechaniki 0.1.0 (`labs/mechanics.html`, opis `docs/labs/mechanics.md`), kategoria 1 — transmisja ruchu:
  jedna maszyna z elementów połączonych portami — silnik 1,1 kW, sprzęgło kłowe, zębatki 20 : 40, przekładnia
  dwustopniowa w obudowie z akrylu, łańcuch rolkowy 08A, pas klinowy SPA, sprzęgło kołnierzowe, wał z dwoma przegubami
  Cardana, przekładnia planetarna i hamulec tarczowy. Suwaki: silnik, hamulec, przezroczystość obudów; kliknięcie
  elementu — właściwości, prędkość, moment i porty z połączeniami.
- MechKit (`js/models/mech/`): zębatki o zarysie ewolwentowym, koło koronowe, koła łańcuchowe, łańcuch z ogniw, koła
  pasowe i pas klinowy, wały, łożyska, sprzęgła, przeguby Cardana, silnik, obudowy z akrylu.
- Napęd (`js/behaviors/mech/drive.js`): graf elementów z portami, kąty z połączeń (zazębienie, łańcuch, pas, przegub
  Cardana z geometrii, przekładnia planetarna), wykrywanie zakleszczenia, silnik z poślizgiem, bezwładność zredukowana,
  hamulec, sprawności.

## Laboratorium deformacji 0.4.0 — 2026-11-25
- Pole **Zderzacze** na pasku: bryły zderzeń (prasa — czerwona, podpory i ściany kontenera — żółte), siatka fizyczna
  beczek z cząstkami (wielkość punktu = średnica styku), ramki beczek (po nich wybierani są sąsiedzi do zderzeń)
  i cząstki trzymane przy chwytaniu (zielone); rysowane przez wszystko, na bieżąco. DeformKit: `shell.triangles`,
  `shell.radius`.

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
