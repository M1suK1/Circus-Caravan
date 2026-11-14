import { useId } from 'react';

/**
 * 古旧羊皮纸右上角立体翻折卷角（Dog-Ear Curl），复刻手撕焦边翻折反面肌理与投射暗影。
 */
export function VellumDogEar({ id, compact = false }: { id?: string; compact?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const shadowId = `dogear-shadow-${uid}`;
  const flapId = `dogear-flap-${uid}`;

  return (
    <span id={id} className={`vellum-dogear ${compact ? 'compact' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 76 66" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id={shadowId} x1="58" y1="16" x2="10" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1b0d04" stopOpacity="0.62" />
            <stop offset="55%" stopColor="#2c1607" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2c1607" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={flapId} x1="42" y1="14" x2="16" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f5dab0" />
            <stop offset="32%" stopColor="#d99f59" />
            <stop offset="72%" stopColor="#945923" />
            <stop offset="100%" stopColor="#46240b" />
          </linearGradient>
        </defs>
        {/* 投射在羊皮纸正面的柔和卷角暗影 */}
        <path
          d="M6 2 C24 14, 52 34, 74 56 L52 64 L22 54 L4 28 Z"
          fill={`url(#${shadowId})`}
        />
        {/* 翻折过来的古羊皮背面与不规则撕裂焦边 */}
        <path
          d="M8 0 C31 11, 55 29, 76 54 L63 55 L56 49 L47 52 L39 44 L30 45 L24 36 L15 31 L17 21 L9 12 Z"
          fill={`url(#${flapId})`}
          stroke="#3b1f0a"
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
        {/* 卷折脊部弧形受光高光线 */}
        <path
          d="M10 1.5 C32 12.5, 54 29.5, 74 52.5"
          stroke="#fbe8c7"
          strokeOpacity="0.65"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
