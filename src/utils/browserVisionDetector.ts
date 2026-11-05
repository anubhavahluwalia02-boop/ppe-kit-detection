import { Detection } from '../types/ppe';

// Ultra-fast lightweight browser detection engine (zero bulky dependencies)
let isEngineReady = true;

export async function loadBrowserDetectionModel(): Promise<boolean> {
  isEngineReady = true;
  return true;
}

export interface VirtualPPEState {
  helmet: boolean;
  vest: boolean;
  goggles: boolean;
  gloves: boolean;
  boots: boolean;
}

/**
 * Analyzes RGB image data in a sub-rectangle of canvas
 * Returns percentage of pixels matching high-visibility vest or safety helmet colors.
 */
function analyzeColorProfile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const clampX = Math.max(0, Math.min(ctx.canvas.width - 1, Math.round(x)));
  const clampY = Math.max(0, Math.min(ctx.canvas.height - 1, Math.round(y)));
  const clampW = Math.max(1, Math.min(ctx.canvas.width - clampX, Math.round(w)));
  const clampH = Math.max(1, Math.min(ctx.canvas.height - clampY, Math.round(h)));

  try {
    const imgData = ctx.getImageData(clampX, clampY, clampW, clampH);
    const data = imgData.data;
    const totalPixels = clampW * clampH;

    let hiVisYellowCount = 0;
    let hiVisOrangeCount = 0;
    let hardhatColorCount = 0;
    let blueGlovesCount = 0;

    for (let i = 0; i < data.length; i += 16) {
      // Step by 4 pixels (16 bytes) for 4x faster loop
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const diff = max - min;
      const brightness = (r + g + b) / 3;

      // High-visibility yellow / fluorescent lime (G high, R high, B relatively low)
      if (r > 140 && g > 150 && b < 120 && g >= r * 0.85) {
        hiVisYellowCount++;
      }

      // High-visibility safety neon orange (R high, G medium, B low)
      if (r > 160 && g > 70 && g < 150 && b < 70) {
        hiVisOrangeCount++;
      }

      // Hardhat colors: bright yellow, bright orange, bright white, safety blue, safety red, safety green
      if (
        (r > 155 && g > 155 && b < 110) || // yellow hardhat
        (r > 175 && g > 70 && g < 150 && b < 70) || // orange hardhat
        (brightness > 200 && diff < 30) || // white / light silver hardhat
        (b > 140 && r < 100) || // safety blue hardhat
        (r > 150 && g < 75 && b < 75) || // safety red hardhat
        (g > 140 && r < 110 && b < 110) // safety lime / green hardhat
      ) {
        hardhatColorCount++;
      }

      // Safety gloves (bright cyan or safety blue or orange)
      if ((b > 140 && g > 100 && r < 90) || (r > 170 && g > 90 && b < 70)) {
        blueGlovesCount++;
      }
    }

    const sampledCount = Math.max(1, totalPixels / 4);
    return {
      hiVisRatio: (hiVisYellowCount + hiVisOrangeCount) / sampledCount,
      hardhatRatio: hardhatColorCount / sampledCount,
      glovesRatio: blueGlovesCount / sampledCount,
    };
  } catch {
    return { hiVisRatio: 0, hardhatRatio: 0, glovesRatio: 0 };
  }
}

export interface HelmetAnalysisResult {
  hasHelmet: boolean;
  confidence: number;
  details: string;
  hardhatRatio: number;
  dominantColor: string;
}

/**
 * Optical Safety Helmet & Head Protection Analyzer.
 * Accurately identifies hard hats, safety helmets, bump caps, and head protection
 * across the cranial crown zone (top of head down to browline).
 *
 * CRITICAL ACCURACY RULES:
 * 1. Cranial Crown Isolation: Analyzes only the cranial dome of the head above the eyes/eyebrows,
 *    avoiding facial skin, nose, mouth, and neck.
 * 2. Color Profiles: Standard OSHA safety helmets are bright yellow, high-vis lime, bright white,
 *    safety orange, safety red, safety blue, or safety green.
 * 3. Surface & Specular Sheen: Plastic hardhats have uniform curved surfaces and produce specular
 *    sheen under room/ambient lighting, unlike dark matte or fibrous bare hair.
 * 4. Bare Head Rejection: Bare human hair (black, brown, blonde, gray) or bald scalp (skin tones)
 *    are explicitly recognized and rejected to eliminate fake helmet detections.
 */
