/**
 * 整合自 docs/ 的全量奇幻生物、地区魔物娘、魔王军专有魔物娘、被驯化亚人及 9 大区域精英图鉴。
 */
import type { ActTag, BeastCategory, BeastElement, BeastSpecies, BeastStage, RegionId, TerrainType } from '../types.ts';

type CompactSpec = [
  id: string,
  name: string,
  category: BeastCategory,
  regionId: RegionId | RegionId[],
  habitats: TerrainType[],
  element: BeastElement,
  cageCost: 1 | 2,
  difficulty: 1 | 2 | 3 | 4 | 5,
  value: number,
  actTags: ActTag[],
  passiveEffect: string,
  description: string,
  yieldSummary?: string,
];

function buildSpecies(s: CompactSpec): BeastSpecies {
  const [
    id, name, category, region, habitats, element, cageCost, difficulty,
    baseAuctionValue, actTags, passiveEffect, description, yieldSummary,
  ] = s;
  const stage: BeastStage = category === 'elite' ? 3 : cageCost === 2 ? 2 : 1;
  const habitatRegions = Array.isArray(region) ? region : [region];
  return {
    id,
    name,
    category,
    stage,
    element,
    cageCost,
    captureDifficulty: difficulty * 16 + 10,
    baseAuctionValue,
    baseAppeal: category === 'elite' ? 92 : 34 + difficulty * 11,
    baseCombatPower: category === 'elite' ? 86 : 16 + difficulty * 12,
    actTags,
    habitatRegions,
    habitats,
    passiveEffect,
    yieldSummary,
    description,
    evolutions: [],
  };
}

