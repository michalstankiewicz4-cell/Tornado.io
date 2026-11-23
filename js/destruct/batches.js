// Rysowanie wszystkich części i odłamków: jeden BatchedMesh na materiał (jedno wywołanie rysowania na materiał,
// niezależnie od liczby kawałków). Każdy kawałek: własna siatka w batchu i jedna instancja z macierzą i barwą.
// Pamięć rośnie sama (podwaja się), a zwolnione miejsca odzyskuje optimize().
// createBatches(scene) → { add(geometry, matId, matrix, color?) → handle, set(handle, matrix), color(handle, c),
//   remove(handle), stats() → { geoms, verts, draws }, clear() }
import * as THREE from '../../vendor/three/three.module.js';
import { renderMaterial, MATS } from './materials.js';

export function createBatches(scene) {
  const B = new Map();   // matId → { mesh, verts, idx, inst, liveV, liveI, dead }
  const W = new THREE.Color(1, 1, 1);
  function make(matId, maxI = 512, maxV = 65536, maxX = 131072) {
    const mesh = new THREE.BatchedMesh(maxI, maxV, maxX, renderMaterial(matId));
    mesh.castShadow = !MATS[matId].glass; mesh.receiveShadow = true; mesh.name = 'batch-' + matId;
    mesh.perObjectFrustumCulled = true; mesh.sortObjects = !!MATS[matId].glass;
    scene.add(mesh);
    return { mesh, maxI, maxV, maxX, usedV: 0, usedX: 0, n: 0, dead: 0 };
  }
  function grow(b, matId, needV, needX) {
    // najpierw odzysk zwolnionego miejsca, potem większe bufory
    if (b.dead > 0) { b.mesh.optimize(); b.dead = 0; recount(b); }
    if (b.usedV + needV <= b.maxV && b.usedX + needX <= b.maxX && b.n < b.maxI) return;
    while (b.usedV + needV > b.maxV || b.usedX + needX > b.maxX) { b.maxV *= 2; b.maxX *= 2; }
    b.mesh.setGeometrySize(b.maxV, b.maxX);
    if (b.n >= b.maxI) { b.maxI *= 2; b.mesh.setInstanceCount(b.maxI); }
  }
  function recount(b) {
    let v = 0, x = 0;
    for (const g of b.mesh._geometryInfo) if (g.active) { v = Math.max(v, g.vertexStart + g.reservedVertexCount); x = Math.max(x, g.indexStart + g.reservedIndexCount); }
    b.usedV = v; b.usedX = x;
  }
  return {
    add(geo, matId, matrix, color) {
      let b = B.get(matId); if (!b) { b = make(matId); B.set(matId, b); }
      const nv = geo.attributes.position.count, nx = geo.index.count;
      if (b.usedV + nv > b.maxV || b.usedX + nx > b.maxX || b.n >= b.maxI) grow(b, matId, nv, nx);
      if (b.n >= b.maxI) { b.maxI *= 2; b.mesh.setInstanceCount(b.maxI); }
      const gid = b.mesh.addGeometry(geo), iid = b.mesh.addInstance(gid);
      b.usedV += nv; b.usedX += nx; b.n++;
      b.mesh.setMatrixAt(iid, matrix); b.mesh.setColorAt(iid, color || W);
      return { b, gid, iid, matId };
    },
    set(h, matrix) { h.b.mesh.setMatrixAt(h.iid, matrix); },
    color(h, c) { h.b.mesh.setColorAt(h.iid, c); },
    remove(h) { if (!h || h.dead) return; h.b.mesh.deleteGeometry(h.gid); h.b.n--; h.b.dead++; h.dead = true; },
    stats() { let geoms = 0, verts = 0; for (const b of B.values()) { geoms += b.n; verts += b.usedV; } return { geoms, verts, draws: B.size }; },
    clear() { for (const b of B.values()) { scene.remove(b.mesh); b.mesh.dispose(); } B.clear(); },
    meshes: () => [...B.values()].map((b) => b.mesh),
  };
}