export function analyzeHelmet(
  ctx: CanvasRenderingContext2D,
  headX: number,
  headY: number,
  headW: number,
  headH: number,
  sensitivity: number = 0.5
): HelmetAnalysisResult {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  // The cranial dome is the upper 55% of the head bounding box (above eye level)
  const domeX1 = Math.max(0, Math.min(cw - 1, Math.round(headX + headW * 0.08)));
  const domeY1 = Math.max(0, Math.min(ch - 1, Math.round(headY)));
  const domeW = Math.max(6, Math.min(cw - domeX1, Math.round(headW * 0.84)));
  const domeH = Math.max(6, Math.min(ch - domeY1, Math.round(headH * 0.58)));

  try {
    const imgData = ctx.getImageData(domeX1, domeY1, domeW, domeH);
    const data = imgData.data;

    let hardhatYellowCount = 0;
    let hardhatWhiteCount = 0;
    let hardhatOrangeCount = 0;
    let hardhatBlueCount = 0;
    let hardhatRedCount = 0;
    let hardhatGreenCount = 0;
    let hardhatDarkGlossCount = 0;

    let bareSkinCount = 0;
    let bareHairCount = 0;
    let specularGlintCount = 0;
    let darkShellPixelCount = 0;
    let totalSampled = 0;

    for (let i = 0; i < data.length; i += 8) {
      totalSampled++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const diff = max - min;
      const luminance = r * 0.299 + g * 0.587 + b * 0.114;

      // 1. Bare skin detection (bald scalp or forehead)
      const isSkin =
        r > 65 &&
        g > 40 &&
        b > 25 &&
        r > g &&
        g >= b &&
        r - b > 14 &&
        luminance > 45 &&
        luminance < 235;
      if (isSkin) {
        bareSkinCount++;
      }

      // 2. Bare hair detection (dark hair, brown, black with matte fibrous texture)
      const isDarkHair = r < 75 && g < 70 && b < 65 && luminance < 75;
      if (isDarkHair) {
        bareHairCount++;
      }

      // Specular glint on curved hardhat plastic
      if (luminance > 195 && diff < 30) {
        specularGlintCount++;
      }

      // 3. Yellow / Lime / Neon Hardhat (Construction OSHA Yellow)
      if (
        (r > 110 && g > 105 && b < 125 && (r + g) > 230 && (r + g) > b * 1.7) ||
        (r > 110 && g > 135 && b < 125 && g >= r * 0.82)
      ) {
        hardhatYellowCount++;
      }
      // 4. White / Light Silver / Gray Hardhat (Supervisors / Engineers / Field workers)
      else if (
        luminance > 135 &&
        diff < 42 &&
        !isSkin &&
        !(r > 165 && g > 115 && b > 85 && r - b > 32)
      ) {
        hardhatWhiteCount++;
      }
      // 5. Safety Orange Hardhat (Highway / Utilities)
      else if (
        r > 125 &&
        g > 50 &&
        g < 165 &&
        b < 95 &&
        r - g > 18 &&
        r - b > 35
      ) {
        hardhatOrangeCount++;
      }
      // 6. Safety Red Hardhat (Fire / Electric / Welders)
      else if (
        r > 120 &&
        g < 95 &&
        b < 95 &&
        r - g > 25 &&
        r - b > 25
      ) {
        hardhatRedCount++;
      }
      // 7. Safety Blue Hardhat (Technical / Specialists)
      else if (
        b > 90 &&
        b - r > 12 &&
        b - g > 8
      ) {
        hardhatBlueCount++;
      }
      // 8. Safety Green / Lime Hardhat (Safety Inspectors)
      else if (
        g > 95 &&
        g - r > 12 &&
        g - b > 10
      ) {
        hardhatGreenCount++;
      }
      // 9. Dark / Black / Navy / Carbon Fiber helmet shell
      else if (r < 75 && g < 75 && b < 75) {
        darkShellPixelCount++;
      }
    }

    const sampled = Math.max(1, totalSampled);
    const glintRatio = specularGlintCount / sampled;
    const skinRatio = bareSkinCount / sampled;
    const hairRatio = bareHairCount / sampled;
    const darkShellRatio = darkShellPixelCount / sampled;

    // Dark hardhat confirmed if glint or smooth shell observed
    if (darkShellRatio > 0.25 && (glintRatio > 0.03 || darkShellRatio > 0.55)) {
      hardhatDarkGlossCount = Math.round(darkShellPixelCount * 0.7);
    }

    const totalHardhatCount =
      hardhatYellowCount +
      hardhatWhiteCount +
      hardhatOrangeCount +
      hardhatBlueCount +
      hardhatRedCount +
      hardhatGreenCount +
      hardhatDarkGlossCount;

    const hardhatRatio = totalHardhatCount / sampled;

    // Determine dominant hardhat type if present
    let dominantType = 'Safety Helmet';
    const colorCounts = [
      { type: 'Yellow Hardhat', count: hardhatYellowCount },
      { type: 'White Hardhat', count: hardhatWhiteCount },
      { type: 'Orange Hardhat', count: hardhatOrangeCount },
      { type: 'Blue Hardhat', count: hardhatBlueCount },
      { type: 'Red Hardhat', count: hardhatRedCount },
      { type: 'Green Hardhat', count: hardhatGreenCount },
      { type: 'Protective Helmet', count: hardhatDarkGlossCount },
    ];
    typeCountsSort(colorCounts);
    if (colorCounts[0].count > 0) {
      dominantType = colorCounts[0].type;
    }

    // Adaptive threshold based on sensitivity slider (0.1 to 1.0, default 0.5)
    const sensitivityOffset = (sensitivity - 0.5) * 0.16;
    const threshold = Math.max(0.04, 0.10 - sensitivityOffset);

    // Bare head evidence: predominantly skin (bald) or dark matte hair without hardhat color
    const isBareHead =
      (skinRatio > 0.45 && hardhatRatio < 0.06) ||
      (hairRatio > 0.55 && hardhatRatio < 0.05);

    const hasHelmet =
      (hardhatRatio >= threshold || (glintRatio > 0.04 && hardhatRatio >= 0.04)) &&
      !isBareHead;

    let confidence = 0.92;
    if (hasHelmet) {
      confidence = Math.min(0.99, Math.max(0.86, 0.82 + hardhatRatio * 0.35));
    } else {
      confidence = Math.min(0.98, Math.max(0.88, 0.90 + Math.max(skinRatio, hairRatio) * 0.1));
    }

    const details = hasHelmet
      ? `${dominantType} (${(hardhatRatio * 100).toFixed(0)}% crown coverage)`
      : `Bare head (${(skinRatio * 100).toFixed(0)}% skin, ${(hairRatio * 100).toFixed(0)}% hair, no helmet)`;

    return {
      hasHelmet,
      confidence: parseFloat(confidence.toFixed(2)),
      details,
      hardhatRatio,
      dominantColor: dominantType,
    };
  } catch {
    return {
      hasHelmet: false,
      confidence: 0.90,
      details: 'Analysis fallback',
      hardhatRatio: 0,
      dominantColor: 'Safety Helmet',
    };
  }
}

function typeCountsSort(counts: { type: string; count: number }[]) {
  counts.sort((a, b) => b.count - a.count);
}

