import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const css = () => readFileSync(resolve(root, 'src/styles/parchment.css'), 'utf8');
const src = (rel: string) => readFileSync(resolve(root, 'src', rel), 'utf8');

test('s2 羊皮纸不规则撕裂边缘（vellum-sheet）将 clip-path 隔离在 ::before 背景层，避免裁掉内容或焦点环', () => {
  const styles = css();
  assert.ok(styles.includes('.vellum-sheet'), '缺少 .vellum-sheet 羊皮纸卷轴样式');
  assert.ok(styles.includes('.vellum-sheet::before'), '撕裂不规则轮廓必须放在 ::before 背景片上');
  assert.match(styles, /\.vellum-sheet::before\s*\{[^}]*clip-path:\s*polygon\(/s, '::before 必须用多点不规则 polygon 表现撕裂羊皮纸边缘');
  assert.match(styles, /\.vellum-sheet\s*>\s*\*\s*\{[^}]*z-index:\s*1/s, '内容子元素应处于 z-index: 1 之上，不被底层滤镜或裁剪污染');
});

test('s2 丝绸书签（silk-bookmark / silk-tab）具备燕尾剪口、织物斜纹光泽且不破坏按钮焦点与投影', () => {
  const styles = css();
  assert.ok(styles.includes('.silk-bookmark'), '缺少侧边栏丝绸书签样式');
  assert.ok(styles.includes('.silk-bookmark-ribbon'), '书签必须用内层 .silk-bookmark-ribbon 承载燕尾 clip-path');
  assert.match(styles, /\.silk-bookmark-ribbon\s*\{[^}]*clip-path:\s*polygon\(/s, '内层丝绸书签需有燕尾剪口 clip-path');
  assert.ok(styles.includes('.silk-tab'), '缺少页内水平标签丝绸书签 .silk-tab');
  assert.match(styles, /\.silk-tab::before\s*\{[^}]*clip-path:\s*polygon\(/s, '垂直吊挂书签 ::before 应具备底部燕尾剪口');

  const shell = src('components/Shell.tsx');
  assert.ok(shell.includes('silk-bookmark'), 'Shell.tsx 侧边栏主导航必须应用 .silk-bookmark');
  assert.ok(shell.includes('silk-bookmark-ribbon'), 'Shell.tsx 必须包含内层丝绸带装饰节点');
  assert.ok(shell.includes('id={`nav-${id}`}'), 'Shell.tsx 导航必须保留唯一描述性 ID');
});

test('s2 纸质便利贴（paper-note）具备微倾角、和纸胶带/铜钉固定件、悬停回正以及多色纸张层次', () => {
  const styles = css();
  assert.ok(styles.includes('.paper-note'), '缺少 .paper-note 便利贴样式');
  assert.ok(styles.includes('.paper-note::before'), '便利贴顶部应有胶带或铆钉固定装饰 ::before');
  assert.ok(styles.includes('.paper-note::after'), '便利贴底部应有翘角投影 ::after');
  assert.match(styles, /\.paper-note:hover[\s\S]*rotate\(0deg\)/, '便利贴悬停时应回正并浮起');

  for (const file of [
    'components/Cartography/CartographyView.tsx',
    'components/CaravanView.tsx',
    'components/SuppliesView.tsx',
    'components/RecordsView.tsx',
  ]) {
    const code = src(file);
    assert.ok(code.includes('paper-note'), `${file} 嵌在标签页里的功能块必须使用 .paper-note 便利贴样式`);
  }
});

test('s2 改造后全界面依然保持零 Emoji，全部使用矢量图标', () => {
  const files = [
    'components/Shell.tsx',
    'components/Cartography/CartographyView.tsx',
    'components/CaravanView.tsx',
    'components/SuppliesView.tsx',
    'components/RecordsView.tsx',
  ];
  for (const file of files) {
    const code = src(file);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(code), false, `${file} 不允许包含 emoji`);
  }
});
