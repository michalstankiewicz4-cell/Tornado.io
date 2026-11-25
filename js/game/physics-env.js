// Środowisko dla wątku fizyki odłamków (js/destruct/physics-worker.js): grunt i wiatr trąby — te same funkcje co na
// głównym wątku (czysta matematyka, stan trąby przychodzi co klatkę jako liczby).
export { heightAt as ground } from './height.js';
export { tornadoWind as wind } from '../envs/sky/tornado.js';
