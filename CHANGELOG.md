# Zmiany

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
