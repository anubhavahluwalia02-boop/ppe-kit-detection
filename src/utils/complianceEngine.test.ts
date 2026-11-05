import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateIoU,
  isItemAssociatedWithPerson,
  standardizeClassName,
  evaluateCompliance,
  DEFAULT_REQUIRED_PPE,
  isRequirementSatisfied,
  PPE_SYNONYMS,
  calculateSpatialAffinity,
} from './complianceEngine';
import { applyPersonNMS, CandidatePersonBox } from './browserVisionDetector';
import { Detection } from '../types/ppe';

test('calculateIoU returns 1.0 for identical boxes', () => {
  const box: [number, number, number, number] = [10, 10, 100, 100];
  const iou = calculateIoU(box, box);
  assert.equal(iou, 1.0);
});

test('calculateIoU returns 0 for non-overlapping boxes', () => {
  const boxA: [number, number, number, number] = [0, 0, 50, 50];
  const boxB: [number, number, number, number] = [60, 60, 100, 100];
  const iou = calculateIoU(boxA, boxB);
  assert.equal(iou, 0);
});

test('isItemAssociatedWithPerson correctly identifies helmet on head of person', () => {
  // Person: [100, 100, 300, 700]
  // Helmet: [150, 80, 250, 180] (sits near top of person)
  const person: [number, number, number, number] = [100, 100, 300, 700];
  const helmet: [number, number, number, number] = [150, 90, 250, 180];
  const associated = isItemAssociatedWithPerson(helmet, person);
  assert.equal(associated, true);
});

test('standardizeClassName maps variations to standard names', () => {
  assert.equal(standardizeClassName('hard_hat'), 'Safety Helmet');
  assert.equal(standardizeClassName('reflective-vest'), 'Safety Vest');
  assert.equal(standardizeClassName('safety-boots'), 'Safety Boots');
  assert.equal(standardizeClassName('person'), 'Person');
  assert.equal(standardizeClassName('no-helmet'), 'Missing Helmet');
});

test('evaluateCompliance returns SAFE when worker has all mandatory PPE', () => {
  const personBox: [number, number, number, number] = [100, 100, 300, 700];
  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.95, box: personBox },
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.92, box: [150, 90, 250, 180] },
    { class: 'Safety Vest', raw_class: 'vest', confidence: 0.88, box: [120, 200, 280, 450] },
    { class: 'Safety Gloves', raw_class: 'gloves', confidence: 0.81, box: [105, 380, 140, 450] },
    { class: 'Safety Goggles', raw_class: 'goggles', confidence: 0.85, box: [170, 130, 230, 160] },
    { class: 'Safety Boots', raw_class: 'boots', confidence: 0.89, box: [130, 620, 270, 700] },
  ];

  const result = evaluateCompliance(detections, DEFAULT_REQUIRED_PPE);
  assert.equal(result.status, 'SAFE');
  assert.equal(result.total_workers, 1);
  assert.equal(result.compliant_workers, 1);
  assert.equal(result.violation_workers, 0);
  assert.equal(result.overall_compliance_rate, 100);
});

test('evaluateCompliance returns VIOLATION when worker is missing helmet and vest', () => {
  const personBox: [number, number, number, number] = [100, 100, 300, 700];
  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.95, box: personBox },
    { class: 'Safety Gloves', raw_class: 'gloves', confidence: 0.81, box: [105, 380, 140, 450] },
    { class: 'Safety Boots', raw_class: 'boots', confidence: 0.89, box: [130, 620, 270, 700] },
  ];

  const result = evaluateCompliance(detections, DEFAULT_REQUIRED_PPE);
  assert.equal(result.status, 'VIOLATION');
  assert.equal(result.total_workers, 1);
  assert.equal(result.compliant_workers, 0);
  assert.equal(result.violation_workers, 1);
  assert.equal(result.overall_compliance_rate, 0);
  assert.ok(result.worker_evaluations[0].missing_ppe.includes('Safety Helmet'));
  assert.ok(result.worker_evaluations[0].missing_ppe.includes('Safety Vest'));
});

