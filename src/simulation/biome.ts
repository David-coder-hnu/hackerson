// @ts-nocheck
// Holdridge Life Zone system + biome inference
// Based on: 生态-农业-土壤综合诊断系统

export interface HoldridgeZone {
  latBelt: string;       // 纬度带
  humidityProvince: string; // 湿度省
  biome: string;         // 生命带/潜在自然植被
  biomeZh: string;       // Chinese biome name
  bt: number;            // biotemperature
  per: number;           // potential evapotranspiration ratio
}

export interface SoilType {
  name: string;       // Chinese name
  wrb: string;        // WRB reference soil group
  frequency: string;  // dominant/common/occasional
  note: string;
  confidence: "高" | "中" | "低";
}

export interface PlantSpecies {
  name: string;
  uses: string[];
  rarity: string;
}

export interface HabitatPlants {
  habitat: string;
  description: string;
  plants: PlantSpecies[];
}

// Compute biotemperature (BT)
// BT = average of monthly temps, with 0°C floor and 30°C cap
export function computeBiotemperature(monthlyTemp: number[]): number {
  let sum = 0;
  for (const t of monthlyTemp) {
    if (t <= 0) sum += 0;
    else if (t > 30) sum += 30;
    else sum += t;
  }
  return sum / 12;
}

// Compute annual potential evapotranspiration (PET) using Holdridge formula
export function computePET(bt: number): number {
  return 58.93 * bt;
}

// Compute PER (potential evapotranspiration ratio)
export function computePER(bt: number, annualP: number): number {
  const pet = computePET(bt);
  return pet / annualP;
}

// Determine latitudinal belt from BT
function latitudinalBelt(bt: number): string {
  if (bt < 1.5) return "极地";
  if (bt < 3) return "亚极地";
  if (bt < 6) return "北方带/寒温带";
  if (bt < 12) return "冷温带";
  if (bt < 18) return "暖温带";
  if (bt < 24) return "亚热带";
  return "热带";
}

// Determine humidity province from PER
function humidityProvince(per: number): string {
  if (per < 0.125) return "超湿润";
  if (per < 0.25) return "过湿润";
  if (per < 0.5) return "湿润";
  if (per < 1.0) return "亚湿润";
  if (per < 2.0) return "半干旱";
  if (per < 4.0) return "干旱";
  return "极干旱";
}

// Determine life zone (biome) from BT, PER, and elevation
export function classifyHoldridge(
  monthlyTemp: number[],
  annualP: number,
  elevation: number // meters
): HoldridgeZone {
  const bt = computeBiotemperature(monthlyTemp);
  const per = computePER(bt, annualP);
  const belt = latitudinalBelt(bt);
  const humidity = humidityProvince(per);

  // Altitude correction: -0.6°C per 100m
  const altBT = bt - (elevation / 100) * 0.6;
  const altBelt = latitudinalBelt(Math.max(0, altBT));

  let biomeZh = "";
  let biome = "";

  // Simplified Holdridge hexagon lookup
  if (belt === "热带" || belt === "亚热带") {
    if (humidity === "超湿润" || humidity === "过湿润") { biome = "Tropical Rainforest"; biomeZh = "热带雨林"; }
    else if (humidity === "湿润") { biome = "Tropical Moist Forest"; biomeZh = "热带湿润林"; }
    else if (humidity === "亚湿润") { biome = "Tropical Dry Forest / Savanna"; biomeZh = "热带旱林/稀树草原"; }
    else if (humidity === "半干旱") { biome = "Tropical Thorn Woodland"; biomeZh = "热带刺灌丛"; }
    else { biome = "Tropical Desert Scrub"; biomeZh = "热带荒漠灌丛"; }
  } else if (belt === "暖温带" || belt === "冷温带") {
    if (humidity === "超湿润" || humidity === "过湿润") { biome = "Temperate Rainforest"; biomeZh = "温带雨林"; }
    else if (humidity === "湿润") { biome = "Temperate Moist Forest"; biomeZh = "温带湿润林"; }
    else if (humidity === "亚湿润") { biome = "Temperate Woodland / Grassland"; biomeZh = "温带疏林/草原"; }
    else if (humidity === "半干旱") { biome = "Temperate Steppe"; biomeZh = "温带干草原"; }
    else { biome = "Temperate Desert"; biomeZh = "温带荒漠"; }
  } else if (belt === "北方带/寒温带") {
    if (humidity === "湿润" || humidity === "亚湿润") { biome = "Boreal Forest (Taiga)"; biomeZh = "北方针叶林(泰加林)"; }
    else if (humidity === "半干旱") { biome = "Boreal Woodland"; biomeZh = "北方疏林"; }
    else { biome = "Boreal Scrub"; biomeZh = "北方灌丛"; }
  } else if (belt === "亚极地") {
    biome = "Tundra"; biomeZh = "苔原";
  } else {
    biome = "Polar Desert / Ice"; biomeZh = "极地荒漠/冰原";
  }

  return { latBelt: belt, humidityProvince: humidity, biome, biomeZh, bt, per };
}

