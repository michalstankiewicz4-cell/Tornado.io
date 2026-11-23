// Klawiszologia Tornado.io — skróty klawiszowe każdej strony (Pomoc → Klawiszologia; ui/shell/menubar.js wczytuje
// ten moduł przy otwarciu okna). Klawisz — [klawisz, tekst EN, tekst PL]. Nowy skrót w kodzie strony = wpis tu.
const H = ['H', 'Hide / show the windows', 'Chowa i pokazuje okna'];

export const PAGES = {
  'index.html': [
    { title: ['Tornado', 'Trąba'], keys: [
      ['W / A / S / D', 'Move the tornado', 'Ruch trąby'],
      [['Mouse', 'Mysz'], 'Aim (the ring on the ground)', 'Celowanie (pierścień na ziemi)'],
      [['Left click', 'Lewy przycisk'], 'Throw the heaviest carried object at the aim', 'Rzut najcięższym niesionym przedmiotem w cel'],
      [['Right drag, Q / E', 'Prawy przycisk (przeciągnij), Q / E'], 'Turn the camera', 'Obrót kamery'],
      [['Wheel', 'Kółko'], 'Camera distance', 'Odległość kamery'],
      ['P', 'Pause', 'Pauza'],
      ['R', 'New game', 'Nowa gra'],
      H,
    ] },
  ],
  'labs/destruction.html': [
    { title: ['Destruction lab', 'Laboratorium zniszczeń'], keys: [
      [['Left click', 'Lewy przycisk'], 'Use the tool (hit, throw, tornado) at the point', 'Użyj narzędzia (uderzenie, rzut, trąba) w punkcie'],
      [['Drag', 'Przeciągnij'], 'Orbit the camera', 'Obrót kamery'],
      ['1 / 2 / 3', 'Tool: hit / throw / tornado', 'Narzędzie: uderzenie / rzut / trąba'],
      ['B', 'Rebuild', 'Odbuduj'],
      H,
    ] },
  ],
};

export function keysFor(page, lang = 'en') {
  const L = lang === 'pl' ? 1 : 0, txt = (k) => (Array.isArray(k) ? k[L] : k);
  return (PAGES[page] || []).map((s) => ({ title: txt(s.title), rows: s.keys.map((k) => [txt(k[0]), k[1 + L]]) }));
}