test('evaluateCompliance marks NEEDS REVIEW if PPE is found without any Person box', () => {
  const detections: Detection[] = [
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.92, box: [150, 90, 250, 180] },
    { class: 'Safety Vest', raw_class: 'vest', confidence: 0.88, box: [120, 200, 280, 450] },
  ];

  const result = evaluateCompliance(detections, DEFAULT_REQUIRED_PPE);
  assert.equal(result.status, 'NEEDS REVIEW');
  assert.equal(result.compliant_workers, 0);
  assert.ok(result.message.includes('inconclusive') || result.message.includes('no person'));
});

test('evaluateCompliance handles direct negative classes like no-helmet as violation', () => {
  const personBox: [number, number, number, number] = [100, 100, 300, 700];
  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.95, box: personBox },
    { class: 'no-helmet', raw_class: 'no-helmet', confidence: 0.9, box: [150, 90, 250, 180] },
    { class: 'Safety Vest', raw_class: 'vest', confidence: 0.88, box: [120, 200, 280, 450] },
  ];

  const result = evaluateCompliance(detections, ['Safety Helmet', 'Safety Vest']);
  assert.equal(result.status, 'VIOLATION');
  assert.ok(result.worker_evaluations[0].missing_ppe.includes('Safety Helmet'));
});

test('isRequirementSatisfied accepts synonyms for Safety Goggles (glasses, safety-glasses, goggles, etc.)', () => {
  assert.equal(isRequirementSatisfied('Safety Goggles', ['glasses']), true);
  assert.equal(isRequirementSatisfied('Safety Goggles', ['safety-glasses']), true);
  assert.equal(isRequirementSatisfied('Safety Goggles', ['safety_glasses']), true);
  assert.equal(isRequirementSatisfied('Safety Goggles', ['goggles']), true);
  assert.equal(isRequirementSatisfied('Safety Goggles', ['spectacles']), true);
  assert.equal(isRequirementSatisfied('Safety Goggles', ['eyewear']), true);
  assert.equal(isRequirementSatisfied('Safety Goggles', ['weird-glasses']), true);
  assert.equal(isRequirementSatisfied('Safety Goggles', ['gloves']), false);
});

test('evaluateCompliance achieves 100% SAFE compliance when worker wears weird glasses or glasses synonym', () => {
  const personBox: [number, number, number, number] = [100, 100, 300, 700];
  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.95, box: personBox },
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.92, box: [150, 90, 250, 180] },
    { class: 'Safety Vest', raw_class: 'vest', confidence: 0.88, box: [120, 200, 280, 450] },
    { class: 'Safety Gloves', raw_class: 'gloves', confidence: 0.81, box: [105, 380, 140, 450] },
    { class: 'glasses', raw_class: 'safety-glasses', confidence: 0.87, box: [170, 130, 230, 160] },
    { class: 'Safety Boots', raw_class: 'boots', confidence: 0.89, box: [130, 620, 270, 700] },
  ];

  const result = evaluateCompliance(detections, DEFAULT_REQUIRED_PPE);
  assert.equal(result.status, 'SAFE');
  assert.equal(result.total_workers, 1);
  assert.equal(result.compliant_workers, 1);
  assert.equal(result.violation_workers, 0);
  assert.equal(result.overall_compliance_rate, 100);
  assert.equal(result.worker_evaluations[0].missing_ppe.length, 0);
});

test('Desk Camera: Wearing helmet achieves 100% SAFE compliance when helmet is the enforced station requirement', () => {
  const personBox: [number, number, number, number] = [100, 100, 300, 700];
  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.95, box: personBox },
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.94, box: [150, 90, 250, 180] },
  ];

  const result = evaluateCompliance(detections, ['Safety Helmet']);
  assert.equal(result.status, 'SAFE');
  assert.equal(result.total_workers, 1);
  assert.equal(result.compliant_workers, 1);
  assert.equal(result.violation_workers, 0);
  assert.equal(result.overall_compliance_rate, 100);
  assert.equal(result.worker_evaluations[0].missing_ppe.length, 0);
});

