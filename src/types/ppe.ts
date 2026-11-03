export type PPEName = 
  | 'Safety Helmet'
  | 'Safety Vest'
  | 'Safety Gloves'
  | 'Safety Goggles'
  | 'Safety Boots'
  | 'Person'
  | 'Missing Helmet'
  | 'Missing Vest'
  | 'Missing Gloves'
  | 'Missing Goggles'
  | 'Missing Boots';

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Detection {
  id?: string;
  class: PPEName | string;
  raw_class: string;
  confidence: number;
  box: [number, number, number, number]; // [x1, y1, x2, y2]
  color?: string;
}

export type ComplianceStatus = 'SAFE' | 'VIOLATION' | 'NEEDS REVIEW' | 'NO_DETECTIONS';

export interface WorkerEvaluation {
  worker_id: number;
  box: [number, number, number, number] | null;
  confidence: number;
  status: 'SAFE' | 'VIOLATION' | 'NEEDS REVIEW';
  detected_ppe: string[];
  missing_ppe: string[];
  direct_violations: string[];
  details: string;
}

export interface ComplianceResult {
  status: ComplianceStatus;
  message: string;
  total_workers: number;
  compliant_workers: number;
  violation_workers: number;
  review_workers?: number;
  overall_compliance_rate: number;
  worker_evaluations: WorkerEvaluation[];
  unassigned_ppe: Detection[];
  direct_violations: Detection[];
}

export interface ViolationRecord {
  id: string | number;
  timestamp: string;
  violation_type: string;
  missing_ppe: string[];
  confidence: number;
  worker_id?: number;
  evidence_url?: string;
  source: 'live_camera' | 'image_upload' | 'sample_test';
  details?: string;
}

export interface ModelConfig {
  is_loaded: boolean;
  model_path: string;
  model_name: string;
  confidence_threshold: number;
  iou_threshold: number;
  required_ppe: string[];
  class_names: Record<number, string>;
  error_message?: string | null;
}
