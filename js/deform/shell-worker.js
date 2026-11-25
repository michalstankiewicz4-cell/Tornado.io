// DeformKit — wątek obliczeń powłoki (Web Worker): jedna powłoka na wątek, rdzeń js/deform/shell-core.js.
//   { init: { geoms, opts } }               → { ready: true }
//   { step: { dt, n, C, wake } }            → { X: Float32Array (przeniesiony), awake }
import { buildShell, stepShell } from './shell-core.js';

let S = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.init) { S = buildShell(m.init.geoms, m.init.opts); self.postMessage({ ready: true }); return; }
  if (m.step && S) {
    const { dt, n, C, wake } = m.step;
    if (wake) { S.awake = true; S.still = 0; }
    for (let k = 0; k < n; k++) stepShell(S, dt, C);
    const X = S.X.slice();
    self.postMessage({ X, awake: S.awake }, [X.buffer]);
  }
};
