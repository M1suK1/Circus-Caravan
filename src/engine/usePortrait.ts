import { useEffect, useState } from 'react';
import { assetUrl } from './store.ts';
import type { AssetId } from '../types.ts';

export function usePortraitSrc(subject: { portrait?: string; portraitAsset?: AssetId }): string {
  const [resolved, setResolved] = useState('');
  useEffect(() => {
    if (subject.portrait || !subject.portraitAsset) { setResolved(''); return; }
    let alive = true;
    void assetUrl(subject.portraitAsset)
      .then(url => { if (alive) setResolved(url ?? ''); })
      .catch(() => { /* 取不到就当没有图 */ });
    return () => { alive = false; };
  }, [subject.portrait, subject.portraitAsset]);
  return subject.portrait || resolved;
}