const RAW_SPECS: CompactSpec[] = [
  // ── 一、九大地区 27 种常规奇幻生物 ──
  ['crest_bellfinch', '徽章钟雀', 'beast', 'empire_heart', ['road', 'ruin'], 'starlight', 1, 1, 260, ['music', 'comedy'], '遗落仪仗：城镇开演额外提升希望值 +2', '胸羽带旧帝国圣徽纹路的歌雀，尾羽碰撞能奏出清脆风铃凯旋曲。', '每3日 +1 props'],
  ['stubble_hound', '麦穗稻草犬', 'beast', 'empire_heart', ['wasteland'], 'spore', 1, 2, 380, ['acrobatics', 'beast_tame'], '守望麦田：防鼠害偷粮并降低夜袭率 15%', '皮毛与枯麦草共生的敏捷猎犬，擅钻火圈与守望营地。'],
  ['trench_pangolin', '战壕铁甲蝘', 'beast', 'empire_heart', ['warzone'], 'iron', 1, 3, 520, ['comedy', 'acrobatics'], '战地掩体：强穿战区车厢耐久损耗减免 30%', '背覆锻铁盾鳞的憨厚穿山甲，受惊缩成铁球滚撞保龄桶。', '每4日 +1 spareParts'],

  ['prism_jelly', '折光星水母', 'beast', 'arcane_city', ['ruin', 'wasteland'], 'starlight', 1, 2, 560, ['illusion', 'music'], '浮光省烛：夜间行军及夜演灯油消耗减少 1', '伞盖封存微缩星空的浮空水母，充当天然全息舞台投影。'],
  ['voidfold_crow', '虚空折纸鸦', 'beast', 'arcane_city', ['road', 'ruin'], 'void', 1, 3, 680, ['illusion', 'acrobatics'], '折叠隐踪：熄灯潜行被巡逻队发现概率降 20%', '墨色羊皮折纸乌鸦，振翅时可携道具空间折跃重现。', '每2日 +1 props'],
  ['overload_ferret', '过载魔偶鼬', 'beast', 'arcane_city', ['mountain', 'wasteland'], 'iron', 1, 3, 620, ['flame', 'comedy'], '便携电容：工坊制作道具与捕具省料并稳定蓄电', '脊椎嵌着蓝白魔导蓄能核心的雪貂，喷嚏冒出冷焰电花。', '每日 +1 fuel'],

  ['ember_fox', '余烬幻尾狐', 'beast', 'demon_realm', ['wasteland'], 'flame', 1, 2, 640, ['flame', 'illusion'], '炉边狐火：宿营全团疲劳额外恢复 5 点', '黑灰毛皮与壁炉暖焰尾簇相映，能甩出流火幻影光环。', '每3日 +1 fuel'],
  ['obsidian_ram', '黑曜角羊', 'beast', 'demon_realm', ['mountain'], 'flame', 1, 3, 750, ['acrobatics', 'beast_tame'], '踏岩稳辙：途经山脊崎岖路段车损降 25%', '盘生锋利黑曜巨角的熔岩岩羊，能在细铁索单蹄倒立。'],
  ['abyss_tapir', '深渊吞影貘', 'beast', 'demon_realm', ['ruin', 'warzone'], 'void', 2, 4, 1350, ['illusion', 'beast_tame'], '安眠护佑：高危区扎营士气自然跌幅清零', '以噩梦与焦躁魔力为食的天鹅绒巨貘，吐息可催眠大型猛兽。'],

  ['lantern_fawn', '提灯孢子鹿', 'beast', 'ancient_forest', ['forest'], 'spore', 1, 2, 540, ['illusion', 'music'], '宁静林香：兽笼生物驯服度衰减减半且不易暴走', '树枝鹿角生满荧光伞菌，夜行抖落暖黄孢子雨。', '每2日 +1 fodder'],
  ['silkweb_gibbon', '丝网长臂猴', 'beast', 'ancient_forest', ['forest', 'road'], 'spore', 1, 2, 420, ['acrobatics', 'comedy'], '高空绳手：杂技失误率降低且擅长结网捕猎', '腕部能拉出荧光蛛丝的顽皮长臂猴，在篷顶织就弹力飞人网。', '每3日 +1 tamingNets'],
  ['mossback_turtle', '苔背巨龟', 'beast', 'ancient_forest', ['swamp', 'forest'], 'spore', 2, 3, 920, ['beast_tame', 'music'], '行吟绿荫：行军每日全团累积疲劳减少 3 点', '甲壳背负微型森林苔藓生态圈的古老陆龟，兼具共鸣低音鼓与移动舞台。', '每3日 +1 fodder'],

  ['frost_ermine', '冰晶铃铛鼬', 'beast', 'frost_bastion', ['wasteland', 'road'], 'frost', 1, 2, 580, ['music', 'acrobatics'], '雪原警铃：提前预警极寒伏兵与冰裂路障', '脊背垂挂七枚不融冰棱风铃的白鼬，跑动时清音如八音盒。', '每3日 +1 props'],
  ['hearth_bear', '冻土火囊熊', 'beast', 'frost_bastion', ['mountain', 'wasteland'], 'frost', 2, 4, 1280, ['beast_tame', 'flame'], '移动暖炉：在极北霜壁行军抵消极寒翻倍油耗', '胸口透出恒温熔炉光晕的银灰巨熊，冷热白雾能凝成冰雕拱门。'],
  ['aurora_ray', '极光冰鳐', 'beast', 'frost_bastion', ['lake', 'river', 'mountain'], 'frost', 1, 3, 890, ['illusion', 'acrobatics'], '极夜微光：夜演打赏暴击率提升 25% 且希望 +3', '随寒流滑翔的半透明冰雕鳐鱼，在舞台上空留下流动极光带。'],

  ['bubble_toad', '气泡泥蛙', 'beast', 'sunken_marsh', ['swamp'], 'spore', 1, 1, 280, ['comedy', 'music'], '沼气回收：停驻沼泽扎营固定回收沼气灯油', '鼓胀彩虹气囊的墨绿蟾蜍，吐泡可包起小丑飘浮并奏出低音管节拍。', '每日 +1 fuel'],
  ['lantern_croc', '灯笼沼鳄', 'beast', 'sunken_marsh', ['lake', 'river', 'swamp'], 'spore', 2, 4, 1150, ['beast_tame', 'illusion'], '水路引航：沼泽油耗惩罚减半且防陷车延误', '鼻尖悬着惨绿诱光灯球的沉木巨鳄，能演惊险驯鳄压轴戏。'],
  ['acid_strider', '酸雾水黾', 'beast', 'sunken_marsh', ['lake', 'river', 'ruin'], 'iron', 1, 2, 490, ['acrobatics'], '耐酸护轴：穿过腐雾泥沼车轮腐蚀伤害降 40%', '足端覆有耐酸油脂的犬型水黾，在毒水上滑出华丽水上华尔兹。', '每3日省 1 spareParts'],

  ['clockwork_rat', '发条食铁鼠', 'beast', 'iron_wastes', ['ruin'], 'iron', 1, 1, 340, ['comedy', 'music'], '精工拆解：修缮车厢零件消耗减少 1 份', '背嵌黄铜发条齿轮的机械生化鼠，踩着四四拍节奏敲打铁锅爵士鼓。', '每2日 +1 spareParts'],
  ['slag_lion', '煤渣喷汽狮', 'beast', 'iron_wastes', ['wasteland', 'road'], 'flame', 2, 4, 1420, ['flame', 'beast_tame'], '蒸汽牵引：干道行进速度 +25% 且载重上限 +15%', '肩喷高压炽白蒸汽的青铜刚丝雄狮，纵跃三重火环震撼全场。'],
  ['neon_gecko', '霓虹电鳗蜥', 'beast', 'iron_wastes', ['ruin', 'wasteland'], 'starlight', 1, 3, 720, ['illusion', 'acrobatics'], '霓虹揽客：驻演初始客流量与门票收益提升 15%', '血管流淌霓虹跑马灯光液的壁虎，攀在篷顶拼出星光招牌。', '每2日 +1 fuel'],

  ['hourglass_rattler', '沙漏响尾蛇', 'beast', 'sand_oasis', ['wasteland'], 'flame', 1, 2, 590, ['music', 'illusion'], '寻水尾铃：焚沙裂谷口粮消耗减免 20%', '尾端生有琉璃金沙双球沙漏的沙漠蟒，摇尾奏出催眠沙舞曲。'],
  ['cliff_kite', '岩壁风筝蜥', 'beast', 'sand_oasis', ['mountain'], 'starlight', 1, 3, 710, ['acrobatics', 'illusion'], '鹰眼勘雾：行军开雾探测视野额外扩大 1 圈', '撑开晚霞彩纹翼膜的红岩飞蜥，借篝火热气流在帐篷顶盘旋撒彩沙。'],
  ['dew_camelid', '绿洲储水驼兽', 'beast', 'sand_oasis', ['lake', 'wasteland'], 'spore', 2, 2, 840, ['comedy', 'beast_tame'], '商旅水囊：提高沙漠远行容错率并产出净水口粮', '驼峰覆满吸水银苔的憨厚双峰驼，被戳肚子会喷出清凉水柱降温。', '每日 +1 rations'],

  ['foghorn_gullfox', '雾灯海鸥狐', 'beast', 'dawn_coast', ['coast', 'mountain'], 'starlight', 1, 2, 660, ['music', 'acrobatics'], '破雾听潮：海岸行进大幅提升隐秘航路传闻发现率', '生有洁白海鸥翼与雾笛声囊的红狐，发出海浪拍岸与悠长雾笛共鸣。'],
  ['tideglass_crab', '潮汐玻璃蟹', 'beast', 'dawn_coast', ['coast', 'swamp'], 'iron', 1, 2, 570, ['illusion', 'comedy'], '海市珠光：港湾集市交易与道具议价优势提升 10%', '背负彩色海玻璃城堡壳的寄居蟹，折射油灯化作满场万花筒。', '每2日 +1 props'],
  ['starlight_whale', '星辉深渊鲸雏', 'beast', 'dawn_coast', ['coast', 'ruin'], 'starlight', 2, 5, 2600, ['illusion', 'music'], '彼岸星标：沿岸巡演极高概率共振世外净土航路', '浮游在海雾中的幼年天界鲸，低吟摇篮曲洒落星尘令枯树一夜繁花。'],

  // ── 二、九大地区 27 种野生奇幻魔物娘 ──
  ['mg_centaur_penelope', '人马骑兵娘·佩妮洛', 'monstergirl', 'empire_heart', ['road', 'wasteland'], 'iron', 2, 3, 850, ['acrobatics', 'beast_tame'], '皇家仪仗步态：连通干道行进速度 +15%', '扎高马尾的栗色人马骑兵娘，马背叠罗汉与跳火圈绝技震撼帝国遗民。'],
  ['mg_dullahan_celtis', '无头骑士娘·赛尔蒂丝', 'monstergirl', 'empire_heart', ['ruin', 'warzone'], 'void', 1, 3, 920, ['comedy', 'illusion'], '无畏夜行：经过交火战区不损失额外士气', '常把脑袋当保龄球抛接的哥特天然呆无头少女，黑色幽默喜剧天花板。', '每3日 +1 props'],
  ['mg_slime_milly', '史莱姆修女娘·蜜露', 'monstergirl', 'empire_heart', ['ruin', 'road'], 'spore', 1, 1, 480, ['comedy', 'illusion'], '蜜胶舒缓：营地休息全团每日额外恢复 4 点疲劳', '蜂蜜琥珀凝胶少女，化作巨型弹力蹦床接住高空杂技员。', '每3日 +1 spareParts'],

  ['mg_grimoire_philia', '魔导书妖精娘·菲莉娅', 'monstergirl', 'arcane_city', ['ruin'], 'starlight', 1, 2, 760, ['illusion', 'music'], '废都考据：侦查遗迹高概率发现秘闻并省油', '羊皮书页双翼的银发书灵，将童话故事立体投影在剧场半空。', '每2日 +1 props'],
  ['mg_gargoyle_grace', '晶体石像鬼娘·格蕾丝', 'monstergirl', 'arcane_city', ['mountain', 'ruin'], 'iron', 1, 3, 820, ['acrobatics', 'illusion'], '高塔守望：驻守车顶降低夜袭伏击概率 25%', '白日假装车顶石雕打盹的紫晶翼傲娇石像鬼少女。'],
  ['mg_caitsith_lumina', '星灵猫娘·露米娜', 'monstergirl', 'arcane_city', ['wasteland', 'road'], 'starlight', 1, 2, 790, ['acrobatics', 'comedy'], '猫妖财运：每场演出观众额外打赏提升 20%', '异色星瞳的魔术猫娘，擅长走钢丝与扑克牌雨魔术。'],

  ['mg_imp_lilista', '笨拙小魅魔·莉莉丝塔', 'monstergirl', 'demon_realm', ['ruin', 'wasteland'], 'flame', 1, 2, 740, ['flame', 'comedy'], '甜蜜训导：兽笼生物驯服与经验成长 +25%', '偷穿高跟鞋平地摔、把业火喷成桃心彩烟的反差萌小魅魔。'],
  ['mg_gorgon_medura', '熔岩蛇发女妖·梅杜拉', 'monstergirl', 'demon_realm', ['mountain', 'wasteland'], 'flame', 1, 3, 980, ['flame', 'music'], '大姐头的火炉：供暖省疲劳且火焰演出 +15%', '戴着墨镜的温柔御姐，头顶小火蛇随歌声组成火焰管风琴。', '每3日 +1 fuel'],
  ['mg_dragon_valkia', '灰烬魔龙姬·瓦尔基娅', 'monstergirl', 'demon_realm', ['warzone', 'mountain'], 'flame', 2, 5, 2100, ['flame', 'beast_tame'], '龙威慑敌：普通盗匪与低阶野兽不敢靠近车队', '裹着破披风的傲娇黑金龙角龙姬，一记黄金龙焰烟花镇住全场暴徒。'],

  ['mg_alraune_flora', '花冠曼陀罗娘·芙萝拉', 'monstergirl', 'ancient_forest', ['forest'], 'spore', 2, 2, 880, ['illusion', 'music'], '愈心花香：全团奇兽驯服度每日自然微增', '以巨型曼陀罗花瓣作裙摆的少女，花香令战火百姓安神落泪。', '每2日 +1 fodder'],
  ['mg_arachne_tina', '织梦蜘蛛娘·缇娜', 'monstergirl', 'ancient_forest', ['forest', 'road'], 'spore', 2, 3, 950, ['acrobatics', 'illusion'], '首席裁缝：降低演出耗材需求并提升魅力', '戴圆框眼镜的裁缝蛛娘，在空中拉出光彩丝网跳起八足芭蕾。', '交替 +1 props/nets'],
  ['mg_owl_noctis', '槲寄生枭娘·诺克蒂丝', 'monstergirl', 'ancient_forest', ['forest'], 'starlight', 1, 2, 640, ['acrobatics', 'music'], '夜林斥候：密林与夜间额外揭露迷雾视野', '白天倒挂车梁睡觉、夜间用无声俯冲与风笛哨音震撼树村的枭娘。'],

  ['mg_yukionna_fubuki', '雪女娘·吹雪', 'monstergirl', 'frost_bastion', ['wasteland', 'mountain'], 'frost', 1, 3, 1050, ['illusion', 'music'], '永冻保鲜库：生鲜口粮与易腐货物免疫霉变', '在炽热马戏帐篷里降下永不冻伤的室内细雪，折射万千冰晶蝶。'],
  ['mg_wolf_fenrirka', '银狼族长娘·芬里尔卡', 'monstergirl', 'frost_bastion', ['road', 'wasteland'], 'frost', 1, 2, 780, ['acrobatics', 'beast_tame'], '雪原领跑：冻土风雪路段行进提速不陷轮', '嘴硬心软的豪爽银狼战士，带队跳火圈并发出振奋人心的狼啸。'],
  ['mg_clione_clione', '海天使娘·克莉奥涅', 'monstergirl', 'frost_bastion', ['lake', 'mountain'], 'frost', 1, 3, 960, ['illusion', 'comedy'], '冰心微光：在压抑矿镇开演额外提升希望值 +2', '软萌冰蓝鳍天使与暴走触手反差喜剧主角，掌声不断。', '每3日 +1 props'],

  ['mg_lamia_sasha', '蛇尾拉弥亚娘·莎夏', 'monstergirl', 'sunken_marsh', ['swamp', 'ruin'], 'spore', 2, 3, 1080, ['acrobatics', 'illusion'], '鳞尾防震垫：易碎货运破损赔款风险降 60%', '翡翠金纹长尾的高空盘柱柔术舞娘，天冷时会缠着锅炉取暖。', '每4日 +1 props'],
  ['mg_frog_gulu', '巫毒蛙娘·咕噜', 'monstergirl', 'sunken_marsh', ['swamp', 'river', 'lake'], 'spore', 1, 1, 450, ['comedy', 'music'], '百毒不侵：穿越毒雾泥沼免疫瘴气疾病', '踩大黄胶靴的乐天蛙娘，三米长舌精准摘走小丑帽子引发爆笑。', '每2日 +1 fodder'],
  ['mg_moth_lucia', '萤火蛾娘·露西娅', 'monstergirl', 'sunken_marsh', ['swamp', 'ruin'], 'starlight', 1, 2, 690, ['illusion', 'flame'], '天然聚光灯：夜场演出零油耗且票房 +10%', '重度趋光性的墨绿丝绒大蛾美人，振翅洒满金色星河磷粉。', '每2日 +1 props'],

  ['mg_automaton_elena', '发条自动人偶娘·艾琳娜', 'monstergirl', 'iron_wastes', ['ruin', 'road'], 'iron', 1, 3, 990, ['music', 'comedy'], '工坊机械师：车厢修理效率翻倍且省零件', '胸嵌八音盒的陶瓷关节发条少女，擅长工业冷笑话与卡点机械舞。'],
  ['mg_armor_brunhild', '活体铠甲女武神·布伦希尔德', 'monstergirl', 'iron_wastes', ['wasteland', 'ruin'], 'iron', 1, 3, 910, ['flame', 'acrobatics'], '移动哨兵：震慑黑市劫匪使被劫物资减半', '铠甲内空无一物的少女心英灵，舞台上拆解自己手臂头颅抛接耍宝。'],
  ['mg_rabbit_volt', '电磁兔耳娘·伏特', 'monstergirl', 'iron_wastes', ['wasteland', 'road'], 'starlight', 1, 2, 680, ['acrobatics', 'flame'], '电驱加速：荒原与旧铁道推进里程小幅提速', '兔耳尖跳动蓝电火花的闪电少女，半空拉出特斯拉电弧琴。', '每2日 +1 fuel'],

  ['mg_scorpion_sahara', '赤沙蝎尾娘·萨哈拉', 'monstergirl', 'sand_oasis', ['wasteland'], 'flame', 2, 4, 1320, ['acrobatics', 'flame'], '沙海护镖：沙漠宿营杜绝沙盗夜袭与失窃', '用巨型蝎尾夹住飞刀与火把悬吊表演的荒漠冷酷保镖。'],
  ['mg_sphinx_nafil', '黄金斯芬克丝·纳菲尔', 'monstergirl', 'sand_oasis', ['mountain', 'wasteland'], 'starlight', 2, 4, 1580, ['comedy', 'illusion'], '商道谜语人：货站运费与载客车费提升 15%', '爱睡午觉的谜语人傲娇女王，主持最受欢迎的黄金猜谜脱口秀。'],
  ['mg_mermaid_nilou', '沙海绿洲鱼娘·妮露', 'monstergirl', 'sand_oasis', ['lake'], 'spore', 1, 3, 1100, ['music', 'illusion'], '活体清泉：焚沙裂谷口粮消耗减免 25%', '坐在改装滚轮水缸里的净水人鱼歌姬，喷出彩虹水雾为沙镇降温。', '每日 +1 rations'],

  ['mg_siren_marine', '海妖塞壬娘·玛琳', 'monstergirl', 'dawn_coast', ['mountain', 'coast'], 'starlight', 1, 3, 1250, ['music', 'illusion'], '声名远播：参演后剧团对外名望额外 +30%', '海鸟白翼的海岸歌姬，穿透海雾的清唱令老水手与流民泪目。'],
  ['mg_scylla_krakena', '触手海盗娘·克拉肯娜', 'monstergirl', 'dawn_coast', ['coast', 'ruin'], 'void', 2, 3, 1060, ['acrobatics', 'comedy'], '海盗藏匿术：携带违禁货运过卡查获率降 40%', '八腕同时抛接十六把火把与五种乐器的爽朗海贼船长娘。', '每2日 +1 props'],
  ['mg_angler_lumiere', '深海灯笼鱼娘·露米埃尔', 'monstergirl', 'dawn_coast', ['coast', 'swamp'], 'starlight', 1, 4, 1400, ['illusion', 'music'], '雾海明灯：夜演油耗归零且沿岸大幅助推净土航路', '社恐靛蓝深海少女，头顶生物小提灯舞出深海夜光剪影童话剧。'],

  // ── 三、魔王军 6 种专有魔物娘（苍灰解放阵线） ──
  ['mg_da_minotaur_balora', '牛头人铁卫娘·巴洛拉', 'demon_army', ['empire_heart', 'demon_realm', 'iron_wastes'], ['warzone', 'mountain'], 'iron', 2, 4, 1450, ['beast_tame', 'comedy'], '破阵护盾：强穿战区或遇袭车损额外降 35%', '扛着坦克装甲板巨盾却爱烤黑麦面包的温柔两米牛角大姐姐。'],
  ['mg_da_cyclops_chloe', '独眼巨人瞄准娘·克洛伊', 'demon_army', ['demon_realm', 'arcane_city', 'frost_bastion'], ['mountain', 'ruin'], 'starlight', 1, 4, 1380, ['illusion', 'acrobatics'], '鹰眼军镜：提前预警前方交火战线与巡逻队', '蒙眼听声射熄演员头顶蜡烛的神枪狙击手（两米内倒水总对不准杯口）。'],
  ['mg_da_vampirebat_vesper', '绯红蝙蝠娘·维丝帕', 'demon_army', ['demon_realm', 'ancient_forest', 'empire_heart'], ['ruin', 'forest'], 'void', 1, 3, 1180, ['illusion', 'music'], '夜翼潜行：熄灯夜行隐蔽度大幅提升并探清暗道', '倒吊在车梁睡觉、爱好石榴汁的哥特中二病暗夜歌剧飞人。'],
  ['mg_da_hellsaper_margaret', '炼狱角魔爆破娘·玛格丽特', 'demon_army', ['demon_realm', 'iron_wastes', 'sand_oasis'], ['wasteland', 'warzone'], 'flame', 1, 3, 1040, ['flame', 'comedy'], '工兵排雷：穿越战区废墟免疫地雷陷坑重创', '痴迷把哑弹拆成五彩大礼花的煤灰短发小恶魔爆破手。', '每2日 +1 fuel/parts'],
  ['mg_da_scarab_sekhmet', '圣甲虫药师娘·塞赫美特', 'demon_army', ['sand_oasis', 'demon_realm', 'sunken_marsh'], ['wasteland', 'warzone'], 'spore', 1, 3, 1220, ['music', 'comedy'], '战地白衣：全团体力恢复速度提升 40%', '背着暗金圣甲虫药箱鞘翅的操心战地军医，追着小丑上演急救喜剧。', '每2日 +1 fodder'],
  ['mg_da_banshee_renata', '苍灰死灵歌姬·蕾娜塔', 'demon_army', ['demon_realm', 'empire_heart', 'dawn_coast'], ['warzone', 'ruin'], 'void', 1, 5, 1950, ['music', 'illusion'], '苍灰旗帜的证明：遇魔王军巡逻队获友善豁免通行', '手握幽蓝悼亡战旗的悬浮灵姬，安魂战舞令双方士兵放下武器。'],

  // ── 四、7 种被驯化魔物娘（聚落亚人公民 / 市井相遇） ──
  ['dom_catgirl', '市井三花猫娘', 'domesticated', ['empire_heart', 'arcane_city', 'dawn_coast', 'sand_oasis'], ['city', 'village'], 'starlight', 1, 1, 320, ['acrobatics', 'comedy'], '市井防窃：停靠混乱城邦彻底防窃并看穿短斤少两', '系着红绳铃铛铜牌的酒馆杂耍学徒，专精蒙眼走细绳与偷鱼默剧。'],
  ['dom_doggirl', '忠实猎犬娘', 'domesticated', ['empire_heart', 'frost_bastion', 'iron_wastes'], ['village', 'road', 'city'], 'iron', 1, 1, 350, ['beast_tame', 'acrobatics'], '忠诚守夜：大幅降低野兽夜袭与营地惊吓士气损', '穿帆布背带工装的护卫少女，给口热饭就会拼死护卫车队。'],
  ['dom_foxgirl', '茶屋商贩狐娘', 'domesticated', ['sand_oasis', 'arcane_city', 'empire_heart'], ['city', 'village'], 'flame', 1, 2, 680, ['illusion', 'music'], '八面玲珑：集市采买与货运议价能力提升 12%', '夹着折扇与微型算盘的狐娘掌柜，用狐火幻术舞吸金无数。'],
  ['dom_rabbitgirl', '驿站长耳兔娘', 'domesticated', ['empire_heart', 'ancient_forest', 'arcane_city'], ['city', 'village'], 'starlight', 1, 1, 420, ['comedy', 'acrobatics'], '顺风长耳：提前听见十里外炮火与军队调动预警', '胆小勤快的魔术箱搭档，从大礼帽里咚地跳出完成超高度跨栏。'],
  ['dom_ratgirl', '贫民窟机修鼠娘', 'domesticated', ['iron_wastes', 'sunken_marsh', 'empire_heart'], ['city', 'ruin'], 'iron', 1, 1, 240, ['comedy', 'acrobatics'], '夹层密道：修车减耗并可藏匿小型违禁货物', '鼻架放大镜、裤兜塞满螺丝的机灵修理工，顺手捡回可用零件。', '每2日 +1 spareParts'],
  ['dom_harpygirl', '高塔信鸽哈比娘', 'domesticated', ['dawn_coast', 'arcane_city', 'frost_bastion'], ['city', 'village'], 'starlight', 1, 2, 490, ['acrobatics', 'music'], '高空邮路：抵达新区域飞上高空扩大迷雾侦察轮廓', '斜挎旧皮邮差包的银羽信使，无保护高空盘旋吹奏口哨交响乐。'],
  ['dom_sheepgirl', '织坊卷角绵羊娘', 'domesticated', ['ancient_forest', 'empire_heart', 'frost_bastion'], ['village'], 'spore', 1, 1, 390, ['music', 'illusion'], '软绒安眠枕：团员夜休全员额外恢复疲劳 +4', '软绵绵像移动云朵气垫的纺织乡下姑娘，催眠童谣深受孩童喜爱。', '每3日 +1 props'],

  // ── 五、九大地区 9 种区域精英传奇生物 ──
  ['elite_crest_griffin', '圣徽黄金狮鹫', 'elite', 'empire_heart', ['mountain', 'warzone'], 'iron', 2, 5, 3200, ['acrobatics', 'beast_tame'], '皇家制空权：大幅豁免帝国税卡盘查并降低遇袭', '翼展逾六米的皇家空骑皇者，俯冲叼起半空火焰皇冠环令遗民泪目。', '每5日 +2 props'],
  ['elite_arcane_elemental', '星枢奥术精魄', 'elite', 'arcane_city', ['ruin', 'wasteland'], 'starlight', 2, 5, 3600, ['illusion', 'music'], '浮空减重结界：车队载重上限 +20% 并减轻泥泞阻力', '七枚秘银棱晶环绕的星蓝元素体，令整个帐篷化作失重星穹剧场。', '每2日 +1 fuel'],
  ['elite_obsidian_dragon', '黑曜炼狱古龙', 'elite', 'demon_realm', ['mountain', 'warzone'], 'flame', 2, 5, 4800, ['flame', 'beast_tame'], '古龙威慑：普通盗匪与低阶魔物闻风溃逃免战', '鳞缝流淌熔岩金光的真正亚龙级巨龙，一道龙炎烟花照亮黑域半边天。', '每4日 +2 spareParts'],
  ['elite_forest_spirit', '苍穹鹿角森灵', 'elite', 'ancient_forest', ['forest'], 'spore', 2, 5, 3400, ['illusion', 'music'], '森之庇护：全团免疫瘟疫腐化且减缓城镇衰败', '白银古木藤蔓编织的远古林神幻影，步步生花令枯木一夜逢春。', '每日 +1 fodder'],
  ['elite_frost_elemental', '凛冬极光冰灵', 'elite', 'frost_bastion', ['mountain', 'wasteland'], 'frost', 2, 5, 3500, ['illusion', 'acrobatics'], '恒温冰幕：食物永不腐坏并抵消极热沙漠疲劳', '冰晶裙摆与七彩极光冠的冰雪精魄，当空召唤真极光银河与冰镜迷宫。', '每3日 +1 props'],
  ['elite_mire_hydra', '腐渊九头蛇皇', 'elite', 'sunken_marsh', ['swamp', 'lake', 'river'], 'spore', 2, 5, 3300, ['beast_tame', 'comedy'], '九首警戒：360度防备沼泽偷袭且免疫毒雾', '主头高冷八副头抢帽子耍宝的湿地九头巨兽，上演九头交响相声秀。'],
  ['elite_forge_elemental', '炉心机魂铁灵', 'elite', 'iron_wastes', ['ruin', 'wasteland'], 'iron', 2, 5, 3400, ['flame', 'music'], '蒸汽动力牵引：总载重 +30% 且大幅减免车轮磨损', '背耸七根管风琴蒸汽烟囱的工业巨灵，喷出彩色焰雾奏响钢铁进行曲。', '每2日 +2 spareParts'],
  ['elite_sunfire_phoenix', '焚沙烈阳不死鸟', 'elite', 'sand_oasis', ['mountain', 'wasteland'], 'flame', 2, 5, 4200, ['flame', 'illusion'], '不灭微光：锁定团员士气底线且夜演自带日光免油', '燃烧纯净太阳金焰的神鸟之灵，高空涅槃洒下温暖火花雨扫净阴霾。', '每3日 +1 fuel/props'],
  ['elite_tide_leviathan', '雾海潮汐利维坦', 'elite', 'dawn_coast', ['coast', 'ruin'], 'starlight', 2, 5, 4500, ['illusion', 'music'], '彼岸潮汐的指引：海岸迷雾透明并加速开启隐居净土航路', '珍珠母贝龙鳞与珊瑚角的海皇巨灵，凌空卷起悬浮水幕投影珊瑚古殿。'],
];

export const DOCS_ROSTER_SPECIES: BeastSpecies[] = RAW_SPECS.map(buildSpecies);
