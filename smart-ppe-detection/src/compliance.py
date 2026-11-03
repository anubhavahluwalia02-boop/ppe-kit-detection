"""
PPE Compliance Analysis Engine.
Evaluates detected objects against workplace safety regulations,
associating PPE items to detected persons via bounding-box spatial overlap.
"""
from typing import List, Dict, Any, Tuple, Optional
import config

def calculate_iou(boxA: List[float], boxB: List[float]) -> float:
    """Computes Intersection over Union between two bounding boxes [x1, y1, x2, y2]."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    boxAArea = max(0.0, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    boxBArea = max(0.0, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

    unionArea = boxAArea + boxBArea - interArea
    if unionArea <= 0.0:
        return 0.0
    return interArea / unionArea

def is_inside_or_overlapping(item_box: List[float], person_box: List[float], overlap_thresh: float = 0.3) -> bool:
    """
    Checks if an item box is inside or substantially overlaps the person's bounding box.
    Uses center-point containment and intersection ratio over item area.
    """
    # Check center of item box
    center_x = (item_box[0] + item_box[2]) / 2.0
    center_y = (item_box[1] + item_box[3]) / 2.0

    # Margin tolerance for helmets and boots (which might sit slightly outside person bbox)
    p_x1, p_y1, p_x2, p_y2 = person_box
    pad_x = (p_x2 - p_x1) * 0.15
    pad_y = (p_y2 - p_y1) * 0.15

    if (p_x1 - pad_x <= center_x <= p_x2 + pad_x) and (p_y1 - pad_y <= center_y <= p_y2 + pad_y):
        return True

    # Check intersection relative to item area
    xA = max(item_box[0], person_box[0])
    yA = max(item_box[1], person_box[1])
    xB = min(item_box[2], person_box[2])
    yB = min(item_box[3], person_box[3])
    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    itemArea = max(0.001, (item_box[2] - item_box[0]) * (item_box[3] - item_box[1]))
    
    return (interArea / itemArea) >= overlap_thresh

PPE_SYNONYMS = {
    "Safety Goggles": [
        "Safety Goggles",
        "goggles",
        "glasses",
        "safety-glasses",
        "safety_glasses",
        "safety-goggles",
        "safety_goggles",
        "spectacles",
        "eyewear",
        "sunglasses",
        "eye-protection",
        "eye_protection",
        "protective-glasses",
        "weird-glasses",
    ],
    "Safety Helmet": [
        "Safety Helmet",
        "helmet",
        "hard-hat",
        "hard_hat",
        "safety-helmet",
        "hardhat",
        "cap",
    ],
    "Safety Vest": [
        "Safety Vest",
        "vest",
        "safety-vest",
        "reflective-vest",
        "hi-vis-vest",
    ],
    "Safety Gloves": [
        "Safety Gloves",
        "gloves",
        "safety-gloves",
        "work-gloves",
    ],
    "Safety Boots": [
        "Safety Boots",
        "boots",
        "safety-boots",
        "shoes",
        "safety-shoes",
    ],
}

def is_requirement_satisfied(requirement: str, detected_classes: List[str], raw_classes: Optional[List[str]] = None) -> bool:
    """
    Checks if a required PPE category (e.g. 'Safety Goggles') is satisfied
    by any of the detected item class names or raw class synonyms (e.g. 'glasses', 'safety-glasses', 'goggles').
    """
    synonyms = [s.lower().replace("_", "-").replace(" ", "-") for s in PPE_SYNONYMS.get(requirement, [requirement])]

    for item in detected_classes:
        norm = item.lower().replace("_", "-").replace(" ", "-")
        if norm in synonyms or config.PPE_CLASS_MAPPING.get(item.lower().replace("_", "-"), item) == requirement:
            return True

    if raw_classes:
        for raw in raw_classes:
            norm = raw.lower().replace("_", "-").replace(" ", "-")
            if norm in synonyms or config.PPE_CLASS_MAPPING.get(raw.lower().replace("_", "-"), raw) == requirement:
                return True

    return False

class ComplianceAnalyzer:
    def __init__(self, required_ppe: Optional[List[str]] = None):
        self.required_ppe = required_ppe or list(config.REQUIRED_PPE)

    def analyze(self, detections: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyzes a list of detections:
        detections format:
        [
            {"class": "Safety Helmet", "raw_class": "helmet", "confidence": 0.89, "box": [x1, y1, x2, y2]},
            ...
        ]
        Returns a structured compliance assessment.
        """
        if not detections:
            return {
                "status": "NO_DETECTIONS",
                "message": "No people or PPE items detected in image.",
                "total_workers": 0,
                "compliant_workers": 0,
                "violation_workers": 0,
                "overall_compliance_rate": 0.0,
                "worker_evaluations": [],
                "unassigned_ppe": [],
                "direct_violations": []
            }

        # Separate persons, PPE items, and explicit negative classes (e.g. no-helmet)
        persons = []
        ppe_items = []
        direct_violations = []

        for d in detections:
            cls_name = d.get("class", "")
            if cls_name == "Person":
                persons.append(d)
            elif cls_name.startswith("Missing ") or "no-" in d.get("raw_class", "").lower():
                direct_violations.append(d)
            else:
                ppe_items.append(d)

        # Case 1: No Person detected, but some PPE detected
        # Rule requirement: If reliable person-to-PPE association is not possible,
        # clearly show the result as NEEDS REVIEW instead of claiming that every worker is compliant.
        if len(persons) == 0:
            detected_items_names = list(set([item["class"] for item in ppe_items]))
            raw_items_names = [item.get("raw_class", "") for item in ppe_items if item.get("raw_class")]
            missing_items = [req for req in self.required_ppe if not is_requirement_satisfied(req, detected_items_names, raw_items_names)]
            
            return {
                "status": "NEEDS REVIEW",
                "message": "PPE items detected but no person bounding box was identified. Spatial association is inconclusive.",
                "total_workers": 1 if ppe_items else 0,
                "compliant_workers": 0,
                "violation_workers": 0,
                "review_workers": 1 if ppe_items else 0,
                "overall_compliance_rate": 0.0,
                "worker_evaluations": [{
                    "worker_id": 1,
                    "box": None,
                    "status": "NEEDS REVIEW",
                    "detected_ppe": detected_items_names,
                    "missing_ppe": missing_items,
                    "details": "Person bounding box not identified; association pending manual verification."
                }],
                "unassigned_ppe": ppe_items,
                "direct_violations": direct_violations
            }

        # Case 2: One or more persons detected. Associate PPE items to each person.
        worker_evaluations = []
        assigned_ppe_indices = set()

        for idx, person in enumerate(persons, start=1):
            p_box = person["box"]
            associated_items = []
            associated_raw_items = []
            worker_direct_violations = []

            # Check direct violations overlapping this person
            for dv in direct_violations:
                if is_inside_or_overlapping(dv["box"], p_box):
                    worker_direct_violations.append(dv["class"])

            # Associate positive PPE items
            for item_idx, item in enumerate(ppe_items):
                if is_inside_or_overlapping(item["box"], p_box):
                    associated_items.append(item["class"])
                    if item.get("raw_class"):
                        associated_raw_items.append(item["raw_class"])
                    assigned_ppe_indices.add(item_idx)

            # Determine compliance for this worker using synonym-tolerant compliance check
            unique_detected_ppe = list(set(associated_items))
            missing_ppe = [req for req in self.required_ppe if not is_requirement_satisfied(req, associated_items, associated_raw_items)]
            
            # Incorporate explicit negative classes if detected
            for dv_class in worker_direct_violations:
                req_equivalent = dv_class.replace("Missing ", "Safety ")
                if req_equivalent in self.required_ppe and req_equivalent not in missing_ppe:
                    missing_ppe.append(req_equivalent)

            # Compliance rule: compliant only when all required PPE items are detected
            if len(missing_ppe) == 0 and len(worker_direct_violations) == 0:
                worker_status = "SAFE"
                details = "All required PPE items confirmed."
            else:
                worker_status = "VIOLATION"
                details = f"Missing required PPE: {', '.join(missing_ppe)}"

            worker_evaluations.append({
                "worker_id": idx,
                "box": p_box,
                "confidence": person.get("confidence", 1.0),
                "status": worker_status,
                "detected_ppe": unique_detected_ppe,
                "missing_ppe": missing_ppe,
                "direct_violations": worker_direct_violations,
                "details": details
            })

        # Calculate totals
        total_workers = len(worker_evaluations)
        compliant_workers = sum(1 for w in worker_evaluations if w["status"] == "SAFE")
        violation_workers = sum(1 for w in worker_evaluations if w["status"] == "VIOLATION")
        compliance_rate = round((compliant_workers / total_workers * 100), 1) if total_workers > 0 else 0.0

        overall_status = "SAFE" if (total_workers > 0 and compliant_workers == total_workers) else "VIOLATION"

        unassigned_ppe = [item for i, item in enumerate(ppe_items) if i not in assigned_ppe_indices]

        return {
            "status": overall_status,
            "message": "Full compliance confirmed" if overall_status == "SAFE" else f"{violation_workers} PPE violation(s) detected",
            "total_workers": total_workers,
            "compliant_workers": compliant_workers,
            "violation_workers": violation_workers,
            "overall_compliance_rate": compliance_rate,
            "worker_evaluations": worker_evaluations,
            "unassigned_ppe": unassigned_ppe,
            "direct_violations": direct_violations
        }
