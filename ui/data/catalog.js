/* =======================================================================
   TORNADO.IO · CATALOG — gra i laboratoria w jednym miejscu
   =======================================================================
   Klasyczny skrypt przed ui/shell/menubar.js (UI skopiowane z GameLaboratory). Czyta go pasek menu (listy, nazwy,
   Pomoc → opis, Opcje → reset zapisanych ustawień). Nowe laboratorium: wpis tutaj i wersja w ui/data/versions.js.
   ======================================================================= */
window.GameLabCatalog =
/*JSON*/{
  "start": { "saved": ["tornado.game."] },
  "cats": {
    "game": { "name": "Game", "namePl": "Gra" },
    "matter": { "name": "Destruction", "namePl": "Zniszczenia" }
  },
  "labs": [
    {
      "file": "labs/destruction.html",
      "cat": "matter",
      "name": "Destruction lab",
      "namePl": "Laboratorium zniszczeń",
      "doc": "docs/labs/destruction.md",
      "desc": "Buildings made of real parts that break the way they are built: brick walls into courses and bricks, concrete into slabs, planks along the grain, glass into radial shards, roofs into tiles and sheets; statics, debris physics, thrown objects and wind.",
      "descPl": "Budynki z prawdziwych części, które pękają tak, jak są zbudowane: mur na warstwy i cegły, beton na płaty, deski wzdłuż słojów, szyby promieniście, dachy na dachówki i arkusze; statyka, fizyka odłamków, rzucone przedmioty i wiatr.",
      "kind": "lab",
      "kit": "DestructKit, HouseKit",
      "phrases": ["zniszczenia", "budynki", "pękanie", "gruz"],
      "saved": ["tornado.destruction."],
      "art": { "bg": ["#3a2f2a", "#16120f"], "svg": "<path d=\"M30 92V50L70 26L110 50V92Z\" fill=\"#8e3b26\"/><path d=\"M120 92L130 70L150 80L160 92Z\" fill=\"#9a4b35\"/>" }
    }
  ],
  "tools": [],
  "phraseEn": { "zniszczenia": "destruction", "budynki": "buildings", "pękanie": "fracture", "gruz": "rubble" }
}/*END*/;