test('Desk Camera: Not wearing helmet triggers VIOLATION when helmet is required', () => {
  const personBox: [number, number, number, number] = [100, 100, 300, 700];
  // Worker present, but no helmet worn
  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.95, box: personBox },
  ];

  const result = evaluateCompliance(detections, ['Safety Helmet']);
  assert.equal(result.status, 'VIOLATION');
  assert.equal(result.compliant_workers, 0);
  assert.equal(result.violation_workers, 1);
  assert.equal(result.overall_compliance_rate, 0);
  assert.deepEqual(result.worker_evaluations[0].missing_ppe, ['Safety Helmet']);
});
test('Desk Camera: Explicit "Missing Helmet" detection marks worker as VIOLATION and lists Safety Helmet missing', () => {
  const personBox: [number, number, number, number] = [100, 100, 300, 700];
  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.95, box: personBox },
    { class: 'Missing Helmet', raw_class: 'no-helmet', confidence: 0.94, box: [150, 90, 250, 180] },
  ];

  const result = evaluateCompliance(detections, ['Safety Helmet']);
  assert.equal(result.status, 'VIOLATION');
  assert.equal(result.compliant_workers, 0);
  assert.equal(result.violation_workers, 1);
  assert.deepEqual(result.worker_evaluations[0].missing_ppe, ['Safety Helmet']);
  assert.ok(result.worker_evaluations[0].direct_violations.includes('Missing Helmet'));
});

test('Helmet Synonyms: "hard-hat", "hardhat", "safety-helmet" satisfy Safety Helmet requirement', () => {
  assert.ok(isRequirementSatisfied('Safety Helmet', ['hard-hat']));
  assert.ok(isRequirementSatisfied('Safety Helmet', ['hardhat']));
  assert.ok(isRequirementSatisfied('Safety Helmet', ['safety-helmet']));
  assert.ok(isRequirementSatisfied('Safety Helmet', ['helmet']));
  assert.ok(isRequirementSatisfied('Safety Helmet', [], ['hard_hat']));
});

test('Multi-Worker: If 2 workers are present, evaluate each worker independently (1 Safe + 1 Violation -> 50% rate)', () => {
  const worker1Box: [number, number, number, number] = [40, 100, 260, 500];
  const worker2Box: [number, number, number, number] = [340, 100, 560, 500];

  const detections: Detection[] = [
    // Worker 1: Full PPE
    { class: 'Person', raw_class: 'person', confidence: 0.96, box: worker1Box },
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.94, box: [90, 95, 210, 160] },
    { class: 'Safety Vest', raw_class: 'vest', confidence: 0.91, box: [80, 210, 220, 360] },

    // Worker 2: Missing Helmet
    { class: 'Person', raw_class: 'person', confidence: 0.95, box: worker2Box },
    { class: 'no-helmet', raw_class: 'no-helmet', confidence: 0.93, box: [390, 95, 510, 160] },
    { class: 'Safety Vest', raw_class: 'vest', confidence: 0.90, box: [380, 210, 520, 360] },
  ];

  const result = evaluateCompliance(detections, ['Safety Helmet', 'Safety Vest']);
  assert.equal(result.total_workers, 2);
  assert.equal(result.compliant_workers, 1);
  assert.equal(result.violation_workers, 1);
  assert.equal(result.overall_compliance_rate, 50);
  assert.equal(result.status, 'VIOLATION');

  // Verify worker evaluations
  assert.equal(result.worker_evaluations[0].worker_id, 1);
  assert.equal(result.worker_evaluations[0].status, 'SAFE');
  assert.equal(result.worker_evaluations[0].missing_ppe.length, 0);

  assert.equal(result.worker_evaluations[1].worker_id, 2);
  assert.equal(result.worker_evaluations[1].status, 'VIOLATION');
  assert.deepEqual(result.worker_evaluations[1].missing_ppe, ['Safety Helmet']);
});

