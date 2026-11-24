// Drzewa gry z PlantKit (js/models/plants/plantkit.js): kilka wariantów każdego gatunku, stojące drzewa jako instancje
// (jedno wywołanie rysowania na wariant i część: kora, liście), wiatr w shaderze. Wyrwane drzewo staje się osobnym
// obiektem (bryła świata: niesione przez trąbę, rzucane, zjadane).
// createTrees(scene, list [{ x, z, species, seed, scale }], heightAt) → { trees, uproot(tree) → obj, wind(strength, dirDeg), tick(dt) }
import * as THREE from '../../vendor/three/three.module.js';
import { growPlant, plantMaterials, windUniforms } from '../models/plants/plantkit.js';

export const VARIANTS = 3;
export function createTrees(scene, list, heightAt) {
  const wu = windUniforms(), mats = {}, protos = new Map();
  const proto = (sp, v) => {
    const k = sp + ':' + v; if (protos.has(k)) return protos.get(k);
    const g = growPlant(sp, { seed: 101 + v * 37, size: 1, detail: 0.8 });
    if (!mats[sp]) mats[sp] = plantMaterials(sp, wu);
    const P = { g, sp, list: [] }; protos.set(k, P); return P;
  };
  const trees = list.map((t, i) => {
    const P = proto(t.species, t.seed % VARIANTS), y = heightAt(t.x, t.z) - 0.15;
    const tree = { ...t, i, y, P, h: P.g.height * t.scale, R: P.g.radius * t.scale, alive: true, yaw: (t.seed * 2.39) % 6.283 };
    P.list.push(tree); return tree;
  });
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const P of protos.values()) {
    P.ims = [];
    for (const [geo, mat, depth] of [[P.g.bark, mats[P.sp].bark, mats[P.sp].barkDepth], [P.g.leaf, mats[P.sp].leaf, mats[P.sp].leafDepth]]) {
      if (!geo) continue;
      const im = new THREE.InstancedMesh(geo, mat, P.list.length); im.customDepthMaterial = depth; im.castShadow = true; im.receiveShadow = true;
      P.list.forEach((t, k) => { t.slot = k; im.setMatrixAt(k, _m.compose(_p.set(t.x, t.y, t.z), _q.setFromAxisAngle(Y, t.yaw), _s.setScalar(t.scale))); });
      P.list.forEach((t, k) => im.setColorAt(k, new THREE.Color(1, 1, 1)));   // barwa instancji: zwęglenie (setChar)
      im.computeBoundingSphere(); scene.add(im); P.ims.push(im);
    }
  }
  return {
    trees, wu,
    // wyrwane drzewo: instancja znika, powstaje osobny obiekt (środek bryły w 40 % wysokości — tak się obraca)
    uproot(t) {
      if (!t.alive) return null;
      t.alive = false;
      for (const im of t.P.ims) { im.setMatrixAt(t.slot, ZERO); im.instanceMatrix.needsUpdate = true; }
      const obj = new THREE.Group(), inner = new THREE.Group(); inner.position.y = -t.h * 0.4 / t.scale; obj.add(inner);
      const m = mats[t.species];
      if (t.P.g.bark) { const b = new THREE.Mesh(t.P.g.bark, m.bark); b.customDepthMaterial = m.barkDepth; b.castShadow = true; inner.add(b); }
      const l = new THREE.Mesh(t.P.g.leaf, m.leaf); l.customDepthMaterial = m.leafDepth; l.castShadow = true; inner.add(l);
      obj.scale.setScalar(t.scale); obj.position.set(t.x, t.y + t.h * 0.4, t.z); obj.quaternion.setFromAxisAngle(Y, t.yaw);
      scene.add(obj); t.obj = obj;
      const pts = [];
      for (let k = 0; k < 6; k++) { const a = k * 1.047; pts.push(Math.cos(a) * 0.4, -t.h * 0.4, Math.sin(a) * 0.4, Math.cos(a) * t.R * 0.8, t.h * 0.3, Math.sin(a) * t.R * 0.8); }
      pts.push(0, t.h * 0.6, 0);
      return { obj, m: Math.round(3.5 * t.h * t.h), pts: new Float32Array(pts), r: t.h * 0.6, A: t.h * t.R * 0.9, size: t.h, vol: t.h * t.R * t.R * 0.25 };
    },
    // zwęglenie po pożarze (0…1): stojące — barwa instancji, wyrwane — kopia materiałów obiektu
    setChar(t, k) {
      t.char = Math.max(t.char || 0, Math.min(1, k));
      const c = new THREE.Color(1, 1, 1).multiplyScalar(1 - 0.85 * t.char);
      if (t.alive) for (const im of t.P.ims) { im.setColorAt(t.slot, c); im.instanceColor.needsUpdate = true; }
      else if (t.obj) t.obj.traverse((o) => { if (o.isMesh) { if (!o.userData.own) { o.material = o.material.clone(); o.userData.own = true; } o.material.color.copy(c); } });
    },
    wind(strength, dirDeg) { wu.uWind.value = strength; const a = dirDeg * Math.PI / 180; wu.uWindDir.value.set(Math.sin(a), Math.cos(a)); },
    tick(dt) { wu.uTime.value += dt; },
  };
}
