import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Collapse many static meshes under `root` into one mesh per (material, shadow, raycast) bucket.
// `skip(mesh)` keeps a mesh as-is (animated, special userData, etc).
export function mergeStatic(root, skip = () => false, into = root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(into.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || skip(o)) return;
    const noRay = o.raycast !== THREE.Mesh.prototype.raycast;
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}|${noRay ? 1 : 0}|${o.renderOrder}`;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, receive: o.receiveShadow, noRay, order: o.renderOrder, ud: o.userData, geos: [] });
    buckets.get(key).geos.push(g);
    victims.push(o);
  });
  for (const o of victims) o.parent.remove(o);
  const out = [];
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(b.geos), b.mat);
    m.castShadow = b.cast; m.receiveShadow = true; m.renderOrder = b.order;
    if (b.noRay) m.raycast = () => {};
    if (b.ud && b.ud.carPart) m.userData.carPart = b.ud.carPart === 'glass' ? 'body' : b.ud.carPart;
    m.matrixAutoUpdate = false;
    into.add(m); out.push(m);
  }
  return out;
}
