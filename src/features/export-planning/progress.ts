// ============================================================
// Tên file: src/features/export-planning/progress.ts
// Tên tiếng Việt: Tiến độ một chuyến để HIỂN THỊ — bước tiếp + còn thiếu gì (design-spec 42)
// Description: Derives a display summary of a shipment from the pure rules in lib/exportPlanning:
//              per-step states, the first unsettled step and the human list of what is missing.
// ============================================================
// KHÔNG phải luật mới: chỉ đọc kết quả stepState / subStepState / itemState của lib (ba-spec 41).
import {
  LOADING_STEPS,
  STEP_NOS,
  STEP_TITLES,
  SUB_STEP_LABELS,
  containerIdentityOk,
  contractStepState,
  documentItems,
  effectiveRevision,
  itemState,
  requiredDocumentLabel,
  stepState,
  subStepState,
  type EvidenceOptions,
  type ExportData,
  type StepNo,
} from "@/lib/exportPlanning";
import type { ExportItemState, ExportShipment } from "@/types";

export interface ShipmentProgress {
  steps: Record<StepNo, ExportItemState>;
  /** Bước đầu tiên (1–5) chưa xong; null = bước 1–5 đã xong (chuyến khép kín). */
  next: StepNo | null;
  /** Những mục còn thiếu của bước tiếp — câu chữ người dùng đọc. */
  missing: string[];
  /** Số bước 1–5 đã xong / không áp dụng. */
  settledCount: number;
}

const settled = (s: ExportItemState) => s === "done" || s === "not-applicable";

export function shipmentProgress(d: ExportData, s: ExportShipment, opts: EvidenceOptions): ShipmentProgress {
  const steps = Object.fromEntries(
    STEP_NOS.map((n) => [n, n === 1 ? contractStepState(d, s.contractId, opts) : stepState(d, s, n, opts)]),
  ) as Record<StepNo, ExportItemState>;
  const core: StepNo[] = [1, 2, 3, 4, 5];
  const next = core.find((n) => !settled(steps[n])) ?? null;
  const missing = next ? stepMissing(d, s, next) : [];
  return { steps, next, missing, settledCount: core.filter((n) => settled(steps[n])).length };
}

/** Những mục còn thiếu của MỘT bước (bước đã xong ⇒ rỗng). Câu chữ người dùng đọc. */
export function stepMissing(d: ExportData, s: ExportShipment, n: StepNo): string[] {
  switch (n) {
    case 1:
      return [effectiveRevision(d, s.contractId) ? "file hợp đồng đã ký" : "kết quả BGĐ duyệt"];
    case 2:
      return ["lệnh sản xuất"];
    case 3:
      return ["bao bì"];
    case 4: {
      const out = LOADING_STEPS.filter((st) => !settled(subStepState(d, s.id, st))).map((st) => SUB_STEP_LABELS[st].toLowerCase());
      if (!containerIdentityOk(s)) out.push(s.kind === "truck" ? "biển số xe" : "số cont + seal");
      return out;
    }
    case 5: {
      const items = documentItems(d, s.id);
      return items.length
        ? items.filter((i) => !settled(itemState(d, i))).map((i) => requiredDocumentLabel({ kind: i.docKind, form: i.docForm, issuer: "" }))
        : ["mục chứng từ"];
    }
    case 6:
      return [];
  }
}

/** "Bước tiếp: Đóng cont — còn hình ảnh đóng cont, tờ khai" / "Khép kín". */
export function progressText(p: ShipmentProgress): string {
  if (p.next === null) return "Đủ hồ sơ — xong bước 1–5";
  const head = `Bước tiếp: ${STEP_TITLES[p.next - 1]}`;
  if (!p.missing.length) return head;
  const shown = p.missing.slice(0, 2).join(", ");
  return `${head} — còn ${shown}${p.missing.length > 2 ? ` và ${p.missing.length - 2} mục khác` : ""}`;
}
