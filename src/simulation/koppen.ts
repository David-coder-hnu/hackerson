// Köppen climate classification engine
// Based on the project knowledge base: 柯本气候类型判定矩阵

export interface KoppenResult {
  code: string;       // e.g. "Af", "Cfa", "BWh"
  name: string;       // Chinese name
  nameEn: string;     // English name
  mainClass: string;  // A/B/C/D/E
  description: string;
}

// Compute annual mean temperature
function annualMeanTemp(monthlyTemp: number[]): number {
  return monthlyTemp.reduce((a, b) => a + b, 0) / 12;
}

// Compute total annual precipitation
function annualPrecip(monthlyPrecip: number[]): number {
  return monthlyPrecip.reduce((a, b) => a + b, 0);
}

// Find coldest month temperature
function coldestMonth(monthlyTemp: number[]): number {
  return Math.min(...monthlyTemp);
}

// Find warmest month temperature
function warmestMonth(monthlyTemp: number[]): number {
  return Math.max(...monthlyTemp);
}

// Count months with temp >= 10°C
function monthsAbove10(monthlyTemp: number[]): number {
  return monthlyTemp.filter((t) => t >= 10).length;
}

// Determine precipitation seasonality
function summerPrecipRatio(monthlyPrecip: number[]): number {
  const summer = monthlyPrecip.slice(3, 8).reduce((a, b) => a + b, 0); // Apr-Sep (NH summer)
  const winter = monthlyPrecip.slice(9, 12).concat(monthlyPrecip.slice(0, 2)).reduce((a, b) => a + b, 0);
  return summer / (summer + winter);
}

// Driest month precipitation
function driestMonth(monthlyPrecip: number[]): number {
  return Math.min(...monthlyPrecip);
}

// Wettest month precipitation
function wettestMonth(monthlyPrecip: number[]): number {
  return Math.max(...monthlyPrecip);
}

// Aridity threshold for B-class climates
function aridityThreshold(annualT: number, summerPct: number): number {
  if (summerPct > 0.7) return 20 * annualT + 280;      // summer-dominant
  if (summerPct < 0.3) return 20 * annualT;              // winter-dominant
  return 20 * annualT + 140;                              // even distribution
}

