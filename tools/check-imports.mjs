#!/usr/bin/env node
/**
 * 架构护栏：检查 src/rules 与 src/domain 的依赖图、文件体积与 BOM。
 *
 *   node tools/check-imports.mjs
 *
 * 规则：
 *   1. src/rules 与 src/domain 单文件 ≤ 450 行（act.ts ≤ 300）。
 *   2. 同目录内不得成环；src/domain 不得反向 import src/rules。
 *   3. persistence.ts 是终点：除了 act.ts 之外没有 rules 模块可以 import 它。
 *   4. 全仓源文件禁止 UTF-8 BOM。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const problems = [];

function checkLayer(layerName, options) {
  const dir = join(root, 'src', layerName);
  if (!existsSync(dir)) return 0;
  const files = readdirSync(dir).filter(name => name.endsWith('.ts')).sort();
  const graph = new Map();

  for (const name of files) {
    const filePath = join(dir, name);
    const text = readFileSync(filePath, 'utf8');
    const lines = text.split('\n').length;
    const limit = options.limits?.[name] ?? options.limit;
    if (lines > limit) problems.push(`${layerName}/${name} 有 ${lines} 行，超过上限 ${limit}`);

    const deps = new Set();
    for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      if (!spec.startsWith('.')) continue;
      const target = resolve(dirname(filePath), spec);
      const relToSrc = relative(join(root, 'src'), target).replace(/\\/g, '/');
      if (options.forbidRules && relToSrc.startsWith('rules/')) {
        problems.push(`${layerName}/${name} 不得反向依赖 ${relToSrc}`);
      }
      const targetName = relative(dir, target).replace(/\\/g, '/');
      if (!targetName.startsWith('..') && targetName.endsWith('.ts')) {
        deps.add(targetName);
        if (options.sink && targetName === options.sink && name !== options.sinkAllowedBy) {
          problems.push(`${layerName}/${name} 依赖了终点模块 ${targetName}`);
        }
      }
    }
    graph.set(name, [...deps]);
  }

  const state = new Map();
  const stack = [];
  const walk = name => {
    if (state.get(name) === 'done') return;
    if (state.get(name) === 'open') {
      const at = stack.indexOf(name);
      problems.push(`${layerName} 循环依赖：${[...stack.slice(at), name].join(' → ')}`);
      return;
    }
    state.set(name, 'open');
    stack.push(name);
    for (const next of graph.get(name) ?? []) walk(next);
    stack.pop();
    state.set(name, 'done');
  };
  for (const name of files) walk(name);
  return files.length;
}

const rulesCount = checkLayer('rules', {
  limit: 450,
  limits: { 'act.ts': 300 },
  sink: 'persistence.ts',
  sinkAllowedBy: 'act.ts',
});
const domainCount = checkLayer('domain', {
  limit: 450,
  forbidRules: true,
});

const bomTargets = ['package.json', 'tsconfig.json', 'index.html', '.gitignore'];
const bomWalk = (dir, ext) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { bomWalk(full, ext); continue; }
    if (ext.test(entry.name)) bomTargets.push(relative(root, full));
  }
};
for (const dir of ['src', 'tools', 'tests', 'scripts']) {
  if (existsSync(join(root, dir))) bomWalk(join(root, dir), /\.(ts|tsx|mjs|js|json|md|css|html)$/);
}
for (const name of bomTargets) {
  const full = join(root, name);
  if (!statSync(full, { throwIfNoEntry: false })?.isFile()) continue;
  const buffer = readFileSync(full);
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    problems.push(`${name} 带 UTF-8 BOM`);
  }
}

if (problems.length) {
  console.error(`check-imports 失败（${problems.length} 项）：`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`check-imports 通过：rules ${rulesCount} 模块、domain ${domainCount} 模块、无环、体积达标、无 BOM。`);
