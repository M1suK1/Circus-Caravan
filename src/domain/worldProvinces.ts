/**
 * 基于真实地理特征选址 + 多源加权 Dijkstra 测地线扩张划分 9 大区，
 * 并从生成的大陆省界提取对称的真实接壤邻区图。
 */
import { REGION_IDS } from '../content/regions.ts';
import type { Direction, RegionBounds, RegionId, RegionNeighbor } from '../types.ts';
import {
  createRng,
  hash2d,
  hashInt,
  type TectonicField,
  valueNoise2d,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './worldTectonics.ts';

export function partitionRegionsGeodesic(
  field: TectonicField,
  isLake: Uint8Array,
  isRiver: Uint8Array,
  seed: number,
): Uint8Array {
  const rng = createRng(hashInt(`provinces:${seed}`));
  const total = WORLD_WIDTH * WORLD_HEIGHT;

  // 找出最大四邻接连通大陆，确保 9 大区核心全部位于主陆，保证陆路互通
  const compId = new Int32Array(total).fill(-1);
  let bestComp = 0;
  let bestSize = 0;
  let nextComp = 0;
  const q: number[] = [];

  for (let i = 0; i < total; i += 1) {
    if (field.isOcean[i] || compId[i] !== -1) continue;
    const cid = nextComp++;
    compId[i] = cid;
    q.length = 0;
    q.push(i);
    let head = 0;
    while (head < q.length) {
      const cur = q[head++]!;
      const cx = cur % WORLD_WIDTH;
      const cy = (cur - cx) / WORLD_WIDTH;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= WORLD_WIDTH || ny >= WORLD_HEIGHT) continue;
        const ni = ny * WORLD_WIDTH + nx;
        if (!field.isOcean[ni] && compId[ni] === -1) {
          compId[ni] = cid;
          q.push(ni);
        }
      }
    }
    if (q.length > bestSize) {
      bestSize = q.length;
      bestComp = cid;
    }
  }

  const mainLand: { x: number; y: number; idx: number }[] = [];
  for (let y = 6; y < WORLD_HEIGHT - 6; y += 1) {
    for (let x = 6; x < WORLD_WIDTH - 6; x += 1) {
      const idx = y * WORLD_WIDTH + x;
      if (compId[idx] === bestComp && !field.isMountain[idx] && !isLake[idx]) {
        mainLand.push({ x, y, idx });
      }
    }
  }

  const scoreFor = (id: RegionId, x: number, y: number, idx: number): number => {
    const h = field.elevation[idx]!;
    const wet = valueNoise2d(x, y, 13, seed + 613);
    const rad = Math.hypot(x - 64, y - 64);
    switch (id) {
      case 'frost_bastion': return -y * 1.55 + h * 26 + wet * 8;
      case 'demon_realm': return rad * 1.30 + x * 0.60 - y * 0.40 + h * 24;
      case 'dawn_coast': return (field.isCoast[idx] ? 24 : 0) + x * 0.88 + y * 0.82 - h * 14;
      case 'sunken_marsh': return -h * 38 + y * 1.02 + wet * 24;
      case 'sand_oasis': return -x * 1.02 + y * 0.68 - wet * 22;
      case 'iron_wastes': return -x * 1.12 - y * 0.30 + h * 20;
      case 'ancient_forest': return wet * 36 - Math.abs(y - 36) * 0.65 - Math.abs(x - 55) * 0.28;
      case 'arcane_city': return x * 1.02 - Math.abs(y - 55) * 0.58 + wet * 16;
      case 'empire_heart': return -Math.hypot(x - 63, y - 61) * 1.18 - Math.abs(h - 0.55) * 18;
    }
  };

  const baseWeights: Record<RegionId, number> = {
    empire_heart: 1.38,
    iron_wastes: 1.22,
    ancient_forest: 1.16,
    frost_bastion: 1.04,
    sand_oasis: 0.98,
    sunken_marsh: 0.92,
    demon_realm: 0.84,
    dawn_coast: 0.80,
    arcane_city: 0.76,
  };

  const seeds: { id: RegionId; rIdx: number; x: number; y: number; sizeWeight: number }[] = [];
  for (const minSep of [18, 14, 10]) {
    seeds.length = 0;
    for (let rIdx = 0; rIdx < REGION_IDS.length; rIdx += 1) {
      const id = REGION_IDS[rIdx]!;
      let bestCell = mainLand[0]!;
      let bestScore = -Infinity;
      for (let k = 0; k < mainLand.length; k += 2) {
        const c = mainLand[k]!;
        if (seeds.some(s => Math.hypot(s.x - c.x, s.y - c.y) < minSep)) continue;
        const sc = scoreFor(id, c.x, c.y, c.idx) + (hash2d(c.x, c.y, seed + rIdx * 97) - 0.5) * 14;
        if (sc > bestScore) {
          bestScore = sc;
          bestCell = c;
        }
      }
      seeds.push({
        id,
        rIdx,
        x: bestCell.x,
        y: bestCell.y,
        sizeWeight: baseWeights[id] * (0.92 + rng() * 0.16),
      });
    }
    if (seeds.length === REGION_IDS.length) break;
  }

  const dist = new Float64Array(total);
  const owner = new Uint8Array(total);
  const heapIdx: number[] = [];
  const heapCost: number[] = [];

  const pushHeap = (cell: number, cost: number) => {
    let i = heapIdx.length;
    heapIdx.push(cell);
    heapCost.push(cost);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapCost[p]! <= cost) break;
      heapIdx[i] = heapIdx[p]!;
      heapCost[i] = heapCost[p]!;
      i = p;
    }
    heapIdx[i] = cell;
    heapCost[i] = cost;
  };

  const popHeap = (): { cell: number; cost: number } | undefined => {
    if (!heapIdx.length) return undefined;
    const topCell = heapIdx[0]!;
    const topCost = heapCost[0]!;
    const lastCell = heapIdx.pop()!;
    const lastCost = heapCost.pop()!;
    if (heapIdx.length) {
      let i = 0;
      const n = heapIdx.length;
      while (true) {
        let smallest = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < n && heapCost[l]! < (smallest === i ? lastCost : heapCost[smallest]!)) smallest = l;
        if (r < n && heapCost[r]! < (smallest === i ? lastCost : heapCost[smallest]!)) smallest = r;
        if (smallest === i) break;
        heapIdx[i] = heapIdx[smallest]!;
        heapCost[i] = heapCost[smallest]!;
        i = smallest;
      }
      heapIdx[i] = lastCell;
      heapCost[i] = lastCost;
    }
    return { cell: topCell, cost: topCost };
  };

  const runDijkstra = () => {
    dist.fill(Infinity);
    owner.fill(255);
    heapIdx.length = 0;
    heapCost.length = 0;
    for (const s of seeds) {
      const start = s.y * WORLD_WIDTH + s.x;
      dist[start] = 0;
      owner[start] = s.rIdx;
      pushHeap(start, 0);
    }
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    while (heapIdx.length) {
      const cur = popHeap()!;
      if (cur.cost > dist[cur.cell]!) continue;
      const rIdx = owner[cur.cell]!;
      const sw = seeds[rIdx]!.sizeWeight;
      const cx = cur.cell % WORLD_WIDTH;
      const cy = (cur.cell - cx) / WORLD_WIDTH;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= WORLD_WIDTH || ny >= WORLD_HEIGHT) continue;
        const ni = ny * WORLD_WIDTH + nx;
        let stepCost = 1.0 + valueNoise2d(nx, ny, 8.5, seed + 733) * 0.55;
        if (field.isOcean[ni]) stepCost = 9.5;
        else if (field.isMountain[ni]) stepCost = 4.6;
        else if (isRiver[ni] || isLake[ni]) stepCost = 3.8;
        const nextCost = cur.cost + stepCost / sw;
        if (nextCost + 1e-9 < dist[ni]!) {
          dist[ni] = nextCost;
          owner[ni] = rIdx;
          pushHeap(ni, nextCost);
        }
      }
    }
  };

  runDijkstra();
  for (let pass = 0; pass < 2; pass += 1) {
    const counts = new Int32Array(REGION_IDS.length);
    for (let i = 0; i < total; i += 1) {
      if (!field.isOcean[i] && owner[i]! < REGION_IDS.length) counts[owner[i]!] += 1;
    }
    let adjusted = false;
    for (let r = 0; r < REGION_IDS.length; r += 1) {
      if (counts[r]! < 220) {
        seeds[r]!.sizeWeight *= Math.min(1.85, Math.sqrt(280 / Math.max(25, counts[r]!)));
        adjusted = true;
      }
    }
    if (!adjusted) break;
    runDijkstra();
  }

  const regionGrid = new Uint8Array(total).fill(255);
  for (let i = 0; i < total; i += 1) {
    if (!field.isOcean[i]) regionGrid[i] = owner[i]!;
  }
  return regionGrid;
}

