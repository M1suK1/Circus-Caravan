import { REGION_CATALOG } from '../content/regions.ts';
import { findBeastSpecies } from '../content/species.ts';
import { canRetire } from '../domain/caravanMath.ts';
import type { ActionResult, Beast, CircusState, GameAction, Performer } from '../types.ts';
import { clone, pushLog } from './core.ts';

export type RetireTier = 'modest' | 'prosperous' | 'legendary';

export function computeRetireTier(state: Pick<CircusState, 'gold' | 'retirement' | 'caravan'>): RetireTier {
  const target = Math.max(1, state.retirement.targetGold);
  if (state.gold >= target * 2.5 && state.caravan.fame >= 80) return 'legendary';
  if (state.gold >= target * 1.5) return 'prosperous';
  return 'modest';
}

function buildPerformerEpilogue(
  perf: Performer,
  haven: 'quiet_farm' | 'hidden_valley',
  tier: RetireTier,
): string {
  const havenText = haven === 'hidden_valley' ? '隐世山谷木屋' : '静谧向阳农庄';
  const bondHigh = perf.bond >= 60;
  if (perf.role === 'acrobat') {
    return bondHigh
      ? `收起火圈后在${havenText}支起了秋千和晾衣绳，傍晚常为村童翻几个轻巧的跟头，眼角的笑意再也没被战灰遮住。`
      : `把烧焦的旧缎带收进木匣，偶尔还在丰收夜替邻里点起几盏暖灯。`;
  }
  if (perf.role === 'tamer') {
    return bondHigh
      ? `在${havenText}后坡搭起了半开放式的林间牧棚，所有随行奇兽仍认得他的骨哨声，日子过得比荒野安稳十倍。`
      : `放下了捕兽网与麻醉药剂，改用干草和苹果照料留下的生灵。`;
  }
  if (perf.role === 'illusionist') {
    return tier === 'legendary'
      ? `用余下的魔导晶石为${havenText}立起四季恒温的微光穹顶，昔日只用来骗取掌声的幻术，如今成了真正的庇护屏障。`
      : `终于不再赶路，只在夏夜用微弱星辉给同伴投出故乡早已消失的星空。`;
  }
  if (perf.role === 'clown') {
    return `洗掉滑稽的白粉油彩后，成了${havenText}最会讲荒诞故事的烤面包匠，连从前最爱哭的难民小孩都学会了咯咯笑。`;
  }
  if (perf.role === 'bard') {
    return `把一路记下的九大地区歌谣与城村名字抄成厚厚一册诗集，在炉火边轻轻弹唱给风灯下的故人们听。`;
  }
  return `不再替车队盯防边界烟柱，只在山脊边巡看篱笆和晴雨，终于能睡一个整夜安稳觉。`;
}

function buildBeastEpilogue(beast: Beast, haven: 'quiet_farm' | 'hidden_valley'): string {
  const sp = findBeastSpecies(beast.speciesId);
  const label = sp?.name ?? beast.speciesId;
  const isGirl = sp?.category === 'monstergirl' || sp?.category === 'domesticated' || sp?.category === 'demon_army';
  if (isGirl) {
    return `作为真正卸下奴隶牌号与风尘的自由同伴，${beast.nickname}（${label}）留在${haven === 'hidden_valley' ? '山谷工坊' : '农庄面包房'}帮忙，总算不必再害怕任何税卡与黑市。`;
  }
  return `卸下铁笼锁扣后，${beast.nickname}（${label}）习惯在篱笆内打盹晒太阳，遇到陌生风声仍会第一时间替大家守夜。`;
}

export function applyRetire(
  state: CircusState,
  action: Extract<GameAction, { type: 'retire' }>,
): ActionResult {
  if (!canRetire(state)) {
    const region = state.world.regions[state.world.currentRegionId];
    if (state.phase === 'retired') return { state, ok: false, message: '剧团已完成隐居，无需重复收摊。' };
    if (state.gold < state.retirement.targetGold) {
      return {
        state,
        ok: false,
        message: `隐居基金尚差 ${state.retirement.targetGold - state.gold} 金，还不能安心收摊。`,
      };
    }
    if (region.dangerTier >= 5) {
      return { state, ok: false, message: `「${region.name}」战火危级过高（LV.5），请先转移至安全地区再隐居。` };
    }
    return { state, ok: false, message: '车队士气过低，请先休整后再宣布收摊。' };
  }

  const next = clone(state);
  const tier = computeRetireTier(next);
  const havenName = action.haven === 'hidden_valley' ? '隐世山谷' : '静谧农庄';
  const regionName = REGION_CATALOG[next.world.currentRegionId].name;

  const accompanyingPerformers = next.performers.map(perf => ({
    id: perf.id,
    name: perf.name,
    epilogue: buildPerformerEpilogue(perf, action.haven, tier),
  }));
  const accompanyingBeasts = next.beasts.map(beast => ({
    id: beast.id,
    name: beast.nickname,
    epilogue: buildBeastEpilogue(beast, action.haven),
  }));

  const tierTitle = tier === 'legendary'
    ? '传说中的灯火远行者'
    : tier === 'prosperous'
      ? '满载余烬的富足归隐'
      : '风尘仆仆的安身小筑';

  const narrative = `历时 ${next.day} 日穿行九大废土疆域，残响大篷车最终在「${regionName}」收起最后一根篷布帐杆。凭着攒下的 ${next.gold.toLocaleString('zh-CN')} 金币与 ${next.caravan.fame} 点大陆传唱度（${tierTitle}），团长带着 ${accompanyingPerformers.length} 位同行艺人${accompanyingBeasts.length ? `与 ${accompanyingBeasts.length} 位奇兽同伴` : ''}悄然撤出战乱商路，迁入远离税卡与硝烟的「${havenName}」。从此夜里不再需要赶路，只有暖黄风灯依旧亮在木屋窗前。`;

  next.phase = 'retired';
  next.retirement.chosenHaven = action.haven;
  next.retirement.sanctuaryDiscovered = true;
  next.retirement.ending = {
    achievedDay: next.day,
    tier,
    accompanyingPerformers,
    accompanyingBeasts,
    narrative,
  };

  pushLog(next, 'system', `剧团于第 ${next.day} 日达成「${tierTitle}」结局，携全员归隐「${havenName}」。`);
  return { state: next, ok: true, message: `全团顺利归隐「${havenName}」！` };
}
