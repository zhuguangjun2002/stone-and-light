// 烘焙 Worker：自己按同一套参数建一遍教堂，烘自己那一片顶点，把结果传回主线程。
// 之所以能这么干——buildCathedral() 是确定性的（随机数都带种子），Worker 里没有
// document，贴图那部分自动退成平色，但**几何与遍历顺序和主线程完全一致**，
// 所以顶点色可以按网格下标对回去。
import * as THREE from '../lib/three.module.js';
import { buildCathedral } from './cathedral.js';
import { bakeVertexLight } from './bake.js';
import { P, recomputeDerived } from './params.js';

self.onmessage = (e) => {
  const { params, slice, rays, prof } = e.data;
  Object.assign(P, params);
  recomputeDerived();

  const scene = new THREE.Group();
  scene.add(buildCathedral().root);
  // 大地与广场也要在场：它们既挡光又往上反弹（与 main.js 的尺寸一致）
  const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 48),
    new THREE.MeshStandardMaterial({ color: '#89906f' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.25;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(110, 190),
    new THREE.MeshStandardMaterial({ color: '#9b968b' }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, -0.08, 20);
  scene.add(ground, plaza);
  scene.updateMatrixWorld(true);

  const it = bakeVertexLight(scene, { slice, rays: rays ?? 32, ...(prof ?? {}) });
  let r = it.next(), last = 0;
  while (!r.done) {
    if (r.value.done - last > 3000) { last = r.value.done; self.postMessage({ progress: r.value }); }
    r = it.next();
  }
  const { colors, meshes } = r.value;
  const idx = [], out = [], bufs = [];
  colors.forEach((c, i) => { if (c) { idx.push(i); out.push(c); bufs.push(c.buffer); } });
  self.postMessage({ done: true, meshes, idx, colors: out }, bufs);
};
