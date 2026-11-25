// Doktor modeli bez okna: bada każdy model z sources.js i zostawia wyniki w window.doctorReport (czyta tools/doctor.py).
import * as THREE from '../../vendor/three/three.module.js';
import { examine, CHECKS } from './modeldoctor.js';
import { models } from './sources.js';

const report = { done: false, models: {} };
window.doctorReport = report;
const only = new URLSearchParams(location.search).get('only');
// tylko modele pasujące do filtra; licznik postępu liczy względem nich (nie całej listy)
const picked = models.filter((m) => !only || m.id.startsWith(only));
report.selected = picked.length; report.only = only || '';
for (const m of picked) {
  const t0 = performance.now();
  try {
    const b = m.build(), r = examine(b.root, b.opts);
    const counts = {}; CHECKS.forEach((c) => { counts[c] = 0; }); r.findings.forEach((f) => counts[f.check]++);
    const size = new THREE.Box3().setFromObject(b.root).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2));
    report.models[m.id] = { label: m.label, family: m.family, ms: Math.round(performance.now() - t0), stats: r.stats, fingerprint: { ...b.measured, size }, counts,
      findings: r.findings.map((f) => ({ check: f.check, severity: f.severity, parts: f.parts, detail: f.detail, src: f.src })) };
  } catch (e) { report.models[m.id] = { label: m.label, error: String(e && e.stack || e) }; }
  document.getElementById('log').textContent = Object.keys(report.models).length + ' / ' + picked.length;
  await new Promise((r) => setTimeout(r, 0));
}
report.done = true;
