import * as THREE from 'three';

// Phone mode: swap physically-based materials (expensive per pixel: PBR + image-based lighting)
// for Lambert (matte) / Phong (car paint & glass keep a specular glint). Originals are kept so
// switching back to a higher graphics setting restores them.
const cache = new Map();

function cheap(m) {
  if (cache.has(m)) return cache.get(m);
  let out = m;
  if (m.isMeshStandardMaterial && !m.userData.keepPBR) {
    const shiny = m.isMeshPhysicalMaterial || (m.metalness > 0.6 && m.roughness < 0.4);
    const C = shiny ? THREE.MeshPhongMaterial : THREE.MeshLambertMaterial;
    out = new C({
      color: m.color, map: m.map, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, emissiveMap: m.emissiveMap,
      vertexColors: m.vertexColors, transparent: m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite,
      alphaTest: m.alphaTest, visible: m.visible, fog: m.fog,
      polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits,
    });
    if (shiny) { out.shininess = 70; out.specular = new THREE.Color(0x555555); }
    out.userData.src = m;
  }
  cache.set(m, out);
  return out;
}

export function applyLowMaterials(root, on) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    if (on) {
      if (o.material.userData.src) return; // already cheap
      o.material = cheap(o.material);
    } else if (o.material.userData.src) {
      o.material = o.material.userData.src;
    }
  });
}
