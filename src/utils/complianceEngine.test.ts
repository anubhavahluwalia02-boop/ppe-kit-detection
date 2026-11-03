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
} from './complianceEngine';
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


