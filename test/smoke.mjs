// 无浏览器冒烟测试：构建整座教堂的场景图，统计网格数与包围盒。
// 运行：node test/smoke.mjs
import * as THREE from '../lib/three.module.js';
import { buildCathedral } from '../src/cathedral.js';

const { root, labels, VAULT_APEX } = buildCathedral();

let meshes = 0, groups = 0;
root.updateMatrixWorld(true);
root.traverse((o) => {
  if (o.isMesh) meshes++;
  if (o.isGroup) groups++;
});

const box = new THREE.Box3().setFromObject(root);
console.log('网格数:', meshes, ' 组:', groups, ' 标注:', labels.length);
console.log('拱顶顶高:', VAULT_APEX.toFixed(2), 'm');
console.log('包围盒 min:', box.min.toArray().map((v) => v.toFixed(1)).join(', '));
console.log('包围盒 max:', box.max.toArray().map((v) => v.toFixed(1)).join(', '));

if (meshes < 100) throw new Error('网格数异常偏少，装配可能失败');
if (box.max.y < 60) throw new Error('尖塔高度缺失');
console.log('冒烟测试通过 ✓');
