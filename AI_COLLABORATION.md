# Współpraca AI

Nad problemami w projekcie Tornado.io pracują wspólnie Claude i ChatGPT.

## Role

- **Claude** prowadzi obecnie pracę nad projektem i ma głos decydujący w bieżących kwestiach implementacyjnych.
- **ChatGPT** wspiera Claude analizą problemów, propozycjami rozwiązań i przeglądem technicznym.
- **Użytkownik** jest właścicielem projektu, ustala priorytety i może zmienić ten podział ról.

Ten układ obowiązuje na razie. Zmiany kierunku pracy lub podziału ról powinny wynikać z decyzji użytkownika.

## Przegląd trzech laboratoriów (2026-11-25)

Przegląd statyczny kodu laboratoriów deformacji, zniszczeń i ulic. Nie wprowadzono zmian w ich kodzie ani nie uruchamiano testów. Propozycje implementacji dotyczą JavaScriptu i powinny być zgodne z ogólnymi zasadami projektu.

### Najważniejsze uwagi

1. **Deformacje — sprzątanie geometrii przy przebudowie sceny.** Funkcja `build()` czyści grupę sceny przez `holder.clear()`, ale nie zwalnia jawnie geometrii obiektów. Ponadto `shell.embed()` zastępuje geometrię modelu jej kopią. Przy wielokrotnym „Od nowa” i przełączaniu scen może to zwiększać zużycie pamięci GPU. Warto dodać kontrolowane zwalnianie geometrii i sprawdzić, które materiały są współdzielone.
   - Pliki: [deformation.js](https://github.com/michalstankiewicz4-cell/Tornado.io/blob/main/js/labs/deformation/deformation.js), [shell.js](https://github.com/michalstankiewicz4-cell/Tornado.io/blob/main/js/deform/shell.js)

2. **Ulice — nieużywana geometria próbnego tunelu.** W próbce tunelu `buildTunnel()` tworzy obiekt `probe` używany tylko do odczytania wymiarów. Nie jest on dodawany do sceny ani jawnie zwalniany, a sprzątanie przebudowy obejmuje geometrię obiektów z grupy `holder`. Może to pozostawiać zasoby GPU po kolejnych przebudowach. Można obliczać potrzebne wymiary bez tworzenia geometrii albo zwolnić geometrię tymczasową.
   - Plik: [streets.js](https://github.com/michalstankiewicz4-cell/Tornado.io/blob/main/js/labs/streets/streets.js)

3. **DeformKit — brak obsługi braku trójkąta przy osadzaniu.** `nearestTri()` może zwrócić `-1`, gdy nie znajdzie trójkąta w sprawdzanym obszarze. `embed()` używa potem tego indeksu bez sprawdzenia, co może przerwać inicjalizację dla niektórych modeli lub siatek. Warto dodać pełne wyszukiwanie awaryjne i obsługę przypadku, w którym nie ma poprawnego trójkąta.
   - Plik: [shell.js](https://github.com/michalstankiewicz4-cell/Tornado.io/blob/main/js/deform/shell.js)

### Dalsze propozycje

- **Zniszczenia:** walidować argumenty `type` i `seed` w `DestructionApi.build()`. API może otrzymać wartości spoza listy obsługiwanej przez interfejs.
  - Plik: [destruction.js](https://github.com/michalstankiewicz4-cell/Tornado.io/blob/main/js/labs/destruction/destruction.js)
- **Deformacje i ulice:** walidować zapisane ustawienia z `localStorage` przed połączeniem ich ze stanem domyślnym. Niepoprawne lub nieaktualne wartości mogą rozjechać stan JS z kontrolkami.
- **Ulice:** walidować argumenty `StreetsApi.set()` i ich zakresy, aby niepoprawne wartości nie trafiały do przebudowy sceny.

W przeglądzie statycznym nie potwierdzono, że laboratoria są ogólnie niesprawne. Najbardziej konkretne punkty do dalszej weryfikacji to zwalnianie geometrii przy przebudowie deformacji oraz zwalnianie geometrii próbnego tunelu.

## Uwagi do doktora modeli (2026-11-25)

Przegląd statyczny narzędzia. Nie zmieniono kodu doktora ani nie uruchamiano go w tej analizie. W najnowszym wpisie `CHANGELOG.md` odnotowano wynik kontroli 43 modeli: 0 błędów i 0 ostrzeżeń.

1. **Nieznany filtr może zakończyć się fałszywym sukcesem.** Jeśli filtr, np. `nieistniejaca/`, nie pasuje do żadnego modelu, skrypt może zakończyć się kodem sukcesu mimo że nie sprawdził niczego. Uruchamiacz powinien zgłaszać błąd, gdy wynik filtrowania jest pusty.
   - Pliki: [run.js](https://github.com/michalstankiewicz4-cell/Tornado.io/blob/main/tools/doctor/run.js), [doctor.py](https://github.com/michalstankiewicz4-cell/Tornado.io/blob/main/tools/doctor.py)

2. **Licznik postępu jest mylący przy filtrowaniu.** `run.js` pokazuje liczbę sprawdzonych modeli względem całej listy, także gdy wybrano tylko jedną rodzinę. Warto obliczyć mianownik z modeli, które pasują do aktywnego filtra.
   - Plik: [run.js](https://github.com/michalstankiewicz4-cell/Tornado.io/blob/main/tools/doctor/run.js)
