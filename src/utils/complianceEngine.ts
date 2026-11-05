import { Detection, ComplianceResult, WorkerEvaluation } from '../types/ppe';

export const DEFAULT_REQUIRED_PPE: string[] = [
  'Safety Helmet',
  'Safety Vest',
  'Safety Gloves',
  'Safety Goggles',
  'Safety Boots',
];

export const PPE_CLASS_MAPPING: Record<string, string> = {
  'helmet': 'Safety Helmet',
  'hard-hat': 'Safety Helmet',
  'hard_hat': 'Safety Helmet',
  'safety-helmet': 'Safety Helmet',
  'vest': 'Safety Vest',
  'safety-vest': 'Safety Vest',
  'reflective-vest': 'Safety Vest',
  'gloves': 'Safety Gloves',
  'safety-gloves': 'Safety Gloves',
  'goggles': 'Safety Goggles',
  'safety-goggles': 'Safety Goggles',
  'glasses': 'Safety Goggles',
  'safety-glasses': 'Safety Goggles',
  'eyewear': 'Safety Goggles',
  'spectacles': 'Safety Goggles',
  'sunglasses': 'Safety Goggles',
  'weird-glasses': 'Safety Goggles',
  'eye-protection': 'Safety Goggles',
  'boots': 'Safety Boots',
  'safety-boots': 'Safety Boots',
  'safety_boots': 'Safety Boots',
  'work-boots': 'Safety Boots',
  'work_boots': 'Safety Boots',
  'steel-toe-boots': 'Safety Boots',
  'steel_toe_boots': 'Safety Boots',
  'shoes': 'Safety Boots',
  'safety-shoes': 'Safety Boots',
  'person': 'Person',
  'worker': 'Person',
  'no-helmet': 'Missing Helmet',
  'missing-helmet': 'Missing Helmet',
  'no-vest': 'Missing Vest',
  'missing-vest': 'Missing Vest',
  'no-gloves': 'Missing Gloves',
  'missing-gloves': 'Missing Gloves',
  'no-goggles': 'Missing Goggles',
  'missing-goggles': 'Missing Goggles',
  'no-boots': 'Missing Boots',
  'missing-boots': 'Missing Boots',
  'missing_boots': 'Missing Boots',
};

/**
 * Multiple class synonyms mapped per mandatory PPE category
 * Allows 'glasses', 'safety-glasses', 'goggles', etc. to fulfill 'Safety Goggles'
 */
export const PPE_SYNONYMS: Record<string, string[]> = {
  'Safety Goggles': [
    'Safety Goggles',
    'goggles',
    'glasses',
    'safety-glasses',
    'safety_glasses',
    'safety-goggles',
    'safety_goggles',
    'spectacles',
    'eyewear',
    'sunglasses',
    'eye-protection',
    'eye_protection',
    'protective-glasses',
    'weird-glasses',
  ],
  'Safety Helmet': [
    'Safety Helmet',
    'helmet',
    'hard-hat',
    'hard_hat',
    'safety-helmet',
    'hardhat',
    'cap',
  ],
  'Safety Vest': [
    'Safety Vest',
    'vest',
    'safety-vest',
    'reflective-vest',
    'hi-vis-vest',
  ],
  'Safety Gloves': [
    'Safety Gloves',
    'gloves',
    'safety-gloves',
    'work-gloves',
  ],
  'Safety Boots': [
    'Safety Boots',
    'boots',
    'safety-boots',
    'safety_boots',
    'work-boots',
    'work_boots',
    'steel-toe-boots',
    'steel_toe_boots',
    'shoes',
    'safety-shoes',
    'footwear',
  ],
};

/**
 * Checks whether a required PPE category (e.g. 'Safety Goggles') is satisfied
 * by any of the detected item class names or raw class synonyms (e.g. 'glasses', 'safety-glasses', 'goggles').
 */
export function isRequirementSatisfied(
  requirement: string,
  detectedClasses: string[],
  rawClasses?: string[]
): boolean {
  const synonyms = (PPE_SYNONYMS[requirement] || [requirement]).map((s) =>
    s.toLowerCase().replace(/[_\s]/g, '-')
  );

  for (const item of detectedClasses) {
    const norm = item.toLowerCase().replace(/[_\s]/g, '-');
    if (synonyms.includes(norm) || standardizeClassName(item) === requirement) {
      return true;
    }
  }

  if (rawClasses) {
    for (const raw of rawClasses) {
      const norm = raw.toLowerCase().replace(/[_\s]/g, '-');
      if (synonyms.includes(norm) || standardizeClassName(raw) === requirement) {
        return true;
      }
    }
  }

  return false;
}

