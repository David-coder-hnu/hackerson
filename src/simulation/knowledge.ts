// Knowledge base integration for per-pin local analysis
// Queries wildlife, minerals, and city development potential by climate + terrain

interface AnimalEntry {
  genus: string; name_zh: string; body_size: string; diet: string;
  social_structure: string; activity_rhythm: string;
  special_adaptation: string; endemic: boolean;
}

// Sampled wildlife database keyed by Köppen code
const WILDLIFE: Record<string, AnimalEntry[]> = {
  Af: [ // Tropical Rainforest
    { genus:"Panthera",name_zh:"美洲豹",body_size:"巨",diet:"肉食",social_structure:"独居",activity_rhythm:"夜行",special_adaptation:"善游泳攀爬——可在洪泛森林中涉水捕猎龟和鳄",endemic:false },
    { genus:"Pongo",name_zh:"猩猩",body_size:"巨",diet:"杂食",social_structure:"独居",activity_rhythm:"昼行",special_adaptation:"树栖——双臂展2.4m——制作工具取食蜂蜜种子",endemic:true },
    { genus:"Ateles",name_zh:"蛛猴",body_size:"中",diet:"植食",social_structure:"大群",activity_rhythm:"昼行",special_adaptation:"尾具触觉如第五肢——可完全用尾悬挂取食",endemic:true },
    { genus:"Harpia",name_zh:"角雕",body_size:"巨",diet:"肉食",social_structure:"成对",activity_rhythm:"昼行",special_adaptation:"后爪7cm——可抓取树懒和吼猴——冠羽辅助无声飞行",endemic:true },
    { genus:"Eunectes",name_zh:"水蚺",body_size:"巨",diet:"肉食",social_structure:"独居",activity_rhythm:"夜行",special_adaptation:"半水栖——可在水下潜伏>10分钟伏击凯门鳄",endemic:true },
  ],
  Am: [ // Tropical Monsoon
    { genus:"Elephas",name_zh:"亚洲象",body_size:"巨",diet:"植食",social_structure:"小群",activity_rhythm:"昼行",special_adaptation:"长鼻>4万块肌肉——雨季迁徙至高地避开洪水",endemic:false },
    { genus:"Panthera",name_zh:"孟加拉虎",body_size:"巨",diet:"肉食",social_structure:"独居",activity_rhythm:"晨昏",special_adaptation:"条纹在干季高草中构成完美伪装——善游泳",endemic:false },
    { genus:"Rhinoceros",name_zh:"独角犀",body_size:"巨",diet:"植食",social_structure:"独居",activity_rhythm:"晨昏",special_adaptation:"皮肤厚4cm铠甲状——泥浴降温防虫",endemic:false },
    { genus:"Python",name_zh:"网纹蟒",body_size:"巨",diet:"肉食",social_structure:"独居",activity_rhythm:"夜行",special_adaptation:"红外感热唇窝——干季潜伏洞穴减少水分蒸发",endemic:false },
  ],
  Aw: [ // Savanna
    { genus:"Panthera",name_zh:"狮子",body_size:"巨",diet:"肉食",social_structure:"大群",activity_rhythm:"昼行",special_adaptation:"唯一群居猫科——狮群协作围猎大型植食动物",endemic:false },
    { genus:"Loxodonta",name_zh:"非洲象",body_size:"巨",diet:"植食",social_structure:"大群",activity_rhythm:"昼行",special_adaptation:"次声波通讯数公里——雌性族长记忆迁徙路线寻水源",endemic:true },
    { genus:"Giraffa",name_zh:"长颈鹿",body_size:"巨",diet:"植食",social_structure:"小群",activity_rhythm:"昼行",special_adaptation:"取食层>5m——特化血压系统防低头脑溢血",endemic:true },
    { genus:"Crocuta",name_zh:"斑鬣狗",body_size:"大",diet:"肉食",social_structure:"大群",activity_rhythm:"夜行",special_adaptation:"咬合力超狮子可碎骨——消化骨骼吸收钙质",endemic:true },
    { genus:"Acinonyx",name_zh:"猎豹",body_size:"大",diet:"肉食",social_structure:"独居",activity_rhythm:"昼行",special_adaptation:"0-100km/h仅3秒——白天避开狮子和鬣狗竞争",endemic:false },
  ],
  Cfa: [ // Humid Subtropical
    { genus:"Procyon",name_zh:"浣熊",body_size:"中",diet:"杂食",social_structure:"独居",activity_rhythm:"夜行",special_adaptation:"前爪极灵巧可开水龙头——高度适应城郊环境",endemic:false },
    { genus:"Alligator",name_zh:"短吻鳄",body_size:"巨",diet:"肉食",social_structure:"独居",activity_rhythm:"昼行",special_adaptation:"建造池塘为其他水生物种提供旱季避难所",endemic:false },
  ],
  Cfb: [ // Oceanic
    { genus:"Cervus",name_zh:"马鹿",body_size:"大",diet:"植食",social_structure:"小群",activity_rhythm:"晨昏",special_adaptation:"鹿茸年换新——秋季发情期吼声传数公里",endemic:false },
    { genus:"Meles",name_zh:"獾",body_size:"中",diet:"杂食",social_structure:"小群",activity_rhythm:"夜行",special_adaptation:"可传承数代的永久洞穴——冬眠依赖秋季脂肪",endemic:false },
    { genus:"Vulpes",name_zh:"赤狐",body_size:"中",diet:"杂食",social_structure:"独居",activity_rhythm:"晨昏",special_adaptation:"高度可塑性食谱——冬季仅凭听觉雪下精准捕鼠",endemic:false },
  ],
  Csa: [ // Mediterranean
    { genus:"Lynx",name_zh:"伊比利亚猞猁",body_size:"大",diet:"肉食",social_structure:"独居",activity_rhythm:"晨昏",special_adaptation:"特化捕食兔类——耳撮毛增强定向听觉",endemic:true },
    { genus:"Aquila",name_zh:"金雕",body_size:"巨",diet:"肉食",social_structure:"成对",activity_rhythm:"昼行",special_adaptation:"翼展>2m利用热气流盘旋——俯冲速度>240km/h",endemic:false },
  ],
  Dfa: [ // Hot-summer Continental
    { genus:"Ursus",name_zh:"美洲黑熊",body_size:"巨",diet:"杂食",social_structure:"独居",activity_rhythm:"昼行",special_adaptation:"冬眠——代谢率降至25%——母熊冬眠中分娩",endemic:false },
    { genus:"Canis",name_zh:"灰狼",body_size:"大",diet:"肉食",social_structure:"大群",activity_rhythm:"昼行",special_adaptation:"群体战术围猎大型有蹄类——领地可达数百km²",endemic:false },
    { genus:"Castor",name_zh:"河狸",body_size:"中",diet:"植食",social_structure:"小群",activity_rhythm:"夜行",special_adaptation:"建造水坝改变水文——牙齿终生生长可伐大树",endemic:false },
  ],
  Dfb: [ // Warm-summer Continental
    { genus:"Alces",name_zh:"驼鹿",body_size:"巨",diet:"植食",social_structure:"独居",activity_rhythm:"昼行",special_adaptation:"肩高>2m——长腿可在深雪中行走——潜水取食水生植物",endemic:false },
    { genus:"Lynx",name_zh:"加拿大猞猁",body_size:"大",diet:"肉食",social_structure:"独居",activity_rhythm:"夜行",special_adaptation:"雪鞋般的巨掌——特化捕食雪鞋兔——种群周期同步11年",endemic:false },
  ],
  ET: [ // Tundra
    { genus:"Rangifer",name_zh:"驯鹿",body_size:"大",diet:"植食",social_structure:"大群",activity_rhythm:"昼行",special_adaptation:"年度迁徙>5000km——蹄宽如雪鞋——UV视觉探测雪下地衣",endemic:false },
    { genus:"Ursus",name_zh:"北极熊",body_size:"巨",diet:"肉食",social_structure:"独居",activity_rhythm:"昼行",special_adaptation:"皮肤黑色毛发透明——嗅觉探测数公里外海豹呼吸孔",endemic:false },
  ],
};