// ---- Soil inference based on climate + terrain ----
// Rules derived from: 气候-土壤对应规则库.json

interface SoilRule {
  condition: (climate: string, temp: number, precip: number, elev: number, slope: number) => boolean;
  soil: SoilType;
}

const SOIL_RULES: SoilRule[] = [
  // Tropical rainforest soils
  { condition: (c, t, p, e, s) => c === "Af" && t > 24 && p > 2000 && e < 500 && s < 5,
    soil: { name: "砖红壤", wrb: "Ferralsols", frequency: "dominant", note: "强脱硅富铝化，铁铝富集，深厚酸性", confidence: "高" } },
  { condition: (c, t, p, e, s) => c === "Af" && t > 24 && p > 2000 && e >= 500 && e < 1500,
    soil: { name: "黄壤", wrb: "Alisols", frequency: "common", note: "铁氧化物水化呈黄色", confidence: "高" } },
  // Tropical monsoon soils
  { condition: (c, t, p, e, s) => c === "Am" && e < 500 && s < 5,
    soil: { name: "赤红壤", wrb: "Acrisols", frequency: "dominant", note: "干季使结构稍好", confidence: "高" } },
  { condition: (c, t, p, e, s) => c === "Am" && s >= 5,
    soil: { name: "山地赤红壤", wrb: "Skeletic Acrisols", frequency: "common", note: "迎风坡强烈淋溶", confidence: "高" } },
  // Savanna soils
  { condition: (c, t, p, e, s) => (c === "Aw" || c === "As") && p > 600 && s < 5,
    soil: { name: "燥红土", wrb: "Chromic Luvisols", frequency: "dominant", note: "干季显著,铁氧化物脱水呈红褐", confidence: "高" } },
  { condition: (c, t, p, e, s) => (c === "Aw" || c === "As") && p < 800,
    soil: { name: "变性土", wrb: "Vertisols", frequency: "common", note: "干湿交替膨缩裂隙", confidence: "中" } },
  // Hot desert
  { condition: (c, t, p, e, s) => c === "BWh",
    soil: { name: "石质土/漠土", wrb: "Leptosols / Calcisols", frequency: "dominant", note: "极度干旱,物理风化为主,钙积层发育", confidence: "高" } },
  // Cold desert
  { condition: (c, t, p, e, s) => c === "BWk" || c === "BSk",
    soil: { name: "钙积土/栗钙土", wrb: "Calcisols / Kastanozems", frequency: "dominant", note: "干旱区钙积,有机质积累弱", confidence: "高" } },
  // Mediterranean
  { condition: (c, t, p, e, s) => (c === "Csa" || c === "Csb") && s < 10,
    soil: { name: "淋溶土/钙积淋溶土", wrb: "Luvisols / Calcic Luvisols", frequency: "dominant", note: "干季钙积,湿季淋溶", confidence: "高" } },
  // Humid subtropical
  { condition: (c, t, p, e, s) => (c === "Cfa" || c === "Cwa") && e < 500,
    soil: { name: "淋溶土/老成土", wrb: "Luvisols / Alisols", frequency: "dominant", note: "黏化层发育,盐基中度淋失", confidence: "高" } },
  // Oceanic
  { condition: (c, t, p, e, s) => c === "Cfb",
    soil: { name: "淋溶土/雏形土", wrb: "Luvisols / Cambisols", frequency: "dominant", note: "温和湿润,矿物风化适中", confidence: "高" } },
  // Humid continental
  { condition: (c, t, p, e, s) => (c === "Dfa" || c === "Dfb" || c === "Dwa" || c === "Dwb"),
    soil: { name: "淋溶土/黑钙土", wrb: "Luvisols / Chernozems", frequency: "dominant", note: "有机质丰富(草原区),淋溶适中(林区)", confidence: "高" } },
  // Subarctic
  { condition: (c, t, p, e, s) => (c === "Dfc" || c === "Dwc" || c === "Dfd"),
    soil: { name: "灰化土", wrb: "Podzols", frequency: "dominant", note: "强烈酸性淋溶,灰化层发育", confidence: "高" } },
  // Tundra
  { condition: (c, t, p, e, s) => c === "ET",
    soil: { name: "永冻潜育土", wrb: "Cryosols / Gleysols", frequency: "dominant", note: "多年冻土,潜育化,有机质分解极慢", confidence: "高" } },
  // Mountain/steep terrain modifier
  { condition: (c, tc, p, e, s) => s > 25,
    soil: { name: "石质薄层土", wrb: "Leptosols", frequency: "dominant", note: "坡度>25°,侵蚀强烈,基岩出露", confidence: "高" } },
  // Valley modifier
  { condition: (c, tc, p, e, s) => s < 3 && e < 300,
    soil: { name: "冲积土", wrb: "Fluvisols", frequency: "dominant", note: "河谷深厚冲积物沉积", confidence: "高" } },
];

