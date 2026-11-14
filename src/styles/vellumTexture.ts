/**
 * 离屏程序化古旧羊皮纸斑驳茶渍与焦褐包浆纹理生成器（启动时一次性合成，零实时滤镜开销）。
 *
 * 复刻陈年手稿的三大器物肌理：
 *  1. 云状不均匀浅赭/浓茶水渍晕染（Cloudy Tea & Sepia Mottling）；
 *  2. 四周边缘不规则碳化焦褐渗入（Irregular Scorched Umber Rim）；
 *  3. 细微陈年霉斑与羊皮纤维肌理（Foxing Specks & Vellum Grain）。
 */
import { valueNoise2d } from '../domain/worldTectonics.ts';

let initialized = false;

function sampleFbm(x: number, y: number, seed: number): number {
  return (
    valueNoise2d(x, y, 68, seed) * 0.50 +
    valueNoise2d(x, y, 28, seed + 31) * 0.30 +
    valueNoise2d(x, y, 11, seed + 79) * 0.20
  );
}

export function initAntiqueVellumTextures(): void {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;

  const size = 320;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = ctx.createImageData(size, size);
  const data = img.data;
  const seed = 1897;

  for (let y = 0; y < size; y += 1) {
    const ny = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const nx = x / (size - 1);
      const cloud = sampleFbm(x, y, seed);
      const blotch = sampleFbm(x + 120, y + 65, seed + 137);
      const grain = valueNoise2d(x, y, 2.4, seed + 251);

      // 基础陈年羊皮纸底色：在暖米黄 (#f0dec0) 与旧茶赭 (#c9a16d) 之间呈水彩云斑过渡
      const stain = Math.max(0, Math.min(1, cloud * 0.68 + blotch * 0.42 - 0.12));
      let r = 243 - stain * 48 + (grain - 0.5) * 12;
      let g = 223 - stain * 56 + (grain - 0.5) * 11;
      let b = 188 - stain * 64 + (grain - 0.5) * 10;

      // 四周不规则火烤焦褐边（边缘渗入深度随噪声起伏，四角自然加重）
      const dEdge = Math.min(nx, 1 - nx, ny, 1 - ny);
      const dCorner = Math.min(
        Math.hypot(nx, ny),
        Math.hypot(1 - nx, ny),
        Math.hypot(nx, 1 - ny),
        Math.hypot(1 - nx, 1 - ny),
      );
      const rimReach = 0.045 + blotch * 0.085 + (dCorner < 0.22 ? (0.22 - dCorner) * 0.28 : 0);
      if (dEdge < rimReach) {
        const t = 1 - dEdge / Math.max(0.01, rimReach);
        const burn = Math.min(1, t * t * (0.78 + cloud * 0.48));
        // 从烤琥珀褐过渡至边缘浓焦黑褐 (#341c0a)
        r = r * (1 - burn) + 54 * burn;
        g = g * (1 - burn) + 29 * burn;
        b = b * (1 - burn) + 11 * burn;
      }

      // 零星陈年氧化褐色霉斑（Foxing spots）
      const speck = valueNoise2d(x, y, 4.2, seed + 409);
      if (speck > 0.84 && blotch > 0.48) {
        const sp = (speck - 0.84) * 3.2;
        r -= sp * 42;
        g -= sp * 46;
        b -= sp * 44;
      }

      const p = (y * size + x) * 4;
      data[p] = Math.max(24, Math.min(252, Math.round(r)));
      data[p + 1] = Math.max(12, Math.min(240, Math.round(g)));
      data[p + 2] = Math.max(5, Math.min(214, Math.round(b)));
      data[p + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  document.documentElement.style.setProperty('--vellum-mottle-tex', `url("${dataUrl}")`);
}
