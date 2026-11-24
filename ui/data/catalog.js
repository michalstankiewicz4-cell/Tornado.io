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
    "matter": { "name": "Destruction", "namePl": "Zniszczenia" },
    "world": { "name": "Streets and routes", "namePl": "Ulice i trasy" }
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
    },
    {
      "file": "labs/streets.html",
      "cat": "world",
      "name": "Streets lab",
      "namePl": "Laboratorium ulic",
      "doc": "docs/labs/streets.md",
      "desc": "Streets and other routes from a cross-section along a line: a city street, an avenue with two carriageways, a village road, a path, a cycle lane; curves, crossings with zebra crossings; asphalt, pavers, slabs, granite kerbs from MatKit.",
      "descPl": "Ulice i inne trasy z przekroju prowadzonego po linii: ulica miejska, aleja z dwiema jezdniami, droga wiejska, ścieżka, droga dla rowerów; łuki, skrzyżowania z przejściami dla pieszych; asfalt, kostka, płyty, krawężniki granitowe z MatKit.",
      "kind": "lab",
      "kit": "StreetKit",
      "phrases": ["ulice", "chodniki", "drogi", "skrzyżowania"],
      "saved": ["tornado.streets."],
      "art": { "bg": ["#2c3034", "#14171a"], "svg": "<path d=\"M0 60 H200 V80 H0Z\" fill=\"#3b3c3e\"/><path d=\"M10 70 H30 M50 70 H70 M90 70 H110 M130 70 H150 M170 70 H190\" stroke=\"#e8e8e2\" stroke-width=\"2\"/><path d=\"M0 54 H200 V60 H0Z M0 80 H200 V86 H0Z\" fill=\"#a7a49c\"/>" }
    }
  ],
  "tools": [],
  "phraseEn": { "zniszczenia": "destruction", "budynki": "buildings", "pękanie": "fracture", "gruz": "rubble", "ulice": "streets", "chodniki": "sidewalks", "drogi": "roads", "skrzyżowania": "crossings" }
}/*END*/;
