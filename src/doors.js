// 门的开关：收集场景里所有门扇、按状态转动枢轴、逐帧缓动。
//
// 真教堂的门有三档，不是简单的开/关：
//   关     —— 平时就是关着的（挡风雨；巨门要几个人合力才推得开）
//   便门   —— 大扇关着，人从门板上挖的那扇小门（wicket）进出，这是日常状态
//   全开   —— 只在庆典、游行、出殡时才把大扇推开
// 没有便门的门只有关/开两档。
import * as THREE from '../lib/three.module.js';

export const DOOR_NAMES = {
  'west-center': '西 · 中门',
  'west-south': '西 · 南侧门',
  'west-north': '西 · 北侧门',
  'transept-south': '南耳堂门',
  'transept-north': '北耳堂门',
};
export const STATE_NAMES = { closed: '关', wicket: '便门', open: '全开' };

export function collectDoors(root) {
  const doors = [];
  root.traverse((o) => {
    if (!o.userData.doorId) return;
    const leaves = [], wickets = [];
    o.traverse((c) => {
      if (!c.userData.door) return;
      (c.userData.door.wicket ? wickets : leaves).push(c);
    });
    const p = o.getWorldPosition(new THREE.Vector3());
    doors.push({
      id: o.userData.doorId, name: DOOR_NAMES[o.userData.doorId] ?? o.userData.doorId,
      leaves, wickets, hasWicket: wickets.length > 0,
      x: +p.x.toFixed(2), z: +p.z.toFixed(2), state: 'closed',
    });
  });
  doors.sort((a, b) => b.z - a.z || a.x - b.x);
  return doors;
}

// 门朝室内开（门龛层层内收，向外开会撞门龛）。枢轴在门边，门板伸向另一侧，
// 所以转角的符号跟着 side 走。
const targetFor = (pivot, on) => (on ? -pivot.userData.door.side * pivot.userData.door.max : 0);

export function setDoorState(door, state, instant = false) {
  door.state = state;
  const big = state === 'open';
  const wick = state !== 'closed';                 // 全开时便门也跟着开着
  for (const p of door.leaves) {
    p.userData.target = targetFor(p, big);
    if (instant) p.rotation.y = p.userData.target;
  }
  for (const p of door.wickets) {
    p.userData.target = targetFor(p, wick);
    if (instant) p.rotation.y = p.userData.target;
  }
}

// 下一档：有便门的三档循环，没有的两档
export function nextState(door) {
  if (!door.hasWicket) return door.state === 'closed' ? 'open' : 'closed';
  return door.state === 'closed' ? 'wicket' : door.state === 'wicket' ? 'open' : 'closed';
}

// 逐帧缓动。开门比关门稍快，收尾用指数逼近——门轴上的木门就是这种"推一下、慢慢停"
export function updateDoors(doors, dt) {
  let moving = false;
  for (const d of doors) {
    for (const p of [...d.leaves, ...d.wickets]) {
      const t = p.userData.target ?? 0;
      const diff = t - p.rotation.y;
      if (Math.abs(diff) < 1e-4) { p.rotation.y = t; continue; }
      p.rotation.y += diff * Math.min(1, dt * 3.2);
      moving = true;
    }
  }
  return moving;
}
