/**
 * 统一叙事引擎网关（LLM Service）：
 *  - 支持离线模板模式（Offline Fallback）与实时叙事模式（Vertex AI / OpenAI 兼容）切换
 *  - 按需注入世界书上下文、接入 jsonRepair.ts 修复截断 JSON、严控数值提案安全边界
 *  - 引擎配置与密钥完全隔离于游戏存档 CircusState 之外
 */
import {
  DEFAULT_SCOPE_PROMPTS,
  type NarrativeScope,
  selectActiveWorldbookEntries,
} from '../content/promptTemplates.ts';
import { WORLDBOOK_ENTRIES } from '../content/worldbook.ts';
import type { RegionId } from '../types.ts';
import { closeTruncatedJson } from './jsonRepair.ts';
import { kvGet, kvSet } from './store.ts';
import { vertexChat } from './vertex.ts';

export const LLM_CONFIG_KEY = 'circus-caravan:llm:config';
export const LLM_SECRET_KEY = 'circus-caravan:llm:secret';

export interface LlmSettings {
  mode: 'offline' | 'llm';
  provider: 'vertex' | 'openai';
  model: string;
  location: string;
  openaiBaseUrl: string;
  thinking: boolean;
  prompts: Record<NarrativeScope, string>;
  enabledWorldbookIds: Record<string, boolean>;
}

export interface LlmProposal {
  bondDelta: number;
  moraleDelta: number;
  hopeDelta: number;
  repDelta: number;
}

export function defaultLlmSettings(): LlmSettings {
  return {
    mode: 'offline',
    provider: 'vertex',
    model: 'gemini-2.5-pro',
    location: 'us-central1',
    openaiBaseUrl: 'https://api.openai.com/v1',
    thinking: true,
    prompts: { ...DEFAULT_SCOPE_PROMPTS },
    enabledWorldbookIds: Object.fromEntries(WORLDBOOK_ENTRIES.map(e => [e.id, e.defaultEnabled])),
  };
}

let cachedSettings: LlmSettings | null = null;
let cachedSecret = '';

export async function loadLlmSettings(): Promise<{ settings: LlmSettings; hasSecret: boolean }> {
  if (!cachedSettings) {
    try {
      const saved = await kvGet<Partial<LlmSettings>>(LLM_CONFIG_KEY);
      const base = defaultLlmSettings();
      if (saved && typeof saved === 'object') {
        cachedSettings = {
          ...base,
          ...saved,
          prompts: { ...base.prompts, ...(saved.prompts ?? {}) },
          enabledWorldbookIds: { ...base.enabledWorldbookIds, ...(saved.enabledWorldbookIds ?? {}) },
        };
      } else {
        cachedSettings = base;
      }
    } catch {
      cachedSettings = defaultLlmSettings();
    }
  }
  if (!cachedSecret) {
    try {
      const sec = await kvGet<string>(LLM_SECRET_KEY);
      if (typeof sec === 'string') cachedSecret = sec;
    } catch {
      /* 测试环境无存储时保持空字符串 */
    }
  }
  return { settings: cachedSettings, hasSecret: cachedSecret.trim().length > 0 };
}

export async function saveLlmSettings(settings: LlmSettings, secret?: string): Promise<void> {
  cachedSettings = settings;
  await kvSet(LLM_CONFIG_KEY, settings).catch(() => false);
  if (typeof secret === 'string') {
    cachedSecret = secret;
    await kvSet(LLM_SECRET_KEY, secret).catch(() => false);
  }
}

export function getCachedLlmSecret(): string {
  return cachedSecret;
}

/** 对模型返回的结构化数值提案做白名单夹逼，严禁 LLM 越界篡改经济真值 */
export function sanitizeLlmProposal(raw: Record<string, unknown> | null | undefined): LlmProposal {
  const clamp = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : 0;
  return {
    bondDelta: clamp(raw?.bondDelta, -3, 3),
    moraleDelta: clamp(raw?.moraleDelta, -4, 4),
    hopeDelta: clamp(raw?.hopeDelta, -5, 5),
    repDelta: clamp(raw?.repDelta, -5, 5),
  };
}

export function parseStructuredLlmJson<T>(rawText: string): T | null {
  const clean = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  if (!clean) return null;
  try {
    return JSON.parse(clean) as T;
  } catch {
    const repaired = closeTruncatedJson(clean);
    if (!repaired) return null;
    try {
      return JSON.parse(repaired) as T;
    } catch {
      return null;
    }
  }
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.75,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, message: body.error?.message ?? `HTTP ${res.status}` };
    }
    const text = body.choices?.[0]?.message?.content ?? '';
    return text.trim() ? { ok: true, text } : { ok: false, message: '空响应文本' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : '网络请求失败' };
  } finally {
    clearTimeout(timer);
  }
}

export async function callNarrativeLlm<T>(input: {
  scope: NarrativeScope;
  regionId: RegionId;
  keywords?: readonly string[];
  userPrompt: string;
  parseJson?: boolean;
  maxWorldbookChars?: number;
  fallback: () => T;
}): Promise<{ source: 'llm' | 'fallback'; data: T; rawText?: string; usedWorldbookCount: number; error?: string }> {
  const { settings, hasSecret } = await loadLlmSettings();
  const wbEntries = selectActiveWorldbookEntries(
    settings.enabledWorldbookIds,
    input.regionId,
    input.keywords ?? [],
    input.maxWorldbookChars ?? 1400,
  );

  if (settings.mode !== 'llm' || !hasSecret) {
    return {
      source: 'fallback',
      data: input.fallback(),
      usedWorldbookCount: wbEntries.length,
    };
  }

  const wbText = wbEntries.map(e => `【${e.title}】${e.content}`).join('\n');
  const scopePrompt = settings.prompts[input.scope] ?? DEFAULT_SCOPE_PROMPTS[input.scope];
  const systemPrompt = wbText ? `${scopePrompt}\n\n[激活世界书参考]\n${wbText}` : scopePrompt;

  const response = settings.provider === 'vertex'
    ? await vertexChat(
        { model: settings.model, location: settings.location, secret: cachedSecret, timeoutMs: 35_000 },
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
        { temperature: 0.75, maxTokens: 1200, thinking: settings.thinking },
      )
    : await callOpenAiCompatible(settings.openaiBaseUrl, cachedSecret, settings.model, systemPrompt, input.userPrompt);

  if (!response.ok) {
    return {
      source: 'fallback',
      data: input.fallback(),
      usedWorldbookCount: wbEntries.length,
      error: response.message,
    };
  }

  if (input.parseJson) {
    const parsed = parseStructuredLlmJson<T>(response.text);
    if (!parsed) {
      return {
        source: 'fallback',
        data: input.fallback(),
        rawText: response.text,
        usedWorldbookCount: wbEntries.length,
        error: '结构化 JSON 解析失败，已自动降级为本地模板。',
      };
    }
    return {
      source: 'llm',
      data: parsed,
      rawText: response.text,
      usedWorldbookCount: wbEntries.length,
    };
  }

  return {
    source: 'llm',
    data: response.text as unknown as T,
    rawText: response.text,
    usedWorldbookCount: wbEntries.length,
  };
}
