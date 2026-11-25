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
      "file": "labs/deformation.html",
      "cat": "matter",
      "name": "Deformation lab",
      "namePl": "Laboratorium deformacji",
      "doc": "docs/labs/deformation.md",
      "desc": "Steel 200 l drums under press blocks: upright, tilted 23°, 45° and 68° against concrete supports, and on the side between chocks; the sheet metal bends permanently (length and bending constraints with plasticity). Press speed from zero.",
      "descPl": "Stalowe beczki 200 l pod blokami prasy: pionowo, pochylone o 23°, 45° i 68° na betonowych podporach i bokiem między klinami; blacha gnie się trwale (więzy długości i zginania z plastycznością). Prędkość prasy od zera.",
      "kind": "lab",
      "kit": "DeformKit",
      "phrases": ["deformacja", "zgniatanie", "blacha", "beczki"],
      "saved": ["tornado.deformation."],
      "art": { "bg": ["#2a3038", "#121519"], "svg": "<path d=\"M60 30H140V44H60Z\" fill=\"#7c8388\"/><path d=\"M74 50H126L130 66L120 74L132 84L126 96H74L68 84L80 74L70 66Z\" fill=\"#1f4f8f\"/>" }
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
  "phraseEn": { "zniszczenia": "destruction", "budynki": "buildings", "pękanie": "fracture", "gruz": "rubble", "ulice": "streets", "chodniki": "sidewalks", "drogi": "roads", "skrzyżowania": "crossings", "deformacja": "deformation", "zgniatanie": "crushing", "blacha": "sheet metal", "beczki": "drums" }
}/*END*/;