// Mineral inference rules — simplified from 矿产分布规则库
interface MineralRule {
  condition: (terrain: string, elev: number, climate: string) => boolean;
  minerals: string[];
}

const MINERAL_RULES: MineralRule[] = [
  { condition: (_t, e, _c) => e > 2000 && (_t === "plateau" || _t === "high_mountain"),
    minerals: ["铁矿(BIF型)", "铜矿(斑岩型)", "金矿"] },
  { condition: (_t, e, c) => c.startsWith("A") && e < 500,
    minerals: ["铝土矿(红土型)", "镍矿(风化壳型)"] },
  { condition: (_t, e, c) => e > 1500 && (c.startsWith("D") || c.startsWith("ET")),
    minerals: ["煤矿(石炭纪)", "铁矿(岩浆型)"] },
  { condition: (_t, e, _c) => e < 200 && (_t === "floodplain" || _t === "basin"),
    minerals: ["砂矿(金/锡/钻石)", "盐矿(蒸发岩)", "黏土"] },
  { condition: (_t, e, _c) => _t === "coastal" || (e < 100 && _t === "plain"),
    minerals: ["建筑石料", "海砂", "盐(海盐场)"] },
  { condition: (_t, e, _c) => e > 3000,
    minerals: ["钨矿", "锡矿", "稀土元素"] },
];

