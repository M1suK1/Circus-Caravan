import { useId } from 'react';
import { getElementProfile } from '../domain/creatureTaxonomy.ts';
import type { BeastSpecies } from '../types.ts';

type MotifKind =
  | 'fox'
  | 'cat'
  | 'rabbit'
  | 'wolf_dog'
  | 'dragon'
  | 'bird_harpy'
  | 'deer'
  | 'jelly_whale'
  | 'serpent'
  | 'spider'
  | 'slime_frog'
  | 'iron_gear'
  | 'horn_demon'
  | 'sheep_spirit';

function detectMotif(species: BeastSpecies): MotifKind {
  const key = `${species.id} ${species.name}`;
  if (/fox|狐/.test(key)) return 'fox';
  if (/cat|猫|sphinx|斯芬克/.test(key)) return 'cat';
  if (/rabbit|兔/.test(key)) return 'rabbit';
  if (/wolf|hound|dog|狼|犬/.test(key)) return 'wolf_dog';
  if (/dragon|古龙|魔龙/.test(key)) return 'dragon';
  if (/bird|crow|owl|harpy|griffin|phoenix|finch|kite|gull|鸦|枭|哈比|狮鹫|不死鸟|钟雀|风筝|海鸥|塞壬|siren/.test(key)) return 'bird_harpy';
  if (/deer|fawn|spirit|鹿|森灵/.test(key)) return 'deer';
  if (/jelly|whale|clione|mermaid|angler|水母|鲸|海天使|鱼娘/.test(key)) return 'jelly_whale';
  if (/snake|rattler|lamia|hydra|croc|蛇|拉弥亚|鳄/.test(key)) return 'serpent';
  if (/spider|arachne|crab|蛛|蟹|蝎|scorpion|strider|黾/.test(key)) return 'spider';
  if (/slime|frog|toad|史莱姆|蛙/.test(key)) return 'slime_frog';
  if (/rat|beetle|automaton|armor|forge|pangolin|ferret|发条|鼠|甲虫|铠甲|炉心|蝘|鼬/.test(key)) return 'iron_gear';
  if (/minotaur|imp|gorgon|banshee|dullahan|cyclops|demon|牛头|魅魔|女妖|无头|独眼|角魔/.test(key)) return 'horn_demon';
  return 'sheep_spirit';
}