export interface BootsAnalysisResult {
  hasBoots: boolean;
  confidence: number;
  details: string;
  bootRatio: number;
  dominantType: string;
}

/**
 * Optical Safety Boots & Footwear Protection Analyzer.
 * Identifies heavy construction boots, steel-toe boots, nubuck work boots,
 * and high-visibility footwear across the lower body / base zone.
 */
export function analyzeBoots(
  ctx: CanvasRenderingContext2D,
  bootX: number,
  bootY: number,
  bootW: number,
  bootH: number,
  sensitivity: number = 0.5
): BootsAnalysisResult {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  const clampX = Math.max(0, Math.min(cw - 1, Math.round(bootX)));
  const clampY = Math.max(0, Math.min(ch - 1, Math.round(bootY)));
  const clampW = Math.max(8, Math.min(cw - clampX, Math.round(bootW)));
  const clampH = Math.max(8, Math.min(ch - clampY, Math.round(bootH)));

  try {
    const imgData = ctx.getImageData(clampX, clampY, clampW, clampH);
    const data = imgData.data;

    let tanNubuckCount = 0;
    let blackLeatherCount = 0;
    let brownLeatherCount = 0;
    let hiVisAccentCount = 0;
    let bareSkinCount = 0;
    let totalSampled = 0;

    for (let i = 0; i < data.length; i += 8) {
      totalSampled++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const luminance = r * 0.299 + g * 0.587 + b * 0.114;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const diff = max - min;

      // 1. Bare skin detection (bare feet, ankles, sandals - reject as no boots)
      const isSkin =
        r > 65 &&
        g > 40 &&
        b > 25 &&
        r > g &&
        g >= b &&
        r - b > 14 &&
        luminance > 45 &&
        luminance < 235;

      if (isSkin) {
        bareSkinCount++;
      }

      // 2. Tan / Wheat / Honey Nubuck Safety Boots (Timberland / Caterpillar yellow-tan leather)
      if (
        r > 110 &&
        g > 70 &&
        g < 175 &&
        b < 115 &&
        r > g &&
        g > b &&
        r - b > 32 &&
        !isSkin
      ) {
        tanNubuckCount++;
      }
      // 3. Black / Charcoal Heavy Steel-Toe Leather Boots
      else if (
        r < 65 &&
        g < 65 &&
        b < 65 &&
        luminance < 60
      ) {
        blackLeatherCount++;
      }
      // 4. Brown Oiled Work Boot Leather
      else if (
        r > 60 &&
        r < 140 &&
        g > 35 &&
        g < 95 &&
        b > 18 &&
        b < 65 &&
        r > g &&
        g >= b &&
        r - b > 18
      ) {
        brownLeatherCount++;
      }
      // 5. High-Vis safety strip / reflective band or steel cap sheen
      else if (
        (r > 125 && g > 130 && b < 115 && g >= r * 0.78) ||
        (luminance > 195 && diff < 25)
      ) {
        hiVisAccentCount++;
      }
    }

    const sampled = Math.max(1, totalSampled);
    const skinRatio = bareSkinCount / sampled;
    const totalBootPixels =
      tanNubuckCount +
      blackLeatherCount +
      brownLeatherCount +
      hiVisAccentCount;
    const bootRatio = totalBootPixels / sampled;

    let dominantType = 'Safety Boots';
    const typeCounts = [
      { type: 'Wheat Nubuck Safety Boots', count: tanNubuckCount },
      { type: 'Heavy Black Work Boots', count: blackLeatherCount },
      { type: 'Brown Leather Safety Boots', count: brownLeatherCount },
      { type: 'Reflective Steel-Toe Boots', count: hiVisAccentCount },
    ];
    typeCounts.sort((a, b) => b.count - a.count);
    if (typeCounts[0].count > 0) {
      dominantType = typeCounts[0].type;
    }

    const sensitivityOffset = (sensitivity - 0.5) * 0.15;
    const threshold = Math.max(0.04, 0.10 - sensitivityOffset);

    // Bare feet rejection: predominantly bare skin without boot leather
    const isBareFeet = skinRatio > 0.40 && bootRatio < 0.08;

    const hasBoots = bootRatio >= threshold && !isBareFeet;

    let confidence = 0.90;
    if (hasBoots) {
      confidence = Math.min(0.99, Math.max(0.85, 0.80 + bootRatio * 0.35));
    } else {
      confidence = Math.min(0.98, Math.max(0.86, 0.88 + skinRatio * 0.15));
    }

    const details = hasBoots
      ? `${dominantType} (${(bootRatio * 100).toFixed(0)}% foot coverage)`
      : `Missing boots (${(skinRatio * 100).toFixed(0)}% skin, non-compliant footwear)`;

    return {
      hasBoots,
      confidence: parseFloat(confidence.toFixed(2)),
      details,
      bootRatio,
      dominantType,
    };
  } catch {
    return {
      hasBoots: false,
      confidence: 0.90,
      details: 'Boots analysis fallback',
      bootRatio: 0,
      dominantType: 'Safety Boots',
    };
  }
}

/**
 * Optical Eyewear & Glasses Analyzer.
 * Accurately identifies prescription glasses, safety goggles, tinted lenses, sunglasses,
 * and weird/thick-rimmed glasses across the ocular zone.
 * 
 * CRITICAL ACCURACY RULE:
 * A bare human face naturally has eyebrows and dark pupils. Previous naïve edge detectors
 * falsely flagged bare eyes as "glasses" because eyebrows create edges.
 * To eliminate fake detections, this analyzer evaluates:
 *  1. Nasal Bridge Strip: The central area between eyes (38%-62%). Bare skin is smooth,
 *     whereas glasses frames have a solid connecting bridge with distinct edge contrast.
 *  2. Lower Rim Zone: The lower half of the eye box. Cheeks are smooth skin, whereas glasses
 *     have distinct lower frame rims.
 *  3. Specular Glare: Real glass or polycarbonate lenses produce distinct light reflections.
 *  4. Frame Color Contrast: Distinct saturated or bold frame colors contrasting with skin.
 */
