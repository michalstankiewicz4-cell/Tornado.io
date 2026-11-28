// Elektronika i sprzęt (kategoria 6): kamera przemysłowa na statywie, monitor LCD 24". Obraz z kamery na monitorze —
// w trybach Maszyna i Fizyka (kamera filmuje zegar, video-station.js); tu sam sprzęt z danymi.
import * as VK from '../../../models/mech/video/index.js';
import { num, kg, portsOf } from './util.js';

export const VIDEO = [
  {
    id: 'camera', name: 'Kamera przemysłowa na statywie', group: 'Wideo',
    params: [
      { key: 'f', label: 'Ogniskowa obiektywu', type: 'select', options: [[0.004, '4 mm (szeroki)'], [0.008, '8 mm'], [0.012, '12 mm'], [0.025, '25 mm (wąski)']], def: 0.012 },
      { key: 'H', label: 'Wysokość statywu', type: 'range', min: 1.0, max: 1.7, step: 0.05, unit: 'mm', def: 1.4 },
    ],
    build(p) {
      const g = VK.camera({ f: +p.f, H: p.H }), u = g.userData; u.setOn(true); u.tilt.rotation.x = 0.08;
      const w1 = 2 * Math.tan(u.fovH * Math.PI / 360);   // szerokość kadru na metr odległości
      return { group: g, rest: true, update() {}, view: { yaw: 0.9, pitch: 0.2 },
        info: [['Przetwornik', VK.SENSOR.name], ['Rozmiar przetwornika', '5,37 × 3,02 mm'], ['Kąt widzenia (poziomo × pionowo)', `${num(u.fovH, 1)}° × ${num(u.fovV, 1)}°`], ['Szerokość kadru z 1 m', `${num(w1 * 1000, 0)} mm`], ['Wysokość obiektywu', `${num(u.H * 1000, 0)} mm`], ['Masa (kamera + statyw)', kg(u.mass)]],
        ports: portsOf(g) };
    },
  },
  {
    id: 'monitor', name: 'Monitor LCD 24"', group: 'Wideo',
    params: [{ key: 'stand', label: 'Podstawa', type: 'select', options: [['floor', 'stojak podłogowy'], ['desk', 'nóżka biurkowa']], def: 'floor' }],
    build(p) {
      const g = VK.monitor({ stand: p.stand, Hc: 1.2 }), u = g.userData;
      return { group: g, rest: true, update() {}, view: { yaw: 0.35, pitch: 0.1 },
        info: [['Przekątna', '24" (610 mm)'], ['Obszar aktywny', '531 × 299 mm (16 : 9)'], ['Rozdzielczość', '1920 × 1080'], ['Wejście', 'brak sygnału — obraz z kamery w trybach Maszyna i Fizyka'], ['Masa', kg(u.mass)]],
        ports: portsOf(g) };
    },
  },
];
