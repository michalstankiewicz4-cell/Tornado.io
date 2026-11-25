// Klawiszologia Tornado.io — skróty klawiszowe każdej strony (Pomoc → Klawiszologia; ui/shell/menubar.js wczytuje
// ten moduł przy otwarciu okna). Klawisz — [klawisz, tekst EN, tekst PL]. Nowy skrót w kodzie strony = wpis tu.
const H = ['H', 'Hide / show the windows', 'Chowa i pokazuje okna'];

export const PAGES = {
  'index.html': [
    { title: ['Tornado', 'Trąba'], keys: [
      ['W / A / S / D', 'Move the tornado', 'Ruch trąby'],
      [['Arrows', 'Strzałki'], 'Move the camera', 'Przesuwanie kamery'],
      ['C', 'Camera back over the tornado', 'Kamera z powrotem nad trąbę'],
      [['Mouse', 'Mysz'], 'Aim (the ring on the ground)', 'Celowanie (pierścień na ziemi)'],
      [['Left click', 'Lewy przycisk'], 'Throw the heaviest carried object at the aim', 'Rzut najcięższym niesionym przedmiotem w cel'],
      [['Right click', 'Prawy przycisk'], 'Set fire at the aim (only what burns: wood, tar felt, grass, paper, tyres, trees)', 'Podpalenie w celu (tylko to, co palne: drewno, papa, trawa, papier, opony, drzewa)'],
      [['Right drag, Q / E', 'Prawy przycisk (przeciągnij), Q / E'], 'Turn the camera', 'Obrót kamery'],
      [['Wheel', 'Kółko'], 'Camera distance', 'Odległość kamery'],
      ['P', 'Pause', 'Pauza'],
      ['R', 'New game', 'Nowa gra'],
      H,
    ] },
  ],
  'labs/streets.html': [{ title: ['Streets lab', 'Laboratorium ulic'], keys: [[['Drag', 'Przeciągnij'], 'Orbit the camera', 'Obrót kamery'], H] }],
  'labs/deformation.html': [{ title: ['Deformation lab', 'Laboratorium deformacji'], keys: [[['Drag', 'Przeciągnij'], 'Orbit the camera', 'Obrót kamery'], ['R', 'New drums, presses up', 'Nowe beczki, prasy do góry'], H] }],
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
