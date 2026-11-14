/**
 * 《八方旅人》风巴洛克星盘罗盘顶徽、四周经纬刻度鎏金雕花外框与底部古典比例尺铭牌。
 *
 * 全程 pointer-events: none 悬浮于全屏大地图之上，四角固定比例不拉伸、中部导轨自适应任意桌面分辨率。
 */
import { useId } from 'react';

export function OrnateAtlasFrame({ regionName, scaleLabel }: { regionName: string; scaleLabel: string }) {
  const uid = useId().replace(/:/g, '');
  const brassGrad = `brass-grad-${uid}`;
  const crestGlow = `crest-glow-${uid}`;

  return (
    <div id="ornate-atlas-frame" className="octo-frame-overlay" aria-hidden="true">
      {/* 四周古铜双线经纬刻度画框 */}
      <div className="octo-frame-rail top" />
      <div className="octo-frame-rail bottom" />
      <div className="octo-frame-rail left" />
      <div className="octo-frame-rail right" />

      {/* 顶部中央巴洛克星盘罗盘绶带顶徽（对齐主舆图视觉中心） */}
      <div id="octo-astrolabe-crest" className="octo-astrolabe-crest">
        <svg viewBox="0 0 380 96" fill="none">
          <defs>
            <linearGradient id={brassGrad} x1="0" y1="0" x2="380" y2="92" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#c79b52" />
              <stop offset="32%" stopColor="#f7e2b2" />
              <stop offset="52%" stopColor="#d8aa5b" />
              <stop offset="78%" stopColor="#fae7bc" />
              <stop offset="100%" stopColor="#9c7032" />
            </linearGradient>
            <radialGradient id={crestGlow} cx="50%" cy="38%" r="54%">
              <stop offset="0%" stopColor="#fff3c8" stopOpacity="0.65" />
              <stop offset="60%" stopColor="#e5b462" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#e5b462" stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse cx="190" cy="40" rx="145" ry="44" fill={`url(#${crestGlow})`} />

          {/* 左右对称巴洛克卷草羽翼 */}
          <path
            d="M42 18 C78 18, 102 36, 134 38 C110 48, 86 44, 64 32 M338 18 C302 18, 278 36, 246 38 C270 48, 294 44, 316 32"
            stroke={`url(#${brassGrad})`}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M78 14 C104 26, 122 28, 142 22 M302 14 C276 26, 258 28, 238 22"
            stroke="#3a2512"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* 中央同心天体星盘圆环与放射经纬针 */}
          <circle cx="190" cy="36" r="34" fill="#ecd5a6" fillOpacity="0.92" stroke="#2c1b0d" strokeWidth="1.8" />
          <circle cx="190" cy="36" r="29" fill="none" stroke={`url(#${brassGrad})`} strokeWidth="2.2" />
          <circle cx="190" cy="36" r="21" fill="none" stroke="#472d16" strokeWidth="1" strokeDasharray="3 2.5" />
          <circle cx="190" cy="36" r="11" fill="#c99548" fillOpacity="0.32" stroke="#3b2411" strokeWidth="1.1" />
          <path
            d="M190 4v64M158 36h64M167 13l46 46M213 13l-46 46"
            stroke="#3b2411"
            strokeOpacity="0.58"
            strokeWidth="1"
          />

          {/* 左右双星盘副徽章 */}
          <circle cx="136" cy="54" r="10" fill="#edd6a8" stroke="#2c1b0d" strokeWidth="1.3" />
          <path d="M136 46v16M128 54h16" stroke="#5a391b" strokeWidth="1" />
          <circle cx="244" cy="54" r="10" fill="#edd6a8" stroke="#2c1b0d" strokeWidth="1.3" />
          <path d="M244 46v16M236 54h16" stroke="#5a391b" strokeWidth="1" />

          {/* 弧形古典羊皮铭文绶带 */}
          <path
            d="M118 28 Q190 6 262 28 L254 43 Q190 23 126 43 Z"
            fill="#f7e7c4"
            stroke="#2b1a0d"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M122 30 Q190 10 258 30"
            stroke="#b8843b"
            strokeWidth="1"
          />
          <text
            x="190"
            y="29"
            textAnchor="middle"
            fill="#2d1b0e"
            fontSize="9.5"
            fontWeight="700"
            letterSpacing="2.4"
            fontFamily="Georgia, 'Noto Serif SC', serif"
          >
            CIRCUS CARAVAN
          </text>
        </svg>
      </div>

      {/* 左下与右下古典狮鹫/风灯角饰卷草 */}
      <svg className="octo-corner-flourish bl" viewBox="0 0 92 92" fill="none">
        <path d="M6 86V18C6 28 18 36 28 48C18 54 14 68 30 76C44 82 62 78 82 86Z" fill="#ccb07c" fillOpacity="0.38" stroke="#2d1c0e" strokeWidth="1.4" />
        <path d="M12 80C22 62 36 58 54 74M14 52C24 46 32 50 36 60" stroke="#e8c684" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <svg className="octo-corner-flourish br" viewBox="0 0 92 92" fill="none">
        <path d="M86 86V18C86 28 74 36 64 48C74 54 78 68 62 76C48 82 30 78 10 86Z" fill="#ccb07c" fillOpacity="0.38" stroke="#2d1c0e" strokeWidth="1.4" />
        <path d="M80 80C70 62 56 58 38 74M78 52C68 46 60 50 56 60" stroke="#e8c684" strokeWidth="1.3" strokeLinecap="round" />
      </svg>

      {/* 底部中央古典石刻比例尺铭牌（Cartouche Scale Plaque） */}
      <div id="octo-scale-cartouche" className="octo-scale-cartouche">
        <span className="cartouche-wing left" />
        <div className="cartouche-plaque">
          <small>{regionName} · {scaleLabel}</small>
          <div className="cartouche-ruler">
            <i /><i /><i /><i /><i />
          </div>
        </div>
        <span className="cartouche-wing right" />
      </div>
    </div>
  );
}