export function inferSoil(
  koppenCode: string,
  annualTemp: number,
  annualPrecip: number,
  elevation: number,
  slope: number
): SoilType[] {
  const results: SoilType[] = [];
  for (const rule of SOIL_RULES) {
    if (rule.condition(koppenCode, annualTemp, annualPrecip, elevation, slope)) {
      results.push(rule.soil);
    }
  }
  if (results.length === 0) {
    results.push({ name: "雏形土", wrb: "Cambisols", frequency: "dominant", note: "中等发育程度的土壤，无显著诊断特征", confidence: "中" });
  }
  return results;
}

// ---- Plant recommendations ----
// Rules from: 气候-原产植物库.json (sampled subset)

const PLANT_DB: Record<string, HabitatPlants[]> = {
  Af: [ // Tropical rainforest
    {
      habitat: "低地森林", description: "海拔<500m,终年湿润,三层乔木+林下荫蔽",
      plants: [
        { name: "橡胶树", uses: ["树脂", "建材"], rarity: "常见" },
        { name: "可可树", uses: ["食物"], rarity: "常见" },
        { name: "巴西栗", uses: ["食物"], rarity: "少见" },
        { name: "榕属", uses: ["食物", "饲料"], rarity: "常见" },
        { name: "藤本棕榈", uses: ["纤维", "建材"], rarity: "常见" },
        { name: "面包树", uses: ["食物", "建材"], rarity: "少见" },
      ],
    },
    {
      habitat: "山地森林", description: "海拔500-1500m,云雾增多,附生植物丰富",
      plants: [
        { name: "咖啡属", uses: ["食物"], rarity: "常见" },
        { name: "桫椤属", uses: ["纤维", "观赏"], rarity: "常见" },
        { name: "兰属", uses: ["观赏", "香料"], rarity: "常见" },
        { name: "杜鹃花属", uses: ["观赏", "染料"], rarity: "常见" },
      ],
    },
    {
      habitat: "湿地/河岸", description: "河漫滩沼泽,季节性积水",
      plants: [
        { name: "红树属", uses: ["建材", "染料", "药材"], rarity: "常见" },
        { name: "椰子", uses: ["食物", "纤维", "建材"], rarity: "常见" },
        { name: "刺竹属", uses: ["建材", "食物", "纤维"], rarity: "常见" },
      ],
    },
  ],
  Aw: [ // Savanna
    {
      habitat: "稀树草原", description: "广阔草地散布耐旱乔木,干湿季分明",
      plants: [
        { name: "猴面包树", uses: ["食物", "纤维", "药材"], rarity: "常见" },
        { name: "金合欢属", uses: ["建材", "药材", "染料"], rarity: "常见" },
        { name: "高粱", uses: ["食物"], rarity: "常见" },
        { name: "木薯", uses: ["食物"], rarity: "常见" },
        { name: "花生", uses: ["食物"], rarity: "常见" },
        { name: "芝麻", uses: ["食物", "油料"], rarity: "常见" },
      ],
    },
  ],
  Cfa: [ // Humid subtropical
    {
      habitat: "低地阔叶林", description: "常绿阔叶林,夏季湿热冬季温和",
      plants: [
        { name: "水稻", uses: ["食物"], rarity: "常见" },
        { name: "柑橘属", uses: ["食物"], rarity: "常见" },
        { name: "茶树", uses: ["食物"], rarity: "常见" },
        { name: "竹子", uses: ["建材", "食物"], rarity: "常见" },
        { name: "桑树", uses: ["纤维", "食物"], rarity: "常见" },
        { name: "油菜", uses: ["油料", "食物"], rarity: "常见" },
      ],
    },
  ],
  Cfb: [ // Oceanic
    {
      habitat: "温带阔叶林/草地", description: "终年温和湿润,适合农牧",
      plants: [
        { name: "小麦", uses: ["食物"], rarity: "常见" },
        { name: "大麦", uses: ["食物", "饲料"], rarity: "常见" },
        { name: "马铃薯", uses: ["食物"], rarity: "常见" },
        { name: "苹果", uses: ["食物"], rarity: "常见" },
        { name: "葡萄", uses: ["食物"], rarity: "常见" },
        { name: "燕麦", uses: ["食物", "饲料"], rarity: "常见" },
      ],
    },
  ],
  Csa: [ // Mediterranean
    {
      habitat: "硬叶灌丛/常绿林", description: "夏干冬湿,适应干旱的硬叶植被",
      plants: [
        { name: "橄榄", uses: ["食物", "油料"], rarity: "常见" },
        { name: "葡萄", uses: ["食物"], rarity: "常见" },
        { name: "无花果", uses: ["食物"], rarity: "常见" },
        { name: "迷迭香", uses: ["香料", "药材"], rarity: "常见" },
        { name: "薰衣草", uses: ["香料", "药材"], rarity: "常见" },
        { name: "柑橘属", uses: ["食物"], rarity: "常见" },
      ],
    },
  ],
  Dfa: [ // Hot-summer continental
    {
      habitat: "落叶阔叶林/草原", description: "夏季湿热冬季严寒,土壤肥沃",
      plants: [
        { name: "玉米", uses: ["食物", "饲料"], rarity: "常见" },
        { name: "大豆", uses: ["食物", "油料"], rarity: "常见" },
        { name: "小麦", uses: ["食物"], rarity: "常见" },
        { name: "向日葵", uses: ["油料"], rarity: "常见" },
        { name: "苹果", uses: ["食物"], rarity: "常见" },
        { name: "甜菜", uses: ["食物"], rarity: "常见" },
      ],
    },
  ],
  BSh: [ // Hot steppe
    {
      habitat: "半干旱草原", description: "年降水300-700mm,短草草原或灌丛草原",
      plants: [
        { name: "小米", uses: ["食物"], rarity: "常见" },
        { name: "高粱", uses: ["食物", "饲料"], rarity: "常见" },
        { name: "棉花", uses: ["纤维"], rarity: "常见" },
        { name: "鹰嘴豆", uses: ["食物"], rarity: "常见" },
      ],
    },
  ],
};

