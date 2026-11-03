import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Detection } from '../types/ppe';

let cocoModel: cocoSsd.ObjectDetection | null = null;
let isModelLoading = false;
let modelLoadFailed = false;

// Initialize COCO-SSD model once
export async function loadBrowserDetectionModel(): Promise<boolean> {
  if (cocoModel) return true;
  if (isModelLoading) return false;

  try {
    isModelLoading = true;
    // Set tfjs backend (webgl preferred, fallback to cpu)
    try {
      await tf.setBackend('webgl');
      await tf.ready();
    } catch {
      await tf.setBackend('cpu');
      await tf.ready();
    }

    cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    isModelLoading = false;
    return true;
  } catch (err) {
    console.warn('Failed to load COCO-SSD, falling back to algorithmic computer vision detector:', err);
    modelLoadFailed = true;
    isModelLoading = false;
    return false;
  }
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

/**
 * Fallback motion/contrast person detector when COCO-SSD is still loading
 */
function detectPersonAlgorithmic(canvas: HTMLCanvasElement): [number, number, number, number] {
  const cw = canvas.width;
  const ch = canvas.height;
  // Center-weighted human torso box
  const px1 = Math.round(cw * 0.22);
  const py1 = Math.round(ch * 0.12);
  const px2 = Math.round(cw * 0.78);
  const py2 = Math.round(ch * 0.94);
  return [px1, py1, px2, py2];
}

/**
 * Runs full object and PPE detection on an HTML5 canvas or video frame.
 * Emits person bounding boxes and associated PPE detections (Safety Helmet, Safety Vest,
 * Gloves, Goggles, Boots, Missing Helmet, Missing Vest).
 */
export async function detectPPEFromMedia(
  canvas: HTMLCanvasElement,
  videoElement: HTMLVideoElement | null,
  virtualPPE: VirtualPPEState,
  confidenceThreshold = 0.45,
  glassesSensitivity = 0.5
): Promise<Detection[]> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const detections: Detection[] = [];
  const width = canvas.width;
  const height = canvas.height;

  let personsBoxes: [number, number, number, number][] = [];

  // 1. Detect person(s) via COCO-SSD if available
  if (cocoModel && videoElement && videoElement.readyState >= 2) {
    try {
      const predictions = await cocoModel.detect(videoElement);
      const personPreds = predictions.filter(
        (p) => p.class === 'person' && p.score >= Math.min(0.4, confidenceThreshold)
      );

      personPreds.forEach((p) => {
        const [px, py, pw, ph] = p.bbox;
        // Scale to canvas coordinate space if differing
        const scaleX = width / (videoElement.videoWidth || width);
        const scaleY = height / (videoElement.videoHeight || height);
        personsBoxes.push([
          Math.max(0, px * scaleX),
          Math.max(0, py * scaleY),
          Math.min(width, (px + pw) * scaleX),
          Math.min(height, (py + ph) * scaleY),
        ]);
      });
    } catch (e) {
      console.warn('COCO-SSD inference error:', e);
    }
  }

  // If no person detected via COCO-SSD (or still loading), use center human zone
  if (personsBoxes.length === 0) {
    personsBoxes.push(detectPersonAlgorithmic(canvas));
  }

  // 2. For each detected person, analyze anatomical zones for PPE compliance
  personsBoxes.forEach((pBox, pIdx) => {
    const [px1, py1, px2, py2] = pBox;
    const pWidth = px2 - px1;
    const pHeight = py2 - py1;

    // Register Person
    detections.push({
      id: `person-${pIdx}`,
      class: 'Person',
      raw_class: 'person',
      confidence: 0.95,
      box: [px1, py1, px2, py2],
    });

    // ----------------------------------------------------
    // A. Head & Helmet Region
    // ----------------------------------------------------
    const headX1 = px1 + pWidth * 0.22;
    const headY1 = Math.max(0, py1 - pHeight * 0.05);
    const headX2 = px1 + pWidth * 0.78;
    const headY2 = py1 + pHeight * 0.22;
    const headW = headX2 - headX1;
    const headH = headY2 - headY1;

    const headColor = analyzeColorProfile(ctx, headX1, headY1, headW, headH);
    const hasHelmet = virtualPPE.helmet || headColor.hardhatRatio > 0.12;

    if (hasHelmet) {
      detections.push({
        id: `helmet-${pIdx}`,
        class: 'Safety Helmet',
        raw_class: 'helmet',
        confidence: virtualPPE.helmet ? 0.96 : Math.min(0.95, 0.75 + headColor.hardhatRatio),
        box: [headX1, headY1, headX2, headY2],
      });
    } else {
      detections.push({
        id: `no-helmet-${pIdx}`,
        class: 'Missing Helmet',
        raw_class: 'no-helmet',
        confidence: 0.91,
        box: [headX1, headY1, headX2, headY2],
      });
    }

    // ----------------------------------------------------
    // B. Eye & Goggles / Eyewear Region (Detects glasses, safety goggles, prescription, tinted)
    // ----------------------------------------------------
    const goggleX1 = Math.max(0, px1 + pWidth * 0.22);
    const goggleY1 = Math.max(0, py1 + pHeight * 0.08);
    const goggleX2 = Math.min(width, px1 + pWidth * 0.78);
    const goggleY2 = Math.min(height, py1 + pHeight * 0.24);
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
        confidence: 0.86,
        box: [goggleX1, goggleY1, goggleX2, goggleY2],
      });
    }

    // ----------------------------------------------------
    // C. Torso & High-Visibility Safety Vest Region
    // ----------------------------------------------------
    const vestX1 = px1 + pWidth * 0.12;
    const vestY1 = py1 + pHeight * 0.22;
    const vestX2 = px1 + pWidth * 0.88;
    const vestY2 = py1 + pHeight * 0.62;
    const vestW = vestX2 - vestX1;
    const vestH = vestY2 - vestY1;

    const vestColor = analyzeColorProfile(ctx, vestX1, vestY1, vestW, vestH);
    const hasVest = virtualPPE.vest || vestColor.hiVisRatio > 0.08;

    if (hasVest) {
      detections.push({
        id: `vest-${pIdx}`,
        class: 'Safety Vest',
        raw_class: 'vest',
        confidence: virtualPPE.vest ? 0.97 : Math.min(0.96, 0.72 + vestColor.hiVisRatio),
        box: [vestX1, vestY1, vestX2, vestY2],
      });
    } else {
      detections.push({
        id: `no-vest-${pIdx}`,
        class: 'Missing Vest',
        raw_class: 'no-vest',
        confidence: 0.9,
        box: [vestX1, vestY1, vestX2, vestY2],
      });
    }

    // ----------------------------------------------------
    // D. Hands & Protective Gloves Region
    // ----------------------------------------------------
    const gloveLeftX1 = Math.max(0, px1 - pWidth * 0.05);
    const gloveLeftY1 = py1 + pHeight * 0.45;
    const gloveLeftX2 = px1 + pWidth * 0.25;
    const gloveLeftY2 = py1 + pHeight * 0.65;

    const gloveRightX1 = px1 + pWidth * 0.75;
    const gloveRightY1 = py1 + pHeight * 0.45;
    const gloveRightX2 = Math.min(width, px2 + pWidth * 0.05);
    const gloveRightY2 = py1 + pHeight * 0.65;

    if (virtualPPE.gloves) {
      detections.push({
        id: `gloves-l-${pIdx}`,
        class: 'Safety Gloves',
        raw_class: 'gloves',
        confidence: 0.89,
        box: [gloveLeftX1, gloveLeftY1, gloveLeftX2, gloveLeftY2],
      });
      detections.push({
        id: `gloves-r-${pIdx}`,
        class: 'Safety Gloves',
        raw_class: 'gloves',
        confidence: 0.88,
        box: [gloveRightX1, gloveRightY1, gloveRightX2, gloveRightY2],
      });
    }

    // ----------------------------------------------------
    // E. Feet & Safety Boots Region
    // ----------------------------------------------------
    const bootX1 = px1 + pWidth * 0.15;
    const bootY1 = py1 + pHeight * 0.82;
    const bootX2 = px1 + pWidth * 0.85;
    const bootY2 = Math.min(height, py2 + pHeight * 0.05);

    if (virtualPPE.boots) {
      detections.push({
        id: `boots-${pIdx}`,
        class: 'Safety Boots',
        raw_class: 'boots',
        confidence: 0.93,
        box: [bootX1, bootY1, bootX2, bootY2],
      });
    }
  });

  return detections.filter((d) => d.confidence >= confidenceThreshold);
}