function cardinalDirection(from: RegionBounds, to: RegionBounds): Direction {
  const dx = to.centerX - from.centerX;
  const dy = to.centerY - from.centerY;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'south' : 'north';
}

export function extractWorldNeighbors(
  regionGrid: Uint8Array,
  regionBounds: Record<RegionId, RegionBounds>,
): Record<RegionId, RegionNeighbor[]> {
  const pairCounts = new Int32Array(9 * 9);
  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const idx = y * WORLD_WIDTH + x;
      const a = regionGrid[idx]!;
      if (a >= 9) continue;
      if (x + 1 < WORLD_WIDTH) {
        const b = regionGrid[idx + 1]!;
        if (b < 9 && b !== a) {
          pairCounts[a * 9 + b] += 1;
          pairCounts[b * 9 + a] += 1;
        }
      }
      if (y + 1 < WORLD_HEIGHT) {
        const b = regionGrid[idx + WORLD_WIDTH]!;
        if (b < 9 && b !== a) {
          pairCounts[a * 9 + b] += 1;
          pairCounts[b * 9 + a] += 1;
        }
      }
    }
  }

  const adj = Array.from({ length: 9 }, () => new Set<number>());
  for (let a = 0; a < 9; a += 1) {
    for (let b = a + 1; b < 9; b += 1) {
      if (pairCounts[a * 9 + b]! >= 2) {
        adj[a]!.add(b);
        adj[b]!.add(a);
      }
    }
  }

  // 半岛末端若只接壤 1 个陆邻，补充最近沿海邻省水陆渡口，确保每区 >= 2 条对称出境通道
  for (let a = 0; a < 9; a += 1) {
    while (adj[a]!.size < 2) {
      const bA = regionBounds[REGION_IDS[a]!];
      let bestB = -1;
      let bestDist = Infinity;
      for (let b = 0; b < 9; b += 1) {
        if (b === a || adj[a]!.has(b)) continue;
        const bB = regionBounds[REGION_IDS[b]!];
        const d = Math.hypot(bA.centerX - bB.centerX, bA.centerY - bB.centerY);
        if (d < bestDist) {
          bestDist = d;
          bestB = b;
        }
      }
      if (bestB < 0) break;
      adj[a]!.add(bestB);
      adj[bestB]!.add(a);
    }
  }

  const out = {} as Record<RegionId, RegionNeighbor[]>;
  for (let a = 0; a < 9; a += 1) {
    const idA = REGION_IDS[a]!;
    out[idA] = [...adj[a]!].sort((x, y) => x - y).map(b => {
      const idB = REGION_IDS[b]!;
      return {
        direction: cardinalDirection(regionBounds[idA], regionBounds[idB]),
        targetRegionId: idB,
      };
    });
  }
  return out;
}