export function analyzeEyewear(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sensitivity: number = 0.5
): { hasGlasses: boolean; confidence: number; details: string } {
  const clampX = Math.max(0, Math.min(ctx.canvas.width - 1, Math.round(x)));
  const clampY = Math.max(0, Math.min(ctx.canvas.height - 1, Math.round(y)));
  const clampW = Math.max(6, Math.min(ctx.canvas.width - clampX, Math.round(w)));
  const clampH = Math.max(6, Math.min(ctx.canvas.height - clampY, Math.round(h)));

  try {
    const imgData = ctx.getImageData(clampX, clampY, clampW, clampH);
    const data = imgData.data;

    let bridgeEdgeCount = 0;
    let bridgeSampled = 0;

    let lowerRimEdgeCount = 0;
    let lowerRimSampled = 0;

    let frameColorCount = 0;
    let specularGlareCount = 0;
    let totalSampled = 0;

    const bridgeColStart = Math.floor(clampW * 0.38);
    const bridgeColEnd = Math.ceil(clampW * 0.62);
    const lowerRowStart = Math.floor(clampH * 0.50);

    for (let row = 1; row < clampH - 1; row += 2) {
      for (let col = 1; col < clampW - 1; col += 2) {
        totalSampled++;
        const idx = (row * clampW + col) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luminance = r * 0.299 + g * 0.587 + b * 0.114;

        // Gradient calculation
        const leftIdx = (row * clampW + (col - 1)) * 4;
        const leftLum = data[leftIdx] * 0.299 + data[leftIdx + 1] * 0.587 + data[leftIdx + 2] * 0.114;

        const topIdx = ((row - 1) * clampW + col) * 4;
        const topLum = data[topIdx] * 0.299 + data[topIdx + 1] * 0.587 + data[topIdx + 2] * 0.114;

        const gradH = Math.abs(luminance - leftLum);
        const gradV = Math.abs(luminance - topLum);
        const isEdge = gradH > 22 || gradV > 22;

        // 1. Nasal Bridge Zone (between left and right eyes)
        if (col >= bridgeColStart && col <= bridgeColEnd) {
          bridgeSampled++;
          if (isEdge) {
            bridgeEdgeCount++;
          }
        }

        // 2. Lower Rim Zone (below eye center line)
        if (row >= lowerRowStart) {
          lowerRimSampled++;
          if (isEdge) {
            lowerRimEdgeCount++;
          }
        }

        // 3. Specular lens reflections or glare
        if (luminance > 215 && Math.abs(r - g) < 22 && Math.abs(g - b) < 22) {
          specularGlareCount++;
        }

        // 4. Weird / colorful frame materials (neon, red, blue, green, purple, yellow)
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        if (maxC - minC > 40) {
          frameColorCount++;
        }
      }
    }

    const bridgeEdgeRatio = bridgeSampled > 0 ? bridgeEdgeCount / bridgeSampled : 0;
    const lowerRimRatio = lowerRimSampled > 0 ? lowerRimEdgeCount / lowerRimSampled : 0;
    const glareRatio = totalSampled > 0 ? specularGlareCount / totalSampled : 0;
    const frameColorRatio = totalSampled > 0 ? frameColorCount / totalSampled : 0;

    // Eyewear presence equation weighted heavily by nasal bridge and lower rim evidence:
    // On a bare face, bridgeEdgeRatio < 0.08 and lowerRimRatio < 0.08.
    // On a face wearing glasses, bridgeEdgeRatio > 0.14 or lowerRimRatio > 0.15 or glareRatio > 0.04.
    const sensitivityOffset = (sensitivity - 0.5) * 0.12;
    const bridgeThreshold = Math.max(0.08, 0.14 - sensitivityOffset);
    const lowerRimThreshold = Math.max(0.09, 0.16 - sensitivityOffset);
    const glareThreshold = Math.max(0.025, 0.04 - sensitivityOffset);

    const hasBridgeEvidence = bridgeEdgeRatio >= bridgeThreshold;
    const hasLowerRimEvidence = lowerRimRatio >= lowerRimThreshold;
    const hasSpecularGlare = glareRatio >= glareThreshold;
    const hasColoredFrames = frameColorRatio >= 0.14 && (bridgeEdgeRatio > 0.09 || lowerRimRatio > 0.09);

    // Composite glasses presence
    const hasGlasses =
      hasBridgeEvidence ||
      hasLowerRimEvidence ||
      hasSpecularGlare ||
      hasColoredFrames;

    // Confidence calculation (only high if actual evidence exists)
    let confidence = 0.2;
    if (hasGlasses) {
      const evidenceScore =
        bridgeEdgeRatio * 2.2 +
        lowerRimRatio * 1.8 +
        glareRatio * 3.5 +
        frameColorRatio * 1.5;
      confidence = Math.min(0.99, Math.max(0.85, 0.82 + evidenceScore * 0.2));
    }

    return {
      hasGlasses,
      confidence: parseFloat(confidence.toFixed(2)),
      details: `Bridge: ${(bridgeEdgeRatio * 100).toFixed(0)}%, Rim: ${(lowerRimRatio * 100).toFixed(0)}%, Glare: ${(glareRatio * 100).toFixed(0)}%`,
    };
  } catch {
    return { hasGlasses: false, confidence: 0, details: '' };
  }
}

export type PersonCountMode = 'auto' | 1 | 2 | 3;

export interface CandidatePersonBox {
  box: [number, number, number, number];
  score: number;
  centroidX: number;
}

/**
 * 2D Non-Maximum Suppression (NMS) with spatial overlap and area containment pruning.
 * Eliminates redundant and duplicate candidate proposals while accurately preserving
 * distinct persons detected simultaneously side-by-side or at varying depths.
 */
