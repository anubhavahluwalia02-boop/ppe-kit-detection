import { Detection } from '../types/ppe';

export interface TestSample {
  id: string;
  name: string;
  description: string;
  expectedStatus: 'SAFE' | 'VIOLATION' | 'NEEDS REVIEW';
  imageUrl: string;
  detections: Detection[];
}

// Generate high quality SVG data URLs for each sample scenario so they render cleanly in all browsers
function createSampleSVG(
  bgColor: string,
  personColor: string,
  helmetColor: string | null,
  vestColor: string | null,
  bootsColor: string | null,
  title: string,
  statusBadge: string,
  statusColor: string
): string {
  const helmetSvg = helmetColor
    ? `<path d="M 240 130 Q 300 90 360 130 Z" fill="${helmetColor}" stroke="#fff" stroke-width="3"/>
       <rect x="230" y="125" width="140" height="12" rx="4" fill="${helmetColor}" />`
    : `<text x="300" y="115" font-family="sans-serif" font-size="14" fill="#EF4444" text-anchor="middle" font-weight="bold">⚠️ NO HELMET</text>`;

  const gogglesSvg = helmetColor
    ? `<rect x="260" y="150" width="80" height="20" rx="6" fill="#8B5CF6" fill-opacity="0.8" stroke="#fff" stroke-width="2"/>`
    : '';

  const vestSvg = vestColor
    ? `<path d="M 235 220 L 365 220 L 375 360 L 225 360 Z" fill="${vestColor}" stroke="#fff" stroke-width="2"/>
       <line x1="260" y1="220" x2="260" y2="360" stroke="#fff" stroke-dasharray="6,4" stroke-width="3"/>
       <line x1="340" y1="220" x2="340" y2="360" stroke="#fff" stroke-dasharray="6,4" stroke-width="3"/>`
    : `<text x="300" y="290" font-family="sans-serif" font-size="14" fill="#EF4444" text-anchor="middle" font-weight="bold">⚠️ NO VEST</text>`;

  const glovesSvg = `<circle cx="205" cy="340" r="16" fill="#06B6D4" />
                     <circle cx="395" cy="340" r="16" fill="#06B6D4" />`;

  const bootsSvg = bootsColor
    ? `<rect x="230" y="470" width="55" height="30" rx="6" fill="${bootsColor}" />
       <rect x="315" y="470" width="55" height="30" rx="6" fill="${bootsColor}" />`
    : `<rect x="235" y="480" width="50" height="20" rx="4" fill="#71717A" />
       <rect x="315" y="480" width="50" height="20" rx="4" fill="#71717A" />`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <rect width="600" height="600" fill="${bgColor}"/>
    <!-- Industrial background scaffolding -->
    <line x1="50" y1="550" x2="550" y2="550" stroke="#334155" stroke-width="8"/>
    <line x1="100" y1="50" x2="100" y2="550" stroke="#1E293B" stroke-width="4"/>
    <line x1="500" y1="50" x2="500" y2="550" stroke="#1E293B" stroke-width="4"/>
    <line x1="100" y1="200" x2="500" y2="200" stroke="#1E293B" stroke-width="4"/>
    <line x1="100" y1="380" x2="500" y2="380" stroke="#1E293B" stroke-width="4"/>
    
    <!-- Worker Body Silhouette -->
    <!-- Head -->
    <ellipse cx="300" cy="160" rx="45" ry="50" fill="${personColor}" />
    <!-- Neck -->
    <rect x="285" y="200" width="30" height="20" fill="${personColor}" />
    <!-- Torso -->
    <path d="M 230 220 L 370 220 L 350 400 L 250 400 Z" fill="${personColor}" />
    <!-- Arms -->
    <path d="M 230 230 L 200 330" stroke="${personColor}" stroke-width="26" stroke-linecap="round"/>
    <path d="M 370 230 L 400 330" stroke="${personColor}" stroke-width="26" stroke-linecap="round"/>
    <!-- Legs -->
    <line x1="260" y1="400" x2="255" y2="480" stroke="${personColor}" stroke-width="32" stroke-linecap="round"/>
    <line x1="340" y1="400" x2="345" y2="480" stroke="${personColor}" stroke-width="32" stroke-linecap="round"/>

    <!-- PPE Overlays -->
    ${helmetSvg}
    ${gogglesSvg}
    ${vestSvg}
    ${glovesSvg}
    ${bootsSvg}

    <!-- Header Card -->
    <rect x="30" y="24" width="540" height="50" rx="8" fill="#0B1120" stroke="#334155" stroke-width="1"/>
    <text x="46" y="55" font-family="sans-serif" font-size="16" font-weight="bold" fill="#F8FAFC">${title}</text>
    <rect x="440" y="34" width="115" height="30" rx="6" fill="${statusColor}" fill-opacity="0.2" stroke="${statusColor}" stroke-width="1.5"/>
    <text x="497" y="54" font-family="sans-serif" font-size="12" font-weight="bold" fill="${statusColor}" text-anchor="middle">${statusBadge}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_TEST_CASES: TestSample[] = [
  {
    id: 'sample-safe',
    name: 'Compliant Worker (Full 5/5 PPE)',
    description: 'Worker equipped with Safety Helmet, High-Vis Vest, Gloves, Goggles, and Steel-Toe Boots.',
    expectedStatus: 'SAFE',
    imageUrl: createSampleSVG('#0F172A', '#D97706', '#10B981', '#F59E0B', '#3B82F6', 'Field Worker #104 - Heavy Assembly', 'SAFE (100%)', '#10B981'),
    detections: [
      { class: 'Person', raw_class: 'person', confidence: 0.96, box: [170, 95, 430, 520] },
      { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.94, box: [225, 95, 375, 155] },
      { class: 'Safety Goggles', raw_class: 'goggles', confidence: 0.89, box: [255, 145, 345, 175] },
      { class: 'Safety Vest', raw_class: 'vest', confidence: 0.93, box: [220, 215, 380, 370] },
      { class: 'Safety Gloves', raw_class: 'gloves', confidence: 0.87, box: [185, 320, 225, 360] },
      { class: 'Safety Gloves', raw_class: 'gloves', confidence: 0.86, box: [375, 320, 415, 360] },
      { class: 'Safety Boots', raw_class: 'boots', confidence: 0.91, box: [220, 465, 380, 515] },
    ],
  },
  {
    id: 'sample-violation-critical',
    name: 'Major Infraction (Missing Helmet & Vest)',
    description: 'Worker in high-hazard structural zone without protective hard hat or high-visibility vest.',
    expectedStatus: 'VIOLATION',
    imageUrl: createSampleSVG('#0F172A', '#64748B', null, null, null, 'Structural Bay 3 - Unprotected Entry', 'VIOLATION', '#EF4444'),
    detections: [
      { class: 'Person', raw_class: 'person', confidence: 0.95, box: [170, 95, 430, 520] },
      { class: 'Missing Helmet', raw_class: 'no-helmet', confidence: 0.91, box: [240, 95, 360, 160] },
      { class: 'Missing Vest', raw_class: 'no-vest', confidence: 0.88, box: [230, 220, 370, 370] },
      { class: 'Safety Gloves', raw_class: 'gloves', confidence: 0.82, box: [185, 320, 225, 360] },
    ],
  },
  {
    id: 'sample-partial-ppe',
    name: 'Partial PPE (Missing Eye & Hand Protection)',
    description: 'Worker has helmet and vest on, but lacks required chemical-splash goggles and safety gloves.',
    expectedStatus: 'VIOLATION',
    imageUrl: createSampleSVG('#0F172A', '#38BDF8', '#10B981', '#F59E0B', '#3B82F6', 'Chemical Processing - Substation B', 'VIOLATION', '#EF4444'),
    detections: [
      { class: 'Person', raw_class: 'person', confidence: 0.97, box: [170, 95, 430, 520] },
      { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.95, box: [225, 95, 375, 155] },
      { class: 'Safety Vest', raw_class: 'vest', confidence: 0.92, box: [220, 215, 380, 370] },
      { class: 'Safety Boots', raw_class: 'boots', confidence: 0.89, box: [220, 465, 380, 515] },
    ],
  },
  {
    id: 'sample-needs-review',
    name: 'Inconclusive Silhouette (Needs Review)',
    description: 'PPE equipment detected in field-of-view, but no unambiguous human silhouette could be identified.',
    expectedStatus: 'NEEDS REVIEW',
    imageUrl: createSampleSVG('#020617', '#1E293B', '#10B981', '#F59E0B', null, 'Equipment Staging Rack - Optical Occlusion', 'NEEDS REVIEW', '#F59E0B'),
    detections: [
      { class: 'Safety Helmet', raw_class: 'helmet', confidence: 0.78, box: [225, 120, 375, 180] },
      { class: 'Safety Vest', raw_class: 'vest', confidence: 0.82, box: [220, 240, 380, 390] },
    ],
  },
];
