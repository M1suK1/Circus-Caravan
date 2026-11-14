/**
 * 128×128 拟真大陆板块构造、造山带高度场与顺坡蜿蜒水系算法。
 *
 * 多板块克拉通折线脊 + 深水海湾切割 + 弧形海沟群岛 + 双层域扭曲海岸线 + 四邻接顺坡水系。
 */
import type { WorldLake, WorldRiver } from '../types.ts';

export const WORLD_WIDTH = 128;
export const WORLD_HEIGHT = 128;

export function hashInt(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2d(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2d(x: number, y: number, scale: number, seed: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const n00 = hash2d(ix, iy, seed);
  const n10 = hash2d(ix + 1, iy, seed);
  const n01 = hash2d(ix, iy + 1, seed);
  const n11 = hash2d(ix + 1, iy + 1, seed);
  const nx0 = n00 + (n10 - n00) * ux;
  const nx1 = n01 + (n11 - n01) * ux;
  return nx0 + (nx1 - nx0) * uy;
}

export function fbm2d(x: number, y: number, seed: number): number {
  return (
    valueNoise2d(x, y, 22, seed) * 0.52 +
    valueNoise2d(x, y, 10, seed + 17) * 0.30 +
    valueNoise2d(x, y, 4.5, seed + 53) * 0.18
  );
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

export interface TectonicField {
  elevation: Float32Array;
  isOcean: Uint8Array;
  isMountain: Uint8Array;
  isCoast: Uint8Array;
}

export function buildTectonicContinent(seed: number): TectonicField {
  const rng = createRng(hashInt(`tectonics:${seed}`));
  const total = WORLD_WIDTH * WORLD_HEIGHT;
  const elevation = new Float32Array(total);
  const isOcean = new Uint8Array(total);
  const isMountain = new Uint8Array(total);
  const isCoast = new Uint8Array(total);

  const rot = rng() * Math.PI * 2;
  const pt = (angOff: number, rad: number) => ({
    x: 64 + Math.cos(rot + angOff) * rad,
    y: 64 + Math.sin(rot + angOff) * rad,
  });

  // 多段不对称大陆板块脊（主陆核 + 四条外伸半岛岬角）
  const pCenter = { x: 64 + (rng() - 0.5) * 7, y: 64 + (rng() - 0.5) * 7 };
  const pCapes = [
    pt(0.0, 50 + rng() * 5),
    pt(1.92 + (rng() - 0.5) * 0.25, 48 + rng() * 6),
    pt(3.42 + (rng() - 0.5) * 0.25, 45 + rng() * 6),
    pt(4.86 + (rng() - 0.5) * 0.22, 43 + rng() * 5),
  ];
  const spines = [
    { a: pCenter, b: pCapes[0]!, width: 25.5, amp: 0.90 },
    { a: pCenter, b: pCapes[1]!, width: 23.5, amp: 0.87 },
    { a: pCenter, b: pCapes[2]!, width: 21.5, amp: 0.84 },
    { a: pCenter, b: pCapes[3]!, width: 18.0, amp: 0.78 },
    { a: pt(0.88, 19), b: pt(2.68, 22), width: 27.0, amp: 0.86 },
  ];

  // 两条从外海深切入大陆的海湾/内海（彻底打破同心圆轮廓）
  const gulfs = [
    { a: pt(1.02, 64), b: pt(1.05 + (rng() - 0.5) * 0.16, 21 + rng() * 4), width: 13.5, depth: 0.60 },
    { a: pt(4.15, 64), b: pt(4.12 + (rng() - 0.5) * 0.16, 24 + rng() * 4), width: 12.5, depth: 0.54 },
  ];

  // 弧形海沟群岛链（细长不规则岛屿，而非正圆斑点）
  const islandArcs = Array.from({ length: 9 }, (_, i) => {
    const arcBase = (i < 5 ? 1.04 : 4.16) + ((i % 5) - 2) * 0.17 + (rng() - 0.5) * 0.08;
    const rad = 43 + (i % 3) * 5 + rng() * 4;
    const c = pt(arcBase, rad);
    const dir = arcBase + Math.PI * 0.5 + (rng() - 0.5) * 0.6;
    const halfLen = 2.6 + rng() * 3.0;
    return {
      ax: c.x - Math.cos(dir) * halfLen,
      ay: c.y - Math.sin(dir) * halfLen,
      bx: c.x + Math.cos(dir) * halfLen,
      by: c.y + Math.sin(dir) * halfLen,
      r: 2.6 + rng() * 2.1,
    };
  });

  const orogenyA = { a: pt(0.35, 36), b: pt(3.15, 34) };
  const orogenyB = { a: pt(1.85, 38), b: pt(5.05, 28) };

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const idx = y * WORLD_WIDTH + x;
      if (x <= 2 || y <= 2 || x >= WORLD_WIDTH - 3 || y >= WORLD_HEIGHT - 3) {
        isOcean[idx] = 1;
        elevation[idx] = 0;
        continue;
      }

      const wx = x
        + (fbm2d(x, y, seed + 11) - 0.5) * 21
        + (valueNoise2d(x, y, 5.2, seed + 29) - 0.5) * 6.5;
      const wy = y
        + (fbm2d(x, y, seed + 47) - 0.5) * 21
        + (valueNoise2d(x, y, 5.2, seed + 71) - 0.5) * 6.5;

      let base = 0;
      for (const sp of spines) {
        const d = distToSegment(wx, wy, sp.a.x, sp.a.y, sp.b.x, sp.b.y) / sp.width;
        if (d < 1.45) {
          const contrib = sp.amp * Math.max(0, 1 - d * d * 0.66);
          if (contrib > base) base = contrib;
        }
      }

      for (const g of gulfs) {
        const dg = distToSegment(wx, wy, g.a.x, g.a.y, g.b.x, g.b.y) / g.width;
        if (dg < 1.0) base -= g.depth * (1 - dg * dg);
      }

      for (const isl of islandArcs) {
        const di = distToSegment(wx, wy, isl.ax, isl.ay, isl.bx, isl.by) / isl.r;
        if (di < 1.25) base = Math.max(base, 0.56 - di * 0.26);
      }

      const detail = (valueNoise2d(x, y, 7.5, seed + 113) - 0.5) * 0.24
        + (valueNoise2d(x, y, 3.4, seed + 157) - 0.5) * 0.15;
      const edgeDist = Math.min(x, y, WORLD_WIDTH - 1 - x, WORLD_HEIGHT - 1 - y);
      const borderFade = edgeDist < 10 ? (edgeDist - 2.2) / 7.8 : 1;

      let h = (base + detail) * Math.max(0, Math.min(1, borderFade));

      if (h >= 0.34) {
        const dMtn = Math.min(
          distToSegment(wx, wy, orogenyA.a.x, orogenyA.a.y, orogenyA.b.x, orogenyA.b.y),
          distToSegment(wx, wy, orogenyB.a.x, orogenyB.a.y, orogenyB.b.x, orogenyB.b.y),
        );
        const ridgeRaw = 1 - Math.abs(2 * valueNoise2d(wx, wy, 9.5, seed + 211) - 1);
        const belt = Math.max(0, 1 - dMtn / 14) * ridgeRaw * ridgeRaw;
        h += belt * 0.52;
      }

      elevation[idx] = h;
      if (h < 0.34) isOcean[idx] = 1;
      else if (h >= 0.91) isMountain[idx] = 1;
    }
  }

  for (let y = 2; y < WORLD_HEIGHT - 2; y += 1) {
    for (let x = 2; x < WORLD_WIDTH - 2; x += 1) {
      const idx = y * WORLD_WIDTH + x;
      if (isOcean[idx] || isMountain[idx]) continue;
      const touchesSea = Boolean(
        isOcean[idx - 1] || isOcean[idx + 1] || isOcean[idx - WORLD_WIDTH] || isOcean[idx + WORLD_WIDTH],
      );
      if (touchesSea && elevation[idx]! < 0.46) isCoast[idx] = 1;
    }
  }

  return { elevation, isOcean, isMountain, isCoast };
}

export function carveHydrology(
  field: TectonicField,
  seed: number,
): { lakes: WorldLake[]; rivers: WorldRiver[]; isLake: Uint8Array; isRiver: Uint8Array } {
  const rng = createRng(hashInt(`hydro:${seed}`));
  const total = WORLD_WIDTH * WORLD_HEIGHT;
  const isLake = new Uint8Array(total);
  const isRiver = new Uint8Array(total);
  const lakes: WorldLake[] = [];

  for (let attempt = 0; attempt < 95 && lakes.length < 4; attempt += 1) {
    const cx = Math.round(22 + rng() * 84);
    const cy = Math.round(22 + rng() * 84);
    const cIdx = cy * WORLD_WIDTH + cx;
    if (field.isOcean[cIdx] || field.isMountain[cIdx]) continue;
    if (lakes.some(l => Math.hypot(l.centerX - cx, l.centerY - cy) < 18)) continue;
    let nearSea = false;
    for (let dy = -3; dy <= 3 && !nearSea; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        if (field.isOcean[(cy + dy) * WORLD_WIDTH + (cx + dx)]) nearSea = true;
      }
    }
    if (nearSea) continue;

    const radius = 2 + Math.floor(rng() * 2);
    lakes.push({ id: `lake-${lakes.length + 1}`, centerX: cx, centerY: cy, radius });
    for (let dy = -radius - 1; dy <= radius + 1; dy += 1) {
      for (let dx = -radius - 1; dx <= radius + 1; dx += 1) {
        const lx = cx + dx;
        const ly = cy + dy;
        const warp = (valueNoise2d(lx, ly, 3.2, seed + 307 + lakes.length * 19) - 0.5) * 1.6;
        if (Math.hypot(dx, dy) <= radius + 0.35 + warp) {
          const li = ly * WORLD_WIDTH + lx;
          if (!field.isOcean[li]) {
            isLake[li] = 1;
            field.isMountain[li] = 0;
          }
        }
      }
    }
  }

  const seaDist = new Int16Array(total).fill(999);
  const bfs: number[] = [];
  for (let i = 0; i < total; i += 1) {
    if (field.isOcean[i]) {
      seaDist[i] = 0;
      bfs.push(i);
    }
  }
  let head = 0;
  while (head < bfs.length) {
    const cur = bfs[head++]!;
    const cx = cur % WORLD_WIDTH;
    const cy = (cur - cx) / WORLD_WIDTH;
    const nextD = seaDist[cur]! + 1;
    if (cx > 0 && seaDist[cur - 1]! > nextD) { seaDist[cur - 1] = nextD; bfs.push(cur - 1); }
    if (cx + 1 < WORLD_WIDTH && seaDist[cur + 1]! > nextD) { seaDist[cur + 1] = nextD; bfs.push(cur + 1); }
    if (cy > 0 && seaDist[cur - WORLD_WIDTH]! > nextD) { seaDist[cur - WORLD_WIDTH] = nextD; bfs.push(cur - WORLD_WIDTH); }
    if (cy + 1 < WORLD_HEIGHT && seaDist[cur + WORLD_WIDTH]! > nextD) { seaDist[cur + WORLD_WIDTH] = nextD; bfs.push(cur + WORLD_WIDTH); }
  }

  const sources: { x: number; y: number; h: number }[] = [];
  for (let y = 12; y < WORLD_HEIGHT - 12; y += 2) {
    for (let x = 12; x < WORLD_WIDTH - 12; x += 2) {
      const idx = y * WORLD_WIDTH + x;
      if (field.isOcean[idx] || isLake[idx]) continue;
      if (seaDist[idx]! >= 10 && field.elevation[idx]! >= 0.50) {
        sources.push({ x, y, h: field.elevation[idx]! + seaDist[idx]! * 0.01 + rng() * 0.16 });
      }
    }
  }
  sources.sort((a, b) => b.h - a.h);

  const chosenSources: { x: number; y: number }[] = [];
  const rivers: WorldRiver[] = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

  for (const src of sources) {
    if (rivers.length >= 5) break;
    if (chosenSources.some(s => Math.hypot(s.x - src.x, s.y - src.y) < 16)) continue;

    const points: { x: number; y: number }[] = [{ x: src.x, y: src.y }];
    const visited = new Uint8Array(total);
    visited[src.y * WORLD_WIDTH + src.x] = 1;
    let cx = src.x;
    let cy = src.y;
    let reachedSink = false;

    for (let step = 0; step < 190; step += 1) {
      let bestNx = -1;
      let bestNy = -1;
      let bestScore = Infinity;

      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 1 || ny < 1 || nx >= WORLD_WIDTH - 1 || ny >= WORLD_HEIGHT - 1) continue;
        const nIdx = ny * WORLD_WIDTH + nx;
        if (visited[nIdx]) continue;
        const meander = (valueNoise2d(nx, ny, 4.2, seed + 509 + rivers.length * 37) - 0.5) * 0.13;
        const score = seaDist[nIdx]! * 0.048 + field.elevation[nIdx]! * 0.52 + meander;
        if (score < bestScore) {
          bestScore = score;
          bestNx = nx;
          bestNy = ny;
        }
      }

      if (bestNx < 0) break;
      cx = bestNx;
      cy = bestNy;
      const cIdx = cy * WORLD_WIDTH + cx;
      visited[cIdx] = 1;
      points.push({ x: cx, y: cy });

      if (field.isOcean[cIdx] || (points.length >= 13 && isRiver[cIdx])) {
        reachedSink = true;
        break;
      }
    }

    if (reachedSink && points.length >= 11) {
      chosenSources.push(src);
      for (const pt of points) {
        const pIdx = pt.y * WORLD_WIDTH + pt.x;
        if (!field.isOcean[pIdx] && !isLake[pIdx]) {
          isRiver[pIdx] = 1;
          field.isMountain[pIdx] = 0;
        }
      }
      rivers.push({ id: `river-${rivers.length + 1}`, points });
    }
  }

  return { lakes, rivers, isLake, isRiver };
}