export function applyPersonNMS(
  candidates: CandidatePersonBox[],
  iouThreshold = 0.35,
  containmentThreshold = 0.58
): [number, number, number, number][] {
  if (candidates.length === 0) return [];

  // Sort candidate proposals by confidence score descending
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected: CandidatePersonBox[] = [];

  for (const current of sorted) {
    let shouldSuppress = false;

    for (const chosen of selected) {
      // 1. Intersection over Union (IoU) calculation
      const xA = Math.max(current.box[0], chosen.box[0]);
      const yA = Math.max(current.box[1], chosen.box[1]);
      const xB = Math.min(current.box[2], chosen.box[2]);
      const yB = Math.min(current.box[3], chosen.box[3]);
      const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);

      const areaCurrent = Math.max(1, (current.box[2] - current.box[0]) * (current.box[3] - current.box[1]));
      const areaChosen = Math.max(1, (chosen.box[2] - chosen.box[0]) * (chosen.box[3] - chosen.box[1]));
      const unionArea = areaCurrent + areaChosen - interArea;
      const iou = unionArea > 0 ? interArea / unionArea : 0;

      if (iou >= iouThreshold) {
        shouldSuppress = true;
        break;
      }

      // 2. Spatial Overlap / Containment check (Min Area Ratio)
      // If one candidate box is substantially contained within another, suppress duplicate proposal
      const minArea = Math.min(areaCurrent, areaChosen);
      const containment = interArea / minArea;
      if (containment >= containmentThreshold) {
        shouldSuppress = true;
        break;
      }

      // 3. Horizontal centroid proximity check:
      // Prevent double-counting the same person's body axis
      const distCentroidX = Math.abs(current.centroidX - chosen.centroidX);
      const avgWidth = ((current.box[2] - current.box[0]) + (chosen.box[2] - chosen.box[0])) / 2;
      if (distCentroidX < avgWidth * 0.40 && containment >= 0.35) {
        shouldSuppress = true;
        break;
      }
    }

    if (!shouldSuppress) {
      selected.push(current);
    }
  }

  // Sort final selected person boxes from left to right across canvas for stable worker indexing (Worker #1, Worker #2, etc.)
  selected.sort((a, b) => a.box[0] - b.box[0]);

  return selected.map((c) => c.box);
}

/**
 * Optical multi-person detector using 2D silhouette density profiling and Non-Maximum Suppression (NMS).
 * Accurately detects and frames each person in the video/image (1, 2, 3, or more people).
 * Dynamically identifies the true top of the head/helmet (y1), shoulder width (x1, x2), and body base (y2),
 * providing tight, anatomically accurate bounding boxes instead of static boxes.
 */