// Fallback: generic plants by main climate class
const FALLBACK_PLANTS: Record<string, HabitatPlants[]> = {
  A: [{ habitat: "热带低地", description: "高温多雨", plants: [
    { name: "木薯", uses: ["食物"], rarity: "常见" },
    { name: "香蕉", uses: ["食物"], rarity: "常见" },
    { name: "椰子", uses: ["食物", "纤维"], rarity: "常见" },
  ]}],
  B: [{ habitat: "干旱区", description: "降水稀少", plants: [
    { name: "椰枣", uses: ["食物"], rarity: "常见" },
    { name: "仙人掌", uses: ["食物", "药材"], rarity: "常见" },
  ]}],
  C: [{ habitat: "温带", description: "四季分明", plants: [
    { name: "小麦", uses: ["食物"], rarity: "常见" },
    { name: "马铃薯", uses: ["食物"], rarity: "常见" },
    { name: "苹果", uses: ["食物"], rarity: "常见" },
  ]}],
  D: [{ habitat: "冷温带", description: "冬季严寒", plants: [
    { name: "黑麦", uses: ["食物", "饲料"], rarity: "常见" },
    { name: "马铃薯", uses: ["食物"], rarity: "常见" },
    { name: "燕麦", uses: ["食物", "饲料"], rarity: "常见" },
  ]}],
  E: [{ habitat: "极地/高山", description: "极寒", plants: [
    { name: "地衣", uses: ["药材", "染料"], rarity: "常见" },
  ]}],
};

export function recommendPlants(koppenCode: string): HabitatPlants[] {
  if (PLANT_DB[koppenCode]) return PLANT_DB[koppenCode];
  const mainClass = koppenCode[0];
  return FALLBACK_PLANTS[mainClass] ?? [{ habitat: "未知", description: "气候数据不足", plants: [] }];
}