export function CreaturePortrait({
  species,
  size = 64,
  silhouetteOnly = false,
}: {
  species: BeastSpecies;
  size?: number;
  silhouetteOnly?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const el = getElementProfile(species.element);
  const motif = detectMotif(species);
  const isHumanoid =
    species.category === 'monstergirl' ||
    species.category === 'demon_army' ||
    species.category === 'domesticated';

  const bgId = `cp-bg-${uid}`;
  const auraId = `cp-aura-${uid}`;
  const ink = silhouetteOnly ? '#241a12' : '#23160d';
  const fillMain = silhouetteOnly ? '#3a2b1e' : '#f7e9cb';
  const fillAccent = silhouetteOnly ? '#2d2015' : el.color;
  const fillSub = silhouetteOnly ? '#332519' : '#d8b782';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className="creature-portrait-svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={bgId} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor={silhouetteOnly ? '#3a2d20' : '#2a1f17'} />
          <stop offset="100%" stopColor="#140e0a" />
        </radialGradient>
        <radialGradient id={auraId} cx="50%" cy="44%" r="48%">
          <stop offset="0%" stopColor={el.color} stopOpacity={silhouetteOnly ? '0.15' : '0.48'} />
          <stop offset="100%" stopColor={el.color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 古典羊皮铜版圆章底盘 */}
      <rect x="2" y="2" width="92" height="92" rx="12" fill={`url(#${bgId})`} stroke={silhouetteOnly ? '#5e4b38' : el.color} strokeWidth="2.2" />
      <rect x="6" y="6" width="84" height="84" rx="9" fill="none" stroke="#e8c98a" strokeOpacity={silhouetteOnly ? '0.18' : '0.35'} strokeDasharray="3 2.5" />
      <circle cx="48" cy="46" r="36" fill={`url(#${auraId})`} />

      {/* 物种特征背景配饰（翅膀 / 光环 / 尾巴 / 花冠 / 齿轮） */}
      {(motif === 'dragon' || motif === 'bird_harpy') && (
        <path
          d="M48 48 C28 28, 12 34, 14 54 C24 52, 34 54, 48 56 C62 54, 72 52, 82 54 C84 34, 68 28, 48 48 Z"
          fill={fillAccent}
          fillOpacity={silhouetteOnly ? 0.5 : 0.72}
          stroke={ink}
          strokeWidth="1.6"
        />
      )}
      {motif === 'fox' && (
        <path
          d="M52 68 C74 72, 84 52, 74 36 C68 42, 62 46, 56 58 Z"
          fill={fillAccent}
          stroke={ink}
          strokeWidth="1.6"
        />
      )}
      {motif === 'iron_gear' && (
        <circle cx="48" cy="46" r="26" fill="none" stroke={fillSub} strokeOpacity="0.45" strokeWidth="4" strokeDasharray="5 4" />
      )}
      {species.category === 'elite' && !silhouetteOnly && (
        <circle cx="48" cy="46" r="31" fill="none" stroke="#f5cf7b" strokeOpacity="0.55" strokeWidth="1.2" />
      )}

      {/* 核心主体：魔物娘人外半身像 vs 奇幻生物纹章剪影 */}
      {isHumanoid ? (
        <g stroke={ink} strokeWidth="1.6" strokeLinejoin="round">
          {/* 肩部与衣装 */}
          <path d="M26 84 C27 65, 36 58, 48 58 C60 58, 69 65, 70 84 Z" fill={fillAccent} />
          <path d="M36 60 L48 72 L60 60" fill={fillSub} />
          {/* 头发与头型 */}
          <path d="M31 44 C31 28, 40 22, 48 22 C56 22, 65 28, 65 44 C65 55, 58 60, 48 60 C38 60, 31 55, 31 44 Z" fill={fillSub} />
          <circle cx="48" cy="42" r="13.5" fill={fillMain} />
          {/* 魔物娘特征耳/角 */}
          {(motif === 'cat' || motif === 'fox' || motif === 'wolf_dog') && (
            <>
              <path d="M35 34 L31 18 L43 27 Z" fill={fillAccent} />
              <path d="M61 34 L65 18 L53 27 Z" fill={fillAccent} />
            </>
          )}
          {motif === 'rabbit' && (
            <>
              <ellipse cx="40" cy="18" rx="4.2" ry="12" transform="rotate(-12 40 18)" fill={fillMain} />
              <ellipse cx="56" cy="18" rx="4.2" ry="12" transform="rotate(12 56 18)" fill={fillMain} />
            </>
          )}
          {(motif === 'horn_demon' || motif === 'dragon' || motif === 'sheep_spirit') && (
            <>
              <path d="M37 30 C30 22, 28 14, 34 12 C35 18, 39 22, 42 27 Z" fill={fillAccent} />
              <path d="M59 30 C66 22, 68 14, 62 12 C61 18, 57 22, 54 27 Z" fill={fillAccent} />
            </>
          )}
          {motif === 'deer' && (
            <>
              <path d="M39 29 L31 14 M35 21 L28 19 M57 29 L65 14 M61 21 L68 19" stroke={fillSub} strokeWidth="2.4" strokeLinecap="round" />
            </>
          )}
          {!silhouetteOnly && (
            <>
              <circle cx="43" cy="43" r="1.8" fill={ink} />
              <circle cx="53" cy="43" r="1.8" fill={ink} />
              <path d="M45.5 49 Q48 51.5 50.5 49" fill="none" stroke={ink} strokeWidth="1.3" />
            </>
          )}
        </g>
      ) : (
        <g stroke={ink} strokeWidth="1.7" strokeLinejoin="round">
          {motif === 'jelly_whale' && (
            <>
              <path d="M26 46 C26 26, 70 26, 70 46 Z" fill={fillMain} />
              <path d="M32 46 Q29 66 35 76 M43 46 Q41 68 45 78 M53 46 Q55 68 51 78 M64 46 Q67 66 61 76" fill="none" stroke={fillAccent} strokeWidth="2.4" strokeLinecap="round" />
            </>
          )}
          {motif === 'serpent' && (
            <path d="M28 74 C22 56, 38 48, 48 52 C58 56, 68 46, 62 30 C58 22, 46 22, 44 30 C42 36, 52 38, 54 32" fill="none" stroke={fillMain} strokeWidth="6" strokeLinecap="round" />
          )}
          {motif === 'deer' && (
            <>
              <path d="M34 32 L24 14 M29 22 L21 20 M62 32 L72 14 M67 22 L75 20" stroke={fillAccent} strokeWidth="2.5" strokeLinecap="round" />
              <ellipse cx="48" cy="54" rx="16" ry="18" fill={fillMain} />
              <circle cx="48" cy="36" r="11" fill={fillSub} />
            </>
          )}
          {motif === 'bird_harpy' && (
            <>
              <ellipse cx="48" cy="54" rx="13" ry="17" fill={fillMain} />
              <circle cx="48" cy="35" r="10.5" fill={fillSub} />
              <path d="M45 36 L48 41 L51 36 Z" fill="#e29a3b" />
            </>
          )}
          {motif === 'spider' && (
            <>
              <path d="M34 44 L16 32 M32 52 L14 52 M34 60 L18 72 M62 44 L80 32 M64 52 L82 52 M62 60 L78 72" stroke={fillSub} strokeWidth="2.5" strokeLinecap="round" />
              <ellipse cx="48" cy="54" rx="15" ry="17" fill={fillAccent} />
              <circle cx="48" cy="37" r="9.5" fill={fillMain} />
            </>
          )}
          {motif !== 'jelly_whale' && motif !== 'serpent' && motif !== 'deer' && motif !== 'bird_harpy' && motif !== 'spider' && (
            <>
              {/* 通用兽首徽章（狐/狼/熊/狮/机甲/魔像） */}
              <path d="M31 36 L27 17 L42 28 Z" fill={fillAccent} />
              <path d="M65 36 L69 17 L54 28 Z" fill={fillAccent} />
              <path d="M29 48 C29 33, 38 26, 48 26 C58 26, 67 33, 67 48 C67 64, 57 74, 48 74 C39 74, 29 64, 29 48 Z" fill={fillMain} />
              <path d="M38 56 Q48 64 58 56" fill="none" stroke={fillAccent} strokeWidth="2.2" />
              {!silhouetteOnly && (
                <>
                  <circle cx="41" cy="45" r="2.3" fill={ink} />
                  <circle cx="55" cy="45" r="2.3" fill={ink} />
                  <path d="M45 52 L48 55 L51 52 Z" fill={ink} />
                </>
              )}
            </>
          )}
        </g>
      )}

      {/* 右下角属性简字角标 */}
      {!silhouetteOnly && (
        <g>
          <circle cx="80" cy="80" r="10" fill={el.color} stroke="#f7e8c6" strokeWidth="1.2" />
          <text x="80" y="83.5" textAnchor="middle" fill="#fff9eb" fontSize="9.5" fontWeight="700" fontFamily="'Noto Serif SC', serif">
            {el.shortName}
          </text>
        </g>
      )}
    </svg>
  );
}