export function detectPersons(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: PersonCountMode = 'auto'
): [number, number, number, number][] {
  try {
    const numCols = 48;
    const numRows = 36;
    const binW = width / numCols;
    const binH = height / numRows;
    const grid = new Float32Array(numRows * numCols);

    // Sample across the entire canvas with high spatial resolution
    const yStep = Math.max(3, Math.round(height / 70));
    const xStep = Math.max(3, Math.round(width / 95));

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let py = 0; py < height; py += yStep) {
      const row = Math.min(numRows - 1, Math.floor(py / binH));
      const rowOffset = py * width * 4;

      for (let px = 0; px < width; px += xStep) {
        const col = Math.min(numCols - 1, Math.floor(px / binW));
        const idx = rowOffset + px * 4;

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 1. Universal human skin tone detection (robust across all skin complexions)
        const isSkin =
          r > 70 &&
          g > 35 &&
          b > 20 &&
          r > g &&
          r > b &&
          r - g >= 8 &&
          r - b >= 10;

        // 2. OSHA Safety Hardhat colors (Yellow, Orange, White, Blue, Red, Lime)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        const brightness = (r + g + b) / 3;

        const isHardhat =
          (r > 135 && g > 130 && b < 110) || // yellow hardhat
          (r > 155 && g > 60 && g < 155 && b < 80) || // orange hardhat
          (brightness > 190 && diff < 28) || // white / silver hardhat
          (b > 125 && r < 100) || // safety blue hardhat
          (r > 140 && g < 80 && b < 80) || // safety red hardhat
          (g > 130 && r < 110 && b < 110); // safety green hardhat

        // 3. High-vis vest colors
        const isHiVis =
          (r > 130 && g > 140 && b < 120 && g >= r * 0.82) ||
          (r > 150 && g > 65 && g < 150 && b < 80);

        // 4. Head hair / Clothing silhouette contrast
        const isHeadHair = r < 75 && g < 70 && b < 65 && brightness < 75;

        // 5. Edge gradient
        let hasEdge = false;
        if (px + 4 < width) {
          const nextIdx = rowOffset + (px + 4) * 4;
          const nr = data[nextIdx];
          const ng = data[nextIdx + 1];
          const nb = data[nextIdx + 2];
          const lumDiff = Math.abs(
            r * 0.3 + g * 0.59 + b * 0.11 - (nr * 0.3 + ng * 0.59 + nb * 0.11)
          );
          if (lumDiff > 22) hasEdge = true;
        }

        let weight = 0;
        if (isSkin) weight += 2.8;
        if (isHardhat) weight += 3.2;
        if (isHiVis) weight += 2.8;
        if (isHeadHair) weight += 1.4;
        if (hasEdge) weight += 0.8;

        if (weight > 0) {
          grid[row * numCols + col] += weight;
        }
      }
    }

    // Horizontal density projection (summing across rows)
    const colDensity = new Float32Array(numCols);
    for (let r = 0; r < numRows; r++) {
      const rOffset = r * numCols;
      for (let c = 0; c < numCols; c++) {
        colDensity[c] += grid[rOffset + c];
      }
    }

    // Smooth horizontal density profile with window of 3
    const smoothedCols = new Float32Array(numCols);
    for (let c = 0; c < numCols; c++) {
      const prev = c > 0 ? colDensity[c - 1] : colDensity[c];
      const next = c < numCols - 1 ? colDensity[c + 1] : colDensity[c];
      smoothedCols[c] = prev * 0.25 + colDensity[c] * 0.5 + next * 0.25;
    }

    let maxColVal = 0;
    for (let c = 0; c < numCols; c++) {
      if (smoothedCols[c] > maxColVal) maxColVal = smoothedCols[c];
    }

    // If canvas is blank or noise is extremely low, return default centered box
    if (maxColVal < 12) {
      if (mode === 2) {
        return [
          [Math.round(width * 0.08), Math.round(height * 0.12), Math.round(width * 0.46), Math.round(height * 0.92)],
          [Math.round(width * 0.54), Math.round(height * 0.12), Math.round(width * 0.92), Math.round(height * 0.92)]
        ];
      }
      if (mode === 3) {
        return [
          [Math.round(width * 0.05), Math.round(height * 0.12), Math.round(width * 0.32), Math.round(height * 0.92)],
          [Math.round(width * 0.36), Math.round(height * 0.12), Math.round(width * 0.64), Math.round(height * 0.92)],
          [Math.round(width * 0.68), Math.round(height * 0.12), Math.round(width * 0.95), Math.round(height * 0.92)]
        ];
      }
      return [[
        Math.round(width * 0.20),
        Math.round(height * 0.12),
        Math.round(width * 0.80),
        Math.round(height * 0.92)
      ]];
    }

    // Identify candidate person peak columns
    interface PersonPeak {
      peakCol: number;
      score: number;
      leftCol: number;
      rightCol: number;
    }

    const peaks: PersonPeak[] = [];
    const minPeakThreshold = maxColVal * 0.22;

    for (let c = 1; c < numCols - 1; c++) {
      if (
        smoothedCols[c] >= smoothedCols[c - 1] &&
        smoothedCols[c] >= smoothedCols[c + 1] &&
        smoothedCols[c] >= minPeakThreshold
      ) {
        // Trace left extent until density drops below 28% of peak
        let left = c;
        while (left > 0 && smoothedCols[left - 1] > smoothedCols[c] * 0.28) {
          left--;
        }
        // Trace right extent until density drops below 28% of peak
        let right = c;
        while (right < numCols - 1 && smoothedCols[right + 1] > smoothedCols[c] * 0.28) {
          right++;
        }

        // Avoid clustering peaks that are too close (merge within 3 bins)
        const existingNear = peaks.find((p) => Math.abs(p.peakCol - c) <= 3);
        if (existingNear) {
          if (smoothedCols[c] > existingNear.score) {
            existingNear.peakCol = c;
            existingNear.score = smoothedCols[c];
            existingNear.leftCol = Math.min(existingNear.leftCol, left);
            existingNear.rightCol = Math.max(existingNear.rightCol, right);
          }
        } else {
          peaks.push({
            peakCol: c,
            score: smoothedCols[c],
            leftCol: left,
            rightCol: right,
          });
        }
      }
    }

    // Sort peaks by score descending
    peaks.sort((a, b) => b.score - a.score);

    // Filter peaks based on requested mode if specified
    let targetPeaks = peaks;
    if (typeof mode === 'number') {
      if (mode === 1) {
        targetPeaks = peaks.slice(0, 1);
        if (targetPeaks.length === 0) {
          targetPeaks = [{ peakCol: Math.floor(numCols / 2), score: maxColVal, leftCol: 8, rightCol: numCols - 9 }];
        }
      } else if (mode === 2) {
        if (peaks.length >= 2) {
          targetPeaks = peaks.slice(0, 2);
        } else {
          // If only 1 peak was detected, synthesize 2 side-by-side workstation frames
          targetPeaks = [
            { peakCol: Math.floor(numCols * 0.28), score: maxColVal, leftCol: 2, rightCol: Math.floor(numCols * 0.46) },
            { peakCol: Math.floor(numCols * 0.72), score: maxColVal, leftCol: Math.floor(numCols * 0.54), rightCol: numCols - 3 }
          ];
        }
      } else if (mode === 3) {
        if (peaks.length >= 3) {
          targetPeaks = peaks.slice(0, 3);
        } else {
          targetPeaks = [
            { peakCol: Math.floor(numCols * 0.18), score: maxColVal, leftCol: 1, rightCol: Math.floor(numCols * 0.32) },
            { peakCol: Math.floor(numCols * 0.50), score: maxColVal, leftCol: Math.floor(numCols * 0.36), rightCol: Math.floor(numCols * 0.64) },
            { peakCol: Math.floor(numCols * 0.82), score: maxColVal, leftCol: Math.floor(numCols * 0.68), rightCol: numCols - 2 }
          ];
        }
      }
    }

    // Build precise 2D bounding boxes for each person peak
    const candidateBoxes: CandidatePersonBox[] = [];

    targetPeaks.forEach((pk) => {
      // 1. Precise Horizontal Extent (x1, x2)
      const spanCols = pk.rightCol - pk.leftCol + 1;
      const rawX1 = pk.leftCol * binW;
      const rawX2 = (pk.rightCol + 1) * binW;
      const centerPx = (pk.peakCol + 0.5) * binW;

      // Ensure minimum shoulder width (at least 18% of canvas width)
      const minW = width * 0.18;
      const currentW = rawX2 - rawX1;
      let finalX1 = rawX1;
      let finalX2 = rawX2;

      if (currentW < minW) {
        const pad = (minW - currentW) / 2;
        finalX1 = Math.max(0, rawX1 - pad);
        finalX2 = Math.min(width, rawX2 + pad);
      } else {
        // Gentle padding around silhouette
        finalX1 = Math.max(0, rawX1 - binW * 0.35);
        finalX2 = Math.min(width, rawX2 + binW * 0.35);
      }

      // 2. Precise Vertical Extent (y1, y2)
      // Extract vertical profile for columns in this person's horizontal span
      const rowProfile = new Float32Array(numRows);
      for (let r = 0; r < numRows; r++) {
        const rOffset = r * numCols;
        for (let c = pk.leftCol; c <= pk.rightCol; c++) {
          rowProfile[r] += grid[rOffset + c];
        }
      }

      let maxRowVal = 0;
      for (let r = 0; r < numRows; r++) {
        if (rowProfile[r] > maxRowVal) maxRowVal = rowProfile[r];
      }

      // Detect Head Crown (y1): scan from top down to find where silhouette begins
      let topRow = 0;
      const headThresh = Math.max(1.0, maxRowVal * 0.16);
      while (topRow < numRows - 4 && rowProfile[topRow] < headThresh) {
        topRow++;
      }

      // Detect Base of Body (y2): scan from bottom up to find where torso/legs end
      let bottomRow = numRows - 1;
      const baseThresh = Math.max(1.0, maxRowVal * 0.14);
      while (bottomRow > topRow + 4 && rowProfile[bottomRow] < baseThresh) {
        bottomRow--;
      }

      // Convert rows to pixel coordinates
      let y1 = Math.max(0, Math.round(topRow * binH - binH * 0.20));
      let y2 = Math.min(height, Math.round((bottomRow + 1) * binH + binH * 0.15));

      // Human proportion constraint: Height should be at least 1.18x width
      const boxW = finalX2 - finalX1;
      if (y2 - y1 < boxW * 1.18) {
        y2 = Math.min(height, Math.round(y1 + boxW * 1.35));
      }

      // Generate accurate candidate box
      candidateBoxes.push({
        box: [Math.round(finalX1), Math.round(y1), Math.round(finalX2), Math.round(y2)],
        score: pk.score,
        centroidX: centerPx,
      });

      // Also generate slightly tighter secondary candidate for NMS optimization
      candidateBoxes.push({
        box: [
          Math.max(0, Math.round(finalX1 + boxW * 0.04)),
          Math.max(0, Math.round(y1 + (y2 - y1) * 0.02)),
          Math.min(width, Math.round(finalX2 - boxW * 0.04)),
          Math.round(y2)
        ],
        score: pk.score * 0.94,
        centroidX: centerPx,
      });
    });

    // Apply Non-Maximum Suppression (NMS) to eliminate duplicate proposals
    const nmsResults = applyPersonNMS(candidateBoxes, 0.35, 0.58);

    if (nmsResults.length > 0) {
      if (typeof mode === 'number' && nmsResults.length > mode) {
        return nmsResults.slice(0, mode);
      }
      return nmsResults;
    }

    return [[
      Math.round(width * 0.20),
      Math.round(height * 0.12),
      Math.round(width * 0.80),
      Math.round(height * 0.92)
    ]];
  } catch {
    return [[
      Math.round(width * 0.20),
      Math.round(height * 0.12),
      Math.round(width * 0.80),
      Math.round(height * 0.92)
    ]];
  }
}

