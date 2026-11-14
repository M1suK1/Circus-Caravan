/**
 * 区域内沿主干道优先的 8 邻接 A* 自动寻路算法（纯函数）。
 *
 * 通行代价显著偏向石砌干道（road）与跨河木桥（bridge），引导大篷车主动沿主干道绕开深水、山脊与战区，
 * 并在斜向跨步时严禁切过不可通行角点。
 */
import { regionTerrainArray } from './regionGen.ts';
import { isPassableTerrain } from './routeDraw.ts';
import { TERRAIN_ORDER } from './worldGen.ts';
import type { RegionMap, TerrainType } from '../types.ts';

const MIN_COST_FACTOR = 0.42;

function pathStepWeight(t: TerrainType, evadeWar: boolean): number {
  switch (t) {
    case 'road':
    case 'bridge':
      return 0.42;
    case 'city':
    case 'village':
    case 'border_gate':
      return 0.55;
    case 'wasteland':
      return 1.25;
    case 'coast':
      return 1.4;
    case 'ruin':
      return 1.65;
    case 'forest':
      return 1.9;
    case 'warzone':
      return evadeWar ? 8.5 : 2.35;
    case 'swamp':
      return 3.4;
    default:
      return Infinity;
  }
}

function terrainAt(terArr: Uint8Array, w: number, h: number, gx: number, gy: number): TerrainType {
  if (gx < 0 || gy < 0 || gx >= w || gy >= h) return 'outside';
  return TERRAIN_ORDER[terArr[gy * w + gx]!] ?? 'outside';
}

function findNearestPassable(
  terArr: Uint8Array,
  w: number,
  h: number,
  gx: number,
  gy: number,
): { x: number; y: number } | null {
  const clampedX = Math.max(0, Math.min(w - 1, gx));
  const clampedY = Math.max(0, Math.min(h - 1, gy));
  if (isPassableTerrain(terrainAt(terArr, w, h, clampedX, clampedY))) {
    return { x: clampedX, y: clampedY };
  }
  for (let r = 1; r <= 3; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        const nx = clampedX + dx;
        const ny = clampedY + dy;
        if (isPassableTerrain(terrainAt(terArr, w, h, nx, ny))) {
          return { x: nx, y: ny };
        }
      }
    }
  }
  return null;
}

export function findAutoRoute(
  map: RegionMap,
  startPos: { x: number; y: number },
  targetPos: { x: number; y: number },
  evadeWar = false,
): { x: number; y: number }[] {
  const w = map.width;
  const h = map.height;
  const total = w * h;
  const terArr = regionTerrainArray(map);

  const startTile = findNearestPassable(terArr, w, h, Math.floor(startPos.x), Math.floor(startPos.y));
  const goalTile = findNearestPassable(terArr, w, h, Math.floor(targetPos.x), Math.floor(targetPos.y));
  if (!startTile || !goalTile) return [];

  const startIdx = startTile.y * w + startTile.x;
  const goalIdx = goalTile.y * w + goalTile.x;
  if (startIdx === goalIdx) {
    return [startPos, { x: goalTile.x + 0.5, y: goalTile.y + 0.5 }];
  }

  const gScore = new Float64Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const heapNode: number[] = [];
  const heapF: number[] = [];

  const pushHeap = (node: number, f: number) => {
    let i = heapNode.length;
    heapNode.push(node);
    heapF.push(f);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapF[p]! <= f) break;
      heapNode[i] = heapNode[p]!;
      heapF[i] = heapF[p]!;
      i = p;
    }
    heapNode[i] = node;
    heapF[i] = f;
  };

  const popHeap = (): number | undefined => {
    if (!heapNode.length) return undefined;
    const top = heapNode[0]!;
    const lastN = heapNode.pop()!;
    const lastF = heapF.pop()!;
    if (heapNode.length) {
      let i = 0;
      const n = heapNode.length;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < n && heapF[l]! < (best === i ? lastF : heapF[best]!)) best = l;
        if (r < n && heapF[r]! < (best === i ? lastF : heapF[best]!)) best = r;
        if (best === i) break;
        heapNode[i] = heapNode[best]!;
        heapF[i] = heapF[best]!;
        i = best;
      }
      heapNode[i] = lastN;
      heapF[i] = lastF;
    }
    return top;
  };

  gScore[startIdx] = 0;
  pushHeap(startIdx, Math.hypot(goalTile.x - startTile.x, goalTile.y - startTile.y) * MIN_COST_FACTOR);

  const dirs: [number, number, number][] = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];

  let found = false;
  while (heapNode.length) {
    const cur = popHeap()!;
    if (cur === goalIdx) {
      found = true;
      break;
    }
    if (closed[cur]) continue;
    closed[cur] = 1;

    const cx = cur % w;
    const cy = (cur - cx) / w;
    const curG = gScore[cur]!;

    for (const [dx, dy, baseDist] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (closed[ni]) continue;

      const ter = terrainAt(terArr, w, h, nx, ny);
      if (!isPassableTerrain(ter)) continue;

      // 斜向移动必须确保两侧正交邻格皆可通行，严禁穿切不可通行河岸或山脚角点
      if (dx !== 0 && dy !== 0) {
        const tx = terrainAt(terArr, w, h, cx + dx, cy);
        const ty = terrainAt(terArr, w, h, cx, cy + dy);
        if (!isPassableTerrain(tx) || !isPassableTerrain(ty)) continue;
      }

      const stepCost = baseDist * pathStepWeight(ter, evadeWar);
      const nextG = curG + stepCost;
      if (nextG < gScore[ni]!) {
        gScore[ni] = nextG;
        parent[ni] = cur;
        const hEst = Math.hypot(goalTile.x - nx, goalTile.y - ny) * MIN_COST_FACTOR;
        pushHeap(ni, nextG + hEst);
      }
    }
  }

  if (!found) return [];

  const cells: { x: number; y: number; ter: TerrainType }[] = [];
  let trace = goalIdx;
  while (trace >= 0) {
    const x = trace % w;
    const y = (trace - x) / w;
    cells.push({ x, y, ter: terrainAt(terArr, w, h, x, y) });
    if (trace === startIdx) break;
    trace = parent[trace]!;
  }
  cells.reverse();

  // 保留拐点与地形变化节点（如跨越桥梁），过滤冗余共线中间点并精确锚定起点坐标
  const points: { x: number; y: number }[] = [
    { x: startPos.x, y: startPos.y },
  ];
  for (let i = 1; i < cells.length - 1; i += 1) {
    const prev = cells[i - 1]!;
    const cur = cells[i]!;
    const next = cells[i + 1]!;
    const sameDir = (cur.x - prev.x === next.x - cur.x) && (cur.y - prev.y === next.y - cur.y);
    const terChanged = cur.ter !== prev.ter || cur.ter !== next.ter;
    if (!sameDir || terChanged) {
      points.push({ x: cur.x + 0.5, y: cur.y + 0.5 });
    }
  }
  const last = cells[cells.length - 1]!;
  const endPt = { x: last.x + 0.5, y: last.y + 0.5 };
  const tail = points[points.length - 1]!;
  if (Math.hypot(endPt.x - tail.x, endPt.y - tail.y) > 0.05) {
    points.push(endPt);
  }
  return points;
}