// Simplified city potential scoring
function cityPotentialScore(
  elev: number, _slope: number, coastDist: number,
  precip: number, temp: number, soilWrb: string
): { score: number; strengths: string[]; suitable: string[] } {
  let score = 40;
  const strengths: string[] = [];
  const suitable: string[] = [];

  if (precip > 800) { score += 15; strengths.push("降水充沛"); }
  else if (precip > 400) { score += 8; strengths.push("降水适中"); }
  else { score -= 10; }

  if (elev < 500) { score += 12; strengths.push("地形平坦"); }
  else if (elev < 1500) { score += 5; }
  else { score -= 8; }

  // Coast
  if (coastDist < 20) { score += 12; strengths.push("近海"); suitable.push("港口贸易"); }
  else if (coastDist < 100) { score += 5; }
  else { score -= 3; }

  // Climate comfort
  if (temp > 10 && temp < 25) { score += 8; strengths.push("气候宜居"); }
  else if (temp < 0 || temp > 35) { score -= 10; }

  // Soil/agriculture
  if (soilWrb.includes("Chernozem") || soilWrb.includes("Phaeozem") || soilWrb.includes("Fluvisol")) {
    score += 12; strengths.push("肥沃土壤");
    suitable.push("农业中心");
  } else if (soilWrb.includes("Luvisol") || soilWrb.includes("Cambisol")) {
    score += 5;
  }

  // Industries
  if (precip > 600 && elev < 500) suitable.push("灌溉农业");
  if (coastDist < 30) suitable.push("渔业基地");
  if (elev > 1000) suitable.push("矿业城镇");
  if (elev < 200 && coastDist < 50) suitable.push("商贸枢纽");

  return { score: Math.min(100, Math.max(0, score)), strengths, suitable };
}

export function getWildlife(koppenCode: string): AnimalEntry[] {
  // Try exact match first, then main class fallback
  if (WILDLIFE[koppenCode]) return WILDLIFE[koppenCode].slice(0, 3);
  const mainClass = koppenCode[0];
  for (const key of Object.keys(WILDLIFE)) {
    if (key[0] === mainClass) return WILDLIFE[key].slice(0, 3);
  }
  return WILDLIFE["Cfb"].slice(0, 2); // default
}

export function getMinerals(elev: number, _slope: number, terrainType: string, koppenCode: string): string[] {
  const minerals = new Set<string>();
  for (const rule of MINERAL_RULES) {
    if (rule.condition(terrainType, elev, koppenCode)) {
      for (const m of rule.minerals) minerals.add(m);
    }
  }
  if (minerals.size === 0) minerals.add("建筑石料(通用)");
  return Array.from(minerals).slice(0, 4);
}

export function getCityPotential(
  elev: number, _slope: number, coastDist: number,
  precip: number, temp: number, soilWrb: string
) {
  return cityPotentialScore(elev, _slope, coastDist, precip, temp, soilWrb);
}