export const CLASS_COLORS: Record<string, string> = {
  'Safety Helmet': '#10B981',    // Emerald
  'Safety Vest': '#F59E0B',      // Amber
  'Safety Gloves': '#06B6D4',    // Cyan
  'Safety Goggles': '#8B5CF6',   // Purple
  'Safety Boots': '#3B82F6',     // Blue
  'Person': '#FFFFFF',           // White
  'Missing Helmet': '#EF4444',   // Red
  'Missing Vest': '#EF4444',
  'Missing Gloves': '#EF4444',
  'Missing Goggles': '#EF4444',
  'Missing Boots': '#EF4444',
};

/**
 * Computes IoU (Intersection over Union) of two bounding boxes [x1, y1, x2, y2].
 */
export function calculateIoU(boxA: [number, number, number, number], boxB: [number, number, number, number]): number {
  const xA = Math.max(boxA[0], boxB[0]);
  const yA = Math.max(boxA[1], boxB[1]);
  const xB = Math.min(boxA[2], boxB[2]);
  const yB = Math.min(boxA[3], boxB[3]);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const boxAArea = Math.max(0, boxA[2] - boxA[0]) * Math.max(0, boxA[3] - boxA[1]);
  const boxBArea = Math.max(0, boxB[2] - boxB[0]) * Math.max(0, boxB[3] - boxB[1]);

  const unionArea = boxAArea + boxBArea - interArea;
  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

/**
 * Computes spatial overlap and affinity score between an item bounding box and a person bounding box.
 * Returns a score from 0 (no relation) to > 1.0 (strong spatial and anatomical association).
 */
export function calculateSpatialAffinity(
  itemBox: [number, number, number, number],
  personBox: [number, number, number, number],
  itemClass?: string
): number {
  const [iX1, iY1, iX2, iY2] = itemBox;
  const [pX1, pY1, pX2, pY2] = personBox;

  const itemArea = Math.max(1, (iX2 - iX1) * (iY2 - iY1));
  const pWidth = Math.max(1, pX2 - pX1);
  const pHeight = Math.max(1, pY2 - pY1);

  // Compute intersection
  const xA = Math.max(iX1, pX1);
  const yA = Math.max(iY1, pY1);
  const xB = Math.min(iX2, pX2);
  const yB = Math.min(iY2, pY2);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const overlapRatio = interArea / itemArea;

  const itemCenterX = (iX1 + iX2) / 2;
  const itemCenterY = (iY1 + iY2) / 2;
  const personCenterX = (pX1 + pX2) / 2;

  // Horizontal containment distance (normalized by person half-width)
  const normDistX = Math.abs(itemCenterX - personCenterX) / (pWidth / 2);
  if (normDistX > 1.35) {
    // Item is horizontally outside this person's torso corridor
    return 0;
  }

  // Vertical relative position within person (0.0 = top of head, 1.0 = feet)
  const relY = (itemCenterY - pY1) / pHeight;

  let anatomicalPrior = 1.0;
  const normalizedClass = itemClass ? itemClass.toLowerCase() : '';

  if (normalizedClass.includes('helmet') || normalizedClass.includes('hat') || normalizedClass.includes('head')) {
    // Helmets are expected near or slightly above cranial crown (relY: -0.15 to 0.35)
    anatomicalPrior = relY >= -0.18 && relY <= 0.38 ? 1.5 : Math.max(0.1, 1.0 - Math.abs(relY - 0.1) * 2.0);
  } else if (normalizedClass.includes('goggle') || normalizedClass.includes('glass') || normalizedClass.includes('eye')) {
    // Eyewear expected around eye level (relY: 0.05 to 0.32)
    anatomicalPrior = relY >= 0.05 && relY <= 0.32 ? 1.5 : Math.max(0.1, 1.0 - Math.abs(relY - 0.16) * 2.0);
  } else if (normalizedClass.includes('vest')) {
    // Vests expected in upper-mid torso (relY: 0.15 to 0.75)
    anatomicalPrior = relY >= 0.15 && relY <= 0.75 ? 1.5 : Math.max(0.1, 1.0 - Math.abs(relY - 0.45) * 1.5);
  } else if (normalizedClass.includes('boot') || normalizedClass.includes('shoe')) {
    // Boots expected in lower body (relY >= 0.65)
    anatomicalPrior = relY >= 0.65 && relY <= 1.20 ? 1.5 : Math.max(0.1, 1.0 - Math.abs(relY - 0.9) * 2.0);
  } else if (normalizedClass.includes('glove')) {
    // Gloves expected around hands / waist (relY: 0.30 to 0.80)
    anatomicalPrior = relY >= 0.28 && relY <= 0.82 ? 1.3 : 0.7;
  }

  // Center alignment bonus
  const centerBonus = Math.max(0, 1.0 - normDistX * 0.4);
  const affinity = (overlapRatio * 0.75 + centerBonus * 0.25) * anatomicalPrior;

  // Fallback containment check if bounding box has slight margin offset
  const padX = pWidth * 0.18;
  const padY = pHeight * 0.18;
  const isContained =
    itemCenterX >= pX1 - padX &&
    itemCenterX <= pX2 + padX &&
    itemCenterY >= pY1 - padY &&
    itemCenterY <= pY2 + padY;

  if (isContained && affinity < 0.25) {
    return 0.35 * anatomicalPrior;
  }

  return affinity;
}

/**
 * Checks if item bounding box is inside or substantially overlapping person bounding box.
 */
export function isItemAssociatedWithPerson(
  itemBox: [number, number, number, number],
  personBox: [number, number, number, number],
  overlapRatioThresh = 0.20
): boolean {
  return calculateSpatialAffinity(itemBox, personBox) >= overlapRatioThresh;
}

/**
 * Standardizes raw class name from YOLOv5 model.
 */
export function standardizeClassName(rawClass: string): string {
  const cleaned = rawClass.trim().toLowerCase().replace(/_/g, '-');
  return PPE_CLASS_MAPPING[cleaned] || rawClass;
}

/**
 * Analyzes detections against configurable required PPE checklist.
 * Associates PPE items with detected persons using optimal spatial overlap and anatomical affinity.
 * Enforces: If reliable person-to-PPE association is not possible, output NEEDS REVIEW.
 */
export function evaluateCompliance(
  detections: Detection[],
  requiredPPE: string[] = DEFAULT_REQUIRED_PPE
): ComplianceResult {
  if (!detections || detections.length === 0) {
    return {
      status: 'NO_DETECTIONS',
      message: 'No people or PPE equipment detected.',
      total_workers: 0,
      compliant_workers: 0,
      violation_workers: 0,
      overall_compliance_rate: 0,
      worker_evaluations: [],
      unassigned_ppe: [],
      direct_violations: [],
    };
  }

  const persons: Detection[] = [];
  const ppeItems: Detection[] = [];
  const directViolations: Detection[] = [];

  for (const d of detections) {
    const stdClass = standardizeClassName(d.class);
    if (stdClass === 'Person') {
      persons.push(d);
    } else if (stdClass.startsWith('Missing ') || d.raw_class.toLowerCase().startsWith('no-')) {
      directViolations.push(d);
    } else {
      ppeItems.push(d);
    }
  }

  // Requirement: If person detection is not available, do NOT claim workers are compliant.
  // Clearly flag as NEEDS REVIEW.
  if (persons.length === 0) {
    const detectedItemNames = Array.from(new Set(ppeItems.map((item) => standardizeClassName(item.class))));
    const rawItemNames = ppeItems.map((item) => item.raw_class).filter(Boolean);
    const missing = requiredPPE.filter((req) => !isRequirementSatisfied(req, detectedItemNames, rawItemNames));

    return {
      status: 'NEEDS REVIEW',
      message: 'PPE detected but no person bounding box was identified. Association is inconclusive.',
      total_workers: ppeItems.length > 0 ? 1 : 0,
      compliant_workers: 0,
      violation_workers: 0,
      review_workers: ppeItems.length > 0 ? 1 : 0,
      overall_compliance_rate: 0,
      worker_evaluations: [
        {
          worker_id: 1,
          box: null,
          confidence: 0.5,
          status: 'NEEDS REVIEW',
          detected_ppe: detectedItemNames,
          missing_ppe: missing,
          direct_violations: directViolations.map((d) => standardizeClassName(d.class)),
          details: 'Person silhouette not identified; manual supervisor review required.',
        },
      ],
      unassigned_ppe: ppeItems,
      direct_violations: directViolations,
    };
  }

  // Multi-Person Spatial Overlap & Exclusive PPE Association:
  // For each positive PPE item, assign it to the person with highest spatial affinity
  const personPPEList: { classes: string[]; rawClasses: string[] }[] = persons.map(() => ({
    classes: [],
    rawClasses: [],
  }));
  const assignedPPEIndices = new Set<number>();

  ppeItems.forEach((item, itemIdx) => {
    let bestPersonIdx = -1;
    let maxAffinity = 0.20; // threshold for valid spatial association

    persons.forEach((person, pIdx) => {
      // Prioritize explicit tag e.g. 'helmet-0' or 'vest-1'
      const explicitMatch = item.id && item.id.endsWith(`-${pIdx}`);
      const affinity = calculateSpatialAffinity(item.box, person.box, item.class) + (explicitMatch ? 10.0 : 0);
      if (affinity > maxAffinity) {
        maxAffinity = affinity;
        bestPersonIdx = pIdx;
      }
    });

    if (bestPersonIdx !== -1) {
      personPPEList[bestPersonIdx].classes.push(standardizeClassName(item.class));
      if (item.raw_class) personPPEList[bestPersonIdx].rawClasses.push(item.raw_class);
      assignedPPEIndices.add(itemIdx);
    }
  });

  // For each direct negative violation, assign to the person with highest spatial affinity
  const personDirectViolations: string[][] = persons.map(() => []);

  directViolations.forEach((dv) => {
    let bestPersonIdx = -1;
    let maxAffinity = 0.20;

    persons.forEach((person, pIdx) => {
      const explicitMatch = dv.id && dv.id.endsWith(`-${pIdx}`);
      const affinity = calculateSpatialAffinity(dv.box, person.box, dv.class) + (explicitMatch ? 10.0 : 0);
      if (affinity > maxAffinity) {
        maxAffinity = affinity;
        bestPersonIdx = pIdx;
      }
    });

    if (bestPersonIdx !== -1) {
      personDirectViolations[bestPersonIdx].push(standardizeClassName(dv.class));
    }
  });

  // Evaluate each person independently
  const workerEvaluations: WorkerEvaluation[] = [];

  persons.forEach((person, index) => {
    const workerId = index + 1;
    const associatedPPE = personPPEList[index].classes;
    const associatedRawClasses = personPPEList[index].rawClasses;
    const workerDirectViolations = personDirectViolations[index];

    const uniqueDetected = Array.from(new Set(associatedPPE));
    const missingPPE = requiredPPE.filter((req) => !isRequirementSatisfied(req, associatedPPE, associatedRawClasses));

    // Incorporate direct negative violation classes (e.g. "Missing Helmet")
    for (const dv of workerDirectViolations) {
      const positiveEq = dv.replace('Missing ', 'Safety ');
      if (requiredPPE.includes(positiveEq) && !missingPPE.includes(positiveEq)) {
        missingPPE.push(positiveEq);
      }
    }

    const isSafe = missingPPE.length === 0 && workerDirectViolations.length === 0;

    workerEvaluations.push({
      worker_id: workerId,
      box: person.box,
      confidence: person.confidence,
      status: isSafe ? 'SAFE' : 'VIOLATION',
      detected_ppe: uniqueDetected,
      missing_ppe: missingPPE,
      direct_violations: workerDirectViolations,
      details: isSafe
        ? 'All mandatory PPE detected and verified.'
        : `Non-compliant: Missing ${missingPPE.join(', ')}`,
    });
  });

  const totalWorkers = workerEvaluations.length;
  const compliantWorkers = workerEvaluations.filter((w) => w.status === 'SAFE').length;
  const violationWorkers = workerEvaluations.filter((w) => w.status === 'VIOLATION').length;
  const complianceRate = totalWorkers > 0 ? Math.round((compliantWorkers / totalWorkers) * 100) : 0;
  const overallStatus = totalWorkers > 0 && compliantWorkers === totalWorkers ? 'SAFE' : 'VIOLATION';

  const unassignedPPE = ppeItems.filter((_, idx) => !assignedPPEIndices.has(idx));

  return {
    status: overallStatus,
    message:
      overallStatus === 'SAFE'
        ? 'All workers fully compliant with mandatory safety gear.'
        : `${violationWorkers} worker(s) failed safety PPE requirements.`,
    total_workers: totalWorkers,
    compliant_workers: compliantWorkers,
    violation_workers: violationWorkers,
    overall_compliance_rate: complianceRate,
    worker_evaluations: workerEvaluations,
    unassigned_ppe: unassignedPPE,
    direct_violations: directViolations,
  };
}
