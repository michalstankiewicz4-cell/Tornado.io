// Katalog przedmiotów laboratorium mechaniki (kategoria 1 — transmisja ruchu). Każdy przedmiot: ustawienia (params),
// budowa z MechKit (build(p) → { group, update(θ), info: [[nazwa, wartość]], ports, warn }) — θ: kąt wejścia podglądu.
// Ustawienie: { key, label, type: 'range' | 'select' | 'check', min, max, step, unit, options: [[wartość, opis]], def }
// Pliki: items/transmission.js, energy.js, timekeeping.js, controls.js, power.js, optics.js; pomocniki — items/util.js,
// kolizje przegubu Cardana — items/cardan.js.
import { TRANSMISSION } from './items/transmission.js';
import { ENERGY } from './items/energy.js';
import { TIMEKEEPING } from './items/timekeeping.js';
import { CONTROLS } from './items/controls.js';
import { POWER } from './items/power.js';
import { OPTICS } from './items/optics.js';
export { cardanCheck, cardanMax } from './items/cardan.js';

// kategorie planu (docs/labs/mechanics.md): grupa przedmiotu → kategoria
export const CATS = [
  ['Transmisja ruchu', ['Zębatki i przekładnie', 'Łańcuchy', 'Pasy', 'Wały i łożyska', 'Łożyska', 'Sprzęgła', 'Zamiana ruchu', 'Napęd']],
  ['Magazynowanie energii', ['Sprężyny', 'Koła zamachowe']],
  ['Ruch i sterowanie', ['Mechanizmy zapadkowe', 'Wahadła i wychwyty', 'Sterowanie']],
  ['Przepływ i transport', ['Zasilanie i przewody']],
  ['Optyka i sygnały', ['Optyka']],
  ['Elektronika i sprzęt', []],
];

export const ITEMS = [...TRANSMISSION, ...ENERGY, ...TIMEKEEPING, ...CONTROLS, ...POWER, ...OPTICS];