export function classifyKoppen(
  monthlyTemp: number[],
  monthlyPrecip: number[]
): KoppenResult {
  const Tann = annualMeanTemp(monthlyTemp);
  const Pann = annualPrecip(monthlyPrecip);
  const Tcold = coldestMonth(monthlyTemp);
  const Twarm = warmestMonth(monthlyTemp);
  const Pdry = driestMonth(monthlyPrecip);
  const Pwet = wettestMonth(monthlyPrecip);
  const months10 = monthsAbove10(monthlyTemp);
  const summerRatio = summerPrecipRatio(monthlyPrecip);

  // ---- A: Tropical (Tcold >= 18°C) ----
  if (Tcold >= 18) {
    if (Pdry >= 60) return makeResult("Af", "热带雨林气候", "Tropical Rainforest", "A");
    // Am: monsoon — dry season exists but Pdry >= 100 - Pann/25
    const amThreshold = 100 - Pann / 25;
    if (Pdry >= amThreshold) return makeResult("Am", "热带季风气候", "Tropical Monsoon", "A");
    // Aw/As: savanna
    return makeResult("Aw", "热带稀树草原气候", "Tropical Savanna", "A");
  }

  // ---- B: Dry (determined by aridity) ----
  const rThreshold = aridityThreshold(Tann, summerRatio);
  if (Pann < rThreshold) {
    if (Pann < rThreshold / 2) {
      // BW: desert
      if (Tann >= 18) return makeResult("BWh", "热带沙漠气候", "Hot Desert", "B");
      if (Tcold <= -3) return makeResult("BWk", "冷沙漠气候", "Cold Desert", "B");
      return makeResult("BWk", "温带沙漠气候", "Temperate Desert", "B");
    }
    // BS: steppe
    if (Tann >= 18) return makeResult("BSh", "热带草原气候", "Hot Steppe", "B");
    if (Tcold <= -3) return makeResult("BSk", "冷草原气候", "Cold Steppe", "B");
    return makeResult("BSk", "温带草原气候", "Temperate Steppe", "B");
  }

  // ---- C: Temperate (Tcold: 0 to 18°C, Twarm > 10°C) ----
  if (Tcold > -3 && Tcold < 18 && Twarm > 10) {
    // Determine precipitation pattern
    const summerDry = Pwet === Math.max(...monthlyPrecip.slice(0, 3).concat(monthlyPrecip.slice(9, 12)))
      ? false : (Pdry * 3 < Pwet && summerRatio < 0.3); // winter-wet summer-dry = Mediterranean
    const winterDry = Pdry * 10 < Pwet && summerRatio > 0.7;
    const fullyHumid = !summerDry && !winterDry;

    if (summerDry) {
      if (Twarm >= 22) return makeResult("Csa", "地中海气候(热夏)", "Hot-summer Mediterranean", "C");
      if (months10 >= 4) return makeResult("Csb", "地中海气候(暖夏)", "Warm-summer Mediterranean", "C");
      return makeResult("Csc", "地中海气候(凉夏)", "Cool-summer Mediterranean", "C");
    }
    if (winterDry) {
      if (Twarm >= 22) return makeResult("Cwa", "亚热带季风气候(冬干)", "Subtropical Winter-dry", "C");
      if (months10 >= 4) return makeResult("Cwb", "温带季风气候(冬干)", "Temperate Winter-dry", "C");
      return makeResult("Cwc", "冷温带季风(冬干)", "Cool Winter-dry", "C");
    }
    if (fullyHumid) {
      if (Twarm >= 22) return makeResult("Cfa", "亚热带湿润气候", "Subtropical Humid", "C");
      if (months10 >= 4) return makeResult("Cfb", "温带海洋性气候", "Temperate Oceanic", "C");
      return makeResult("Cfc", "冷温带海洋性气候", "Cool Oceanic", "C");
    }
    return makeResult("Cfb", "温带海洋性气候", "Temperate Oceanic", "C");
  }

  // ---- D: Cold (Tcold <= 0°C, Twarm > 10°C) ----
  if (Tcold <= -3 && Twarm > 10) {
    const winterDryD = Pdry * 10 < Pwet && summerRatio > 0.7;
    const fullyHumidD = !winterDryD;

    if (winterDryD) {
      if (Twarm >= 22) return makeResult("Dwa", "温带大陆性季风(热夏)", "Hot-summer Continental Winter-dry", "D");
      if (months10 >= 4 && Tcold > -38) return makeResult("Dwb", "温带大陆性季风(暖夏)", "Warm-summer Continental Winter-dry", "D");
      if (Tcold <= -38) return makeResult("Dwd", "亚寒带季风(严冬)", "Severe Winter Continental Winter-dry", "D");
      return makeResult("Dwc", "亚寒带季风(凉夏)", "Cool-summer Continental Winter-dry", "D");
    }
    if (fullyHumidD) {
      if (Twarm >= 22) return makeResult("Dfa", "温带大陆性湿润(热夏)", "Hot-summer Humid Continental", "D");
      if (months10 >= 4 && Tcold > -38) return makeResult("Dfb", "温带大陆性湿润(暖夏)", "Warm-summer Humid Continental", "D");
      if (Tcold <= -38) return makeResult("Dfd", "亚寒带(严冬)", "Severe Winter Subarctic", "D");
      return makeResult("Dfc", "亚寒带针叶林气候", "Subarctic", "D");
    }
    return makeResult("Dfb", "温带大陆性湿润(暖夏)", "Warm-summer Humid Continental", "D");
  }

  // ---- E: Polar (Twarm < 10°C) ----
  if (Twarm < 10) {
    if (Twarm > 0) return makeResult("ET", "苔原气候", "Tundra", "E");
    return makeResult("EF", "冰原气候", "Ice Cap", "E");
  }

  return makeResult("Cfb", "温带海洋性气候", "Temperate Oceanic", "C");
}

