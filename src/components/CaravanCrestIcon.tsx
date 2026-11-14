/**
 * 残响大篷车原创矢量纹章与地图图例微缩图标组件（彻底替代原夜糖残留图标）。
 */

export function CaravanCrestIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      {/* 车顶三角巡游旗 */}
      <path d="M22.5 5.5v6.5M22.5 6l8.5 2.5-8.5 2.7Z" fill="#f5cf80" stroke="#faeccb" strokeWidth="1.2" strokeLinejoin="round" />
      {/* 拱形马戏条纹篷顶 */}
      <path d="M8 22.5C8 14 14.5 11.2 22.5 11.2S37 14 37 22.5Z" fill="#faecd0" stroke="#2d180d" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14.8 22.5c0.9-6.8 3.6-10.5 7.7-11.2-1.2 3.6-1.8 7.3-1.8 11.2ZM30.2 22.5c-0.9-6.8-3.6-10.5-7.7-11.2 1.2 3.6 1.8 7.3 1.8 11.2Z" fill="#b33629" />
      {/* 篷车木厢与暖光小窗 */}
      <rect x="9.2" y="22.5" width="26.6" height="10.5" rx="1.8" fill="#cf9147" stroke="#2d180d" strokeWidth="1.7" />
      <path d="M7.2 22.5h31.6" stroke="#f5cf80" strokeWidth="1.9" strokeLinecap="round" />
      <rect x="19" y="24.8" width="7" height="5.2" rx="2.4" fill="#ffeaad" stroke="#2d180d" strokeWidth="1.3" />
      {/* 前檐悬挂风灯 */}
      <path d="M36.5 21.8h3.5v2.8" stroke="#f7d58b" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="40" cy="26.5" r="4.8" fill="#ffd970" fillOpacity="0.35" />
      <circle cx="40" cy="26.5" r="2.2" fill="#fff4bd" stroke="#2d180d" strokeWidth="1.1" />
      {/* 前后木辐车轮 */}
      <circle cx="15.2" cy="35.5" r="5.3" fill="#3a2112" stroke="#f4cd7e" strokeWidth="1.7" />
      <circle cx="15.2" cy="35.5" r="1.7" fill="#faecd0" />
      <circle cx="29.8" cy="35.5" r="5.3" fill="#3a2112" stroke="#f4cd7e" strokeWidth="1.7" />
      <circle cx="29.8" cy="35.5" r="1.7" fill="#faecd0" />
    </svg>
  );
}

export function LegendCitySvg() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#f7e9cb" stroke="#5e3d22" strokeWidth="1.3" />
      <path d="M4.5 14.5V8.5h3V10h5V8.5h3v6Z" fill="#e8cfa3" stroke="#2b180d" strokeWidth="1.2" />
      <path d="M7.5 10L10 5l2.5 5Z" fill="#a63429" stroke="#2b180d" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

export function LegendVillageSvg() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#f7e9cb" stroke="#5e3d22" strokeWidth="1.3" />
      <path d="M5.5 10.5L10 6l4.5 4.5" fill="#c76f32" stroke="#2b180d" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="6.8" y="10.2" width="6.4" height="4.5" fill="#f2dfc0" stroke="#2b180d" strokeWidth="1.2" />
    </svg>
  );
}

export function LegendCaravanSvg() {
  return (
    <svg width={15} height={15} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 10.5C3.5 6.5 6.5 5 10 5s6.5 1.5 6.5 5.5Z" fill="#a63429" stroke="#2b180d" strokeWidth="1.2" />
      <rect x="4" y="10.5" width="12" height="4" fill="#d49448" stroke="#2b180d" strokeWidth="1.2" />
      <circle cx="7" cy="15.5" r="2.3" fill="#3a2112" stroke="#f2c97d" strokeWidth="1.1" />
      <circle cx="13" cy="15.5" r="2.3" fill="#3a2112" stroke="#f2c97d" strokeWidth="1.1" />
    </svg>
  );
}