test('Multi-Worker: If 3 workers are present, evaluate all 3 independently (2 Safe + 1 Violation -> 67% rate)', () => {
  const worker1Box: [number, number, number, number] = [20, 100, 190, 500];
  const worker2Box: [number, number, number, number] = [210, 100, 380, 500];
  const worker3Box: [number, number, number, number] = [400, 100, 570, 500];

  const detections: Detection[] = [
    // Worker 1: Safe
    { class: 'Person', raw_class: 'person', confidence: 0.96, box: worker1Box },
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.94, box: [60, 95, 150, 160] },

    // Worker 2: Safe
    { class: 'Person', raw_class: 'person', confidence: 0.95, box: worker2Box },
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.93, box: [250, 95, 340, 160] },

    // Worker 3: Missing Helmet
    { class: 'Person', raw_class: 'person', confidence: 0.95, box: worker3Box },
    { class: 'Missing Helmet', raw_class: 'no-helmet', confidence: 0.92, box: [440, 95, 530, 160] },
  ];

  const result = evaluateCompliance(detections, ['Safety Helmet']);
  assert.equal(result.total_workers, 3);
  assert.equal(result.compliant_workers, 2);
  assert.equal(result.violation_workers, 1);
  assert.equal(result.overall_compliance_rate, 67);
  assert.equal(result.status, 'VIOLATION');

  assert.equal(result.worker_evaluations[0].worker_id, 1);
  assert.equal(result.worker_evaluations[0].status, 'SAFE');

  assert.equal(result.worker_evaluations[1].worker_id, 2);
  assert.equal(result.worker_evaluations[1].status, 'SAFE');

  assert.equal(result.worker_evaluations[2].worker_id, 3);
  assert.equal(result.worker_evaluations[2].status, 'VIOLATION');
  assert.deepEqual(result.worker_evaluations[2].missing_ppe, ['Safety Helmet']);
});

test('Multi-Worker: When all 3 workers wear required gear, achieve 100% SAFE', () => {
  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.96, box: [20, 100, 190, 500] },
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.94, box: [60, 95, 150, 160] },

    { class: 'Person', raw_class: 'person', confidence: 0.95, box: [210, 100, 380, 500] },
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.93, box: [250, 95, 340, 160] },

    { class: 'Person', raw_class: 'person', confidence: 0.95, box: [400, 100, 570, 500] },
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.92, box: [440, 95, 530, 160] },
  ];

  const result = evaluateCompliance(detections, ['Safety Helmet']);
  assert.equal(result.total_workers, 3);
  assert.equal(result.compliant_workers, 3);
  assert.equal(result.violation_workers, 0);
  assert.equal(result.overall_compliance_rate, 100);
  assert.equal(result.status, 'SAFE');
});

test('calculateSpatialAffinity: gives high affinity for helmet on head and zero for far item', () => {
  const person: [number, number, number, number] = [100, 100, 300, 700];
  const helmetOnHead: [number, number, number, number] = [150, 90, 250, 180];
  const farItem: [number, number, number, number] = [550, 90, 650, 180];

  const highAffinity = calculateSpatialAffinity(helmetOnHead, person, 'Safety Helmet');
  const zeroAffinity = calculateSpatialAffinity(farItem, person, 'Safety Helmet');

  assert.ok(highAffinity > 0.8, `Expected high affinity, got ${highAffinity}`);
  assert.equal(zeroAffinity, 0, `Expected 0 affinity, got ${zeroAffinity}`);
});