function makeResult(
  code: string,
  name: string,
  nameEn: string,
  mainClass: string
): KoppenResult {
  const descriptions: Record<string, string> = {
    Af: "终年高温多雨，无明显干季，热带雨林茂密，是地球上生物多样性最高的陆地生态系统",
    Am: "终年高温，降水集中于夏季，存在短暂干季。植被以热带季雨林为主，干季部分树木落叶",
    Aw: "终年高温，干湿季分明。植被以稀树草原为主，散布耐旱乔木，大型食草动物多样性极高",
    BWh: "终年炎热干旱，降水极少且蒸发极强。植被稀少，以旱生灌丛和短命植物为主，物理风化主导",
    BWk: "冬冷夏热，极度干旱。植被以旱生灌丛为主，土壤发育极弱，常见盐碱化和钙积层",
    BSh: "炎热半干旱，年降水300-700mm。植被为热带草原或刺灌丛，干季显著",
    BSk: "温带半干旱，年降水200-500mm。典型草原或短草草原，土壤肥沃但水分不足",
    Cfa: "夏季炎热潮湿，冬季温和。常绿阔叶林为主，土壤以淋溶土和老成土为主，适宜多种作物",
    Cfb: "终年温和湿润，夏季凉爽冬季温和。落叶阔叶林为主，土壤肥沃，适宜温带作物和畜牧业",
    Csa: "夏季炎热干燥，冬季温和多雨。硬叶灌丛和常绿阔叶林，土壤以淋溶土为主，适宜橄榄、葡萄等",
    Csb: "夏季温暖干燥，冬季凉爽湿润。硬叶林或混交林，适宜葡萄、水果种植",
    Cwa: "夏季炎热多雨，冬季温和干燥。亚热带常绿阔叶林，土壤以淋溶土和老成土为主",
    Cwb: "夏季温暖湿润，冬季凉爽干燥。山地森林或高原草原，适宜咖啡、茶叶等高附加值作物",
    Dfa: "夏季炎热多雨，冬季寒冷。落叶阔叶林与草原交错，土壤为淋溶土或黑钙土，适宜玉米大豆",
    Dfb: "夏季温暖，冬季寒冷有雪。针阔混交林，土壤以淋溶土和灰化土为主，适宜小麦和马铃薯",
    Dfc: "夏季凉爽短暂，冬季漫长严寒。亚寒带针叶林，土壤为灰化土，农业受限",
    Dwa: "夏季炎热多雨，冬季寒冷干燥。温带季风落叶林，土壤为淋溶土或黑钙土",
    Dwb: "夏季温暖，冬季严寒干燥。针阔混交林，土壤以暗色淋溶土为主",
    Dwd: "夏季凉爽短促，冬季极端严寒。落叶松林或森林苔原，土壤为永冻土上的灰化土",
    ET: "夏季短促凉爽，冬季漫长严寒。苔原植被，多年冻土广泛分布，土壤为永冻层上的潜育土",
    EF: "终年严寒，月均温不超过0°C。无植被覆盖或仅有冰缘藻类，被冰雪永久覆盖",
  };
  return { code, name, nameEn, mainClass, description: descriptions[code] ?? "" };
}

// Generate monthly temperature from annual mean + latitude + continentality
export function generateMonthlyTemp(
  annualT: number,
  annualRange: number,
  hemisphere: "N" | "S" = "N"
): number[] {
  const temps: number[] = [];
  for (let m = 0; m < 12; m++) {
    // Sine wave: peak in July (NH) or January (SH)
    const phase = hemisphere === "N" ? 6 : 0;
    const offset = Math.sin(((m - phase) / 12) * Math.PI * 2);
    temps.push(annualT + (annualRange / 2) * offset);
  }
  return temps;
}

// Generate monthly precipitation from annual total + seasonality
export function generateMonthlyPrecip(
  annualP: number,
  seasonalPeak: "summer" | "winter" | "even" = "summer"
): number[] {
  const precip: number[] = [];
  for (let m = 0; m < 12; m++) {
    let factor: number;
    switch (seasonalPeak) {
      case "summer":
        factor = 0.3 + 0.7 * Math.max(0, Math.sin(((m - 3) / 12) * Math.PI * 2));
        break;
      case "winter":
        factor = 0.3 + 0.7 * Math.max(0, Math.sin(((m - 9) / 12) * Math.PI * 2));
        break;
      default:
        factor = 1.0;
    }
    precip.push((annualP / 12) * factor * 2);
  }
  return precip;
}
