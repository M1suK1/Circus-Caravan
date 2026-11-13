import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_BOX_INDEX_KEY, CARD_BOX_KEY, CARD_RAW_PREFIX } from '../src/engine/cardbox.ts';
import { DB_NAME, kvGet, kvSet } from '../src/engine/store.ts';
import { SAVE_CURRENT_KEY } from '../src/rules/persistence.ts';

test('s1 存储与卡库命名空间严格隔离，不与 night-sugar-office 冲突', async () => {
  assert.equal(DB_NAME, 'circus-caravan');
  assert.ok(CARD_BOX_KEY.startsWith('circus-caravan:'));
  assert.ok(CARD_BOX_INDEX_KEY.startsWith('circus-caravan:'));
  assert.ok(CARD_RAW_PREFIX.startsWith('circus-caravan:'));
  assert.ok(SAVE_CURRENT_KEY.startsWith('circus-caravan/'));

  await kvSet('circus-caravan/test-key', { ok: true, n: 7 });
  const got = await kvGet<{ ok: boolean; n: number }>('circus-caravan/test-key');
  assert.deepEqual(got, { ok: true, n: 7 });
});