test('applyPersonNMS: suppresses redundant overlapping candidate boxes while preserving distinct side-by-side persons', () => {
  const candidates: CandidatePersonBox[] = [
    // Duplicate 1 of Person A (high confidence)
    { box: [50, 100, 250, 700], score: 95, centroidX: 150 },
    // Duplicate 2 of Person A (slightly smaller box, lower score - should be suppressed)
    { box: [55, 110, 245, 690], score: 85, centroidX: 150 },
    // Duplicate 3 of Person A (containment overlap - should be suppressed)
    { box: [60, 120, 240, 680], score: 78, centroidX: 150 },

    // Person B (standing next to Person A - should be KEPT)
    { box: [320, 100, 520, 700], score: 92, centroidX: 420 },
    // Duplicate 1 of Person B (should be suppressed)
    { box: [325, 105, 515, 695], score: 80, centroidX: 420 },

    // Person C (standing next to Person B - should be KEPT)
    { box: [600, 100, 800, 700], score: 90, centroidX: 700 },
  ];

  const filtered = applyPersonNMS(candidates, 0.35, 0.58);

  // Exactly 3 distinct persons must survive NMS
  assert.equal(filtered.length, 3, `Expected 3 persons after NMS, got ${filtered.length}`);

  // Person A center ~ 150, Person B center ~ 420, Person C center ~ 700
  assert.ok(filtered[0][0] >= 40 && filtered[0][2] <= 260, 'Worker 1 preserved correctly');
  assert.ok(filtered[1][0] >= 310 && filtered[1][2] <= 530, 'Worker 2 preserved correctly');
  assert.ok(filtered[2][0] >= 590 && filtered[2][2] <= 810, 'Worker 3 preserved correctly');
});

test('Spatial Overlap: When 2 people stand close together, PPE items are exclusively assigned to the closer person without theft', () => {
  // Person 1 (left): [100, 100, 300, 700], Person 2 (right): [270, 100, 470, 700] - slight horizontal boundary proximity
  const person1: [number, number, number, number] = [100, 100, 300, 700];
  const person2: [number, number, number, number] = [270, 100, 470, 700];

  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.96, box: person1 },
    { class: 'Person', raw_class: 'person', confidence: 0.95, box: person2 },

    // Person 1 wears a helmet on Person 1's head
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.94, box: [150, 90, 250, 180] },
    // Person 2 wears a vest on Person 2's torso
    { class: 'Safety Vest', raw_class: 'vest', confidence: 0.92, box: [320, 220, 420, 450] },
  ];

  const result = evaluateCompliance(detections, ['Safety Helmet', 'Safety Vest']);
  assert.equal(result.total_workers, 2);

  // Worker 1 has helmet, but missing vest
  assert.ok(result.worker_evaluations[0].detected_ppe.includes('Safety Helmet'));
  assert.ok(result.worker_evaluations[0].missing_ppe.includes('Safety Vest'));

  // Worker 2 has vest, but missing helmet
  assert.ok(result.worker_evaluations[1].detected_ppe.includes('Safety Vest'));
  assert.ok(result.worker_evaluations[1].missing_ppe.includes('Safety Helmet'));
});

test('Person Framing Accuracy: applyPersonNMS retains tight person silhouette frames without duplicate ghost boxes', () => {
  // Test case: 2 people detected with varying scales and slight jitter
  const candidates: CandidatePersonBox[] = [
    // Person 1: centered at X=160, Y1=80, Y2=460 (accurate frame)
    { box: [90, 80, 230, 460], score: 0.96, centroidX: 160 },
    // Duplicate sub-proposal for Person 1 (e.g. torso only)
    { box: [100, 160, 220, 450], score: 0.82, centroidX: 160 },
    // Duplicate sub-proposal for Person 1 (head only)
    { box: [110, 80, 210, 200], score: 0.78, centroidX: 160 },

    // Person 2: centered at X=440, Y1=100, Y2=480 (accurate frame)
    { box: [360, 100, 520, 480], score: 0.94, centroidX: 440 },
    // Duplicate sub-proposal for Person 2
    { box: [380, 180, 500, 470], score: 0.81, centroidX: 440 },
  ];

  const results = applyPersonNMS(candidates, 0.35, 0.58);
  assert.equal(results.length, 2, 'Must cleanly isolate exactly 2 distinct person bounding boxes');

  // Verify Person 1 frame
  assert.deepEqual(results[0], [90, 80, 230, 460], 'Person 1 frame must be the tight, high-confidence box');
  // Verify Person 2 frame
  assert.deepEqual(results[1], [360, 100, 520, 480], 'Person 2 frame must be the tight, high-confidence box');
});

