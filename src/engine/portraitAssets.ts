/**
 * 立绘资产外置剥离与恢复：让存档 JSON 只保存轻量资产 ID，大块 Base64 落资产仓。
 */
import type { CircusState } from '../types.ts';
import { assetDataUrl, assetPut, dataUrlToBlob, storeAvailable } from './store.ts';

async function offloadDataUrl(dataUrl: string, source: string): Promise<{ dataUrl: string; assetId?: string }> {
  if (!dataUrl.startsWith('data:image/') || dataUrl.length < 30_000) return { dataUrl };
  try {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return { dataUrl };
    const assetId = await assetPut(blob, { source });
    return { dataUrl: '', assetId };
  } catch {
    return { dataUrl };
  }
}

export async function slimCircusAssets(state: CircusState): Promise<CircusState> {
  if (!storeAvailable()) return state;
  const performers = await Promise.all(state.performers.map(async performer => {
    let portrait = performer.portrait;
    let portraitAsset = performer.portraitAsset;
    if (portrait.startsWith('data:image/')) {
      const res = await offloadDataUrl(portrait, 'performer');
      if (res.assetId) { portrait = ''; portraitAsset = res.assetId; }
    }
    const wardrobe = await Promise.all(performer.wardrobe.map(async outfit => {
      if (!outfit.portrait?.startsWith('data:image/')) return outfit;
      const res = await offloadDataUrl(outfit.portrait, 'wardrobe');
      return res.assetId ? { ...outfit, portrait: '', portraitAsset: res.assetId } : outfit;
    }));
    return { ...performer, portrait, portraitAsset, wardrobe };
  }));

  const worldNpcs = await Promise.all(state.worldNpcs.map(async npc => {
    if (!npc.portrait.startsWith('data:image/')) return npc;
    const res = await offloadDataUrl(npc.portrait, 'npc');
    return res.assetId ? { ...npc, portrait: '', portraitAsset: res.assetId } : npc;
  }));

  return { ...state, performers, worldNpcs };
}

export async function hydrateCircusAssets(state: CircusState): Promise<CircusState> {
  if (!storeAvailable()) return state;
  const performers = await Promise.all(state.performers.map(async performer => {
    let portrait = performer.portrait;
    if (!portrait && performer.portraitAsset) {
      portrait = (await assetDataUrl(performer.portraitAsset)) ?? '';
    }
    const wardrobe = await Promise.all(performer.wardrobe.map(async outfit => {
      if (outfit.portrait || !outfit.portraitAsset) return outfit;
      return { ...outfit, portrait: (await assetDataUrl(outfit.portraitAsset)) ?? '' };
    }));
    return { ...performer, portrait, wardrobe };
  }));

  const worldNpcs = await Promise.all(state.worldNpcs.map(async npc => {
    if (npc.portrait || !npc.portraitAsset) return npc;
    return { ...npc, portrait: (await assetDataUrl(npc.portraitAsset)) ?? '' };
  }));

  return { ...state, performers, worldNpcs };
}