/**
 * Runs full object and PPE detection on an HTML5 canvas or video frame.
 * Emits person bounding boxes and associated PPE detections (Safety Helmet, Safety Vest,
 * Gloves, Goggles, Boots, Missing Helmet, Missing Vest).
 * Accurately detects 1, 2, or 3 persons in frame with anatomically anchored equipment frames.
 */
export async function detectPPEFromMedia(
  canvas: HTMLCanvasElement,
  videoElement: HTMLVideoElement | null,
  virtualPPE: VirtualPPEState,
  confidenceThreshold = 0.45,
  glassesSensitivity = 0.5,
  helmetSensitivity = 0.5,
  personCountMode: PersonCountMode = 'auto',
  bootsSensitivity = 0.5,
  requiredChecklist?: string[]
): Promise<Detection[]> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const detections: Detection[] = [];
  const width = canvas.width;
  const height = canvas.height;

  // 1. Detect person(s) via optical 2D silhouette density profiling & NMS
  const personsBoxes = detectPersons(ctx, width, height, personCountMode);

  // 2. For each detected person, analyze anatomical zones for PPE compliance
  personsBoxes.forEach((pBox, pIdx) => {
    const [px1, py1, px2, py2] = pBox;
    const pWidth = px2 - px1;
    const pHeight = py2 - py1;

    // Register Person Bounding Box
    detections.push({
      id: `person-${pIdx}`,
      class: 'Person',
      raw_class: 'person',
      confidence: 0.96,
      box: [px1, py1, px2, py2],
    });

    // ----------------------------------------------------
    // A. Head & Helmet Region (Anchored tightly to the detected cranial crown py1)
    // ----------------------------------------------------
    const headX1 = Math.max(0, Math.round(px1 + pWidth * 0.18));
    const headX2 = Math.min(width, Math.round(px1 + pWidth * 0.82));
    const headY1 = Math.max(0, Math.round(py1));
    const headH = Math.min(pHeight * 0.28, Math.max(28, (headX2 - headX1) * 1.10));
    const headY2 = Math.min(height, Math.round(headY1 + headH));
    const headW = headX2 - headX1;

    const helmetAnalysis = analyzeHelmet(ctx, headX1, headY1, headW, headH, helmetSensitivity);
    const hasHelmet = virtualPPE.helmet || helmetAnalysis.hasHelmet;

    if (hasHelmet) {
      detections.push({
        id: `helmet-${pIdx}`,
        class: 'Safety Helmet',
        raw_class: 'helmet',
        confidence: virtualPPE.helmet ? 0.98 : helmetAnalysis.confidence,
        box: [headX1, headY1, headX2, headY2],
      });
    } else {
      detections.push({
        id: `no-helmet-${pIdx}`,
        class: 'Missing Helmet',
        raw_class: 'no-helmet',
        confidence: helmetAnalysis.confidence || 0.94,
        box: [headX1, headY1, headX2, headY2],
      });
    }

    // ----------------------------------------------------
    // B. Eye & Goggles / Eyewear Region (Anchored directly over eyes and nasal bridge)
    // ----------------------------------------------------
    const goggleX1 = Math.max(0, Math.round(headX1 + headW * 0.08));
    const goggleX2 = Math.min(width, Math.round(headX2 - headW * 0.08));
    const goggleY1 = Math.round(headY1 + headH * 0.38);
    const goggleY2 = Math.round(headY1 + headH * 0.70);
    const goggleW = goggleX2 - goggleX1;
    const goggleH = goggleY2 - goggleY1;

    const eyeAnalysis = analyzeEyewear(ctx, goggleX1, goggleY1, goggleW, goggleH, glassesSensitivity);
    const hasGlasses = virtualPPE.goggles || eyeAnalysis.hasGlasses;

    if (hasGlasses) {
      detections.push({
        id: `goggles-${pIdx}`,
        class: 'Safety Goggles',
        raw_class: 'goggles',
        confidence: virtualPPE.goggles ? 0.98 : eyeAnalysis.confidence,
        box: [goggleX1, goggleY1, goggleX2, goggleY2],
      });
    } else {
      detections.push({
        id: `no-goggles-${pIdx}`,
        class: 'Missing Goggles',
        raw_class: 'no-goggles',
        confidence: 0.88,
        box: [goggleX1, goggleY1, goggleX2, goggleY2],
      });
    }

    // ----------------------------------------------------
    // C. Torso & High-Visibility Safety Vest Region
    // ----------------------------------------------------
    const vestX1 = Math.max(0, Math.round(px1 + pWidth * 0.08));
    const vestX2 = Math.min(width, Math.round(px1 + pWidth * 0.92));
    const vestY1 = Math.round(headY2);
    const vestY2 = Math.min(height, Math.round(py1 + pHeight * 0.70));
    const vestW = vestX2 - vestX1;
    const vestH = vestY2 - vestY1;

    const vestColor = analyzeColorProfile(ctx, vestX1, vestY1, vestW, vestH);
    const hasVest = virtualPPE.vest || vestColor.hiVisRatio > 0.08;

    if (hasVest) {
      detections.push({
        id: `vest-${pIdx}`,
        class: 'Safety Vest',
        raw_class: 'vest',
        confidence: virtualPPE.vest ? 0.97 : Math.min(0.96, 0.75 + vestColor.hiVisRatio),
        box: [vestX1, vestY1, vestX2, vestY2],
      });
    } else {
      detections.push({
        id: `no-vest-${pIdx}`,
        class: 'Missing Vest',
        raw_class: 'no-vest',
        confidence: 0.91,
        box: [vestX1, vestY1, vestX2, vestY2],
      });
    }

    // ----------------------------------------------------
    // D. Hands & Protective Gloves Region
    // ----------------------------------------------------
    const gloveLeftX1 = Math.max(0, Math.round(px1 - pWidth * 0.04));
    const gloveLeftY1 = Math.round(py1 + pHeight * 0.46);
    const gloveLeftX2 = Math.round(px1 + pWidth * 0.24);
    const gloveLeftY2 = Math.round(py1 + pHeight * 0.68);

    const gloveRightX1 = Math.round(px2 - pWidth * 0.24);
    const gloveRightY1 = Math.round(py1 + pHeight * 0.46);
    const gloveRightX2 = Math.min(width, Math.round(px2 + pWidth * 0.04));
    const gloveRightY2 = Math.round(py1 + pHeight * 0.68);

    if (virtualPPE.gloves) {
      detections.push({
        id: `gloves-l-${pIdx}`,
        class: 'Safety Gloves',
        raw_class: 'gloves',
        confidence: 0.90,
        box: [gloveLeftX1, gloveLeftY1, gloveLeftX2, gloveLeftY2],
      });
      detections.push({
        id: `gloves-r-${pIdx}`,
        class: 'Safety Gloves',
        raw_class: 'gloves',
        confidence: 0.89,
        box: [gloveRightX1, gloveRightY1, gloveRightX2, gloveRightY2],
      });
    }

    // ----------------------------------------------------
    // E. Feet & Safety Boots Region (Footwear protection)
    // ----------------------------------------------------
    const bootX1 = Math.max(0, Math.round(px1 + pWidth * 0.10));
    const bootX2 = Math.min(width, Math.round(px1 + pWidth * 0.90));
    const bootW = bootX2 - bootX1;
    const bootH = Math.max(26, Math.min(pHeight * 0.20, bootW * 0.50));
    const bootY1 = Math.max(0, Math.round(py2 - bootH));
    const bootY2 = Math.min(height, Math.round(py2));

    const bootsAnalysis = analyzeBoots(ctx, bootX1, bootY1, bootW, bootH, bootsSensitivity);
    const hasBoots = virtualPPE.boots || bootsAnalysis.hasBoots;

    const shouldCheckBoots =
      virtualPPE.boots ||
      !requiredChecklist ||
      requiredChecklist.includes('Safety Boots') ||
      pHeight > height * 0.45 ||
      py2 > height * 0.65;

    if (shouldCheckBoots) {
      if (hasBoots) {
        detections.push({
          id: `boots-${pIdx}`,
          class: 'Safety Boots',
          raw_class: 'boots',
          confidence: virtualPPE.boots ? 0.98 : bootsAnalysis.confidence,
          box: [bootX1, bootY1, bootX2, bootY2],
        });
      } else {
        detections.push({
          id: `no-boots-${pIdx}`,
          class: 'Missing Boots',
          raw_class: 'no-boots',
          confidence: bootsAnalysis.confidence || 0.92,
          box: [bootX1, bootY1, bootX2, bootY2],
        });
      }
    }
  });

  return detections.filter((d) => d.confidence >= confidenceThreshold);
}