test('Person Framing Accuracy: 1 person mode isolates single authoritative worker box', () => {
  const candidates: CandidatePersonBox[] = [
    { box: [120, 90, 380, 510], score: 0.98, centroidX: 250 },
    { box: [130, 140, 370, 500], score: 0.85, centroidX: 250 },
  ];

  const results = applyPersonNMS(candidates);
  assert.equal(results.length, 1);
  assert.equal(results[0][0], 120);
  assert.equal(results[0][1], 90);
  assert.equal(results[0][2], 380);
  assert.equal(results[0][3], 510);
});

test('Boots Detection: Missing Boots directly flags worker as VIOLATION with Safety Boots listed missing', () => {
  const personBox: [number, number, number, number] = [100, 100, 300, 700];
  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.96, box: personBox },
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.94, box: [150, 90, 250, 180] },
    { class: 'Missing Boots', raw_class: 'no-boots', confidence: 0.92, box: [130, 620, 270, 700] },
  ];

  const result = evaluateCompliance(detections, ['Safety Helmet', 'Safety Boots']);
  assert.equal(result.status, 'VIOLATION');
  assert.equal(result.compliant_workers, 0);
  assert.equal(result.violation_workers, 1);
  assert.deepEqual(result.worker_evaluations[0].missing_ppe, ['Safety Boots']);
  assert.ok(result.worker_evaluations[0].direct_violations.includes('Missing Boots'));
});

test('Boots Detection: Wearing Safety Boots satisfies Safety Boots requirement with 100% SAFE', () => {
  const personBox: [number, number, number, number] = [100, 100, 300, 700];
  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.96, box: personBox },
    { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.94, box: [150, 90, 250, 180] },
    { class: 'Safety Boots', raw_class: 'boots', confidence: 0.93, box: [130, 620, 270, 700] },
  ];

  const result = evaluateCompliance(detections, ['Safety Helmet', 'Safety Boots']);
  assert.equal(result.status, 'SAFE');
  assert.equal(result.compliant_workers, 1);
  assert.equal(result.violation_workers, 0);
  assert.equal(result.overall_compliance_rate, 100);
  assert.equal(result.worker_evaluations[0].missing_ppe.length, 0);
});

test('Boots Synonyms: "work-boots", "steel-toe-boots", "safety-shoes" satisfy Safety Boots requirement', () => {
  assert.ok(isRequirementSatisfied('Safety Boots', ['work-boots']));
  assert.ok(isRequirementSatisfied('Safety Boots', ['steel-toe-boots']));
  assert.ok(isRequirementSatisfied('Safety Boots', ['safety-shoes']));
  assert.ok(isRequirementSatisfied('Safety Boots', ['safety-boots']));
  assert.ok(isRequirementSatisfied('Safety Boots', ['boots']));
  assert.ok(isRequirementSatisfied('Safety Boots', [], ['steel_toe_boots']));
  assert.ok(isRequirementSatisfied('Safety Boots', [], ['work_boots']));
});

test('Dual Equipment Check: If worker is missing BOTH helmet and boots, both are flagged in missing_ppe', () => {
  const personBox: [number, number, number, number] = [100, 100, 300, 700];
  const detections: Detection[] = [
    { class: 'Person', raw_class: 'person', confidence: 0.96, box: personBox },
    { class: 'Missing Helmet', raw_class: 'no-helmet', confidence: 0.93, box: [150, 90, 250, 180] },
    { class: 'Missing Boots', raw_class: 'no-boots', confidence: 0.91, box: [130, 620, 270, 700] },
  ];

  const result = evaluateCompliance(detections, ['Safety Helmet', 'Safety Boots']);
  assert.equal(result.status, 'VIOLATION');
  assert.ok(result.worker_evaluations[0].missing_ppe.includes('Safety Helmet'));
  assert.ok(result.worker_evaluations[0].missing_ppe.includes('Safety Boots'));
  assert.equal(result.worker_evaluations[0].missing_ppe.length, 2);
});



