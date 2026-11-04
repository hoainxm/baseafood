// ============================================================
// Tên file: src/features/export-planning/progress.ts
// Tên tiếng Việt: Tiến độ một chuyến để HIỂN THỊ — bước tiếp + còn thiếu gì (design-spec 42)
// Description: Derives a display summary of a shipment from the pure rules in lib/exportPlanning:
//              per-step states, the first unsettled step and the human list of what is missing.
// ============================================================
// KHÔNG phải luật mới: chỉ đọc kết quả stepState / subStepState / itemState của lib (ba-spec 41).
import type { TagVariant } from "@/design-system";
import {
  type ContractState,
  LOADING_STEPS,
  STEP_NOS,
  STEP_TITLES,
  SUB_STEP_LABELS,
  CONTRACT_ATTACHMENT_LABELS,
  DEFERRED_STEP_TEXT,
  attachmentStatus,
  blockingAttachmentKinds,
  containerIdentityOk,
  contractStepState,
  documentItems,
  effectiveRevision,
  itemState,
  missingAttachmentKinds,
  requiredDocumentLabel,
  stepState,
  subStepState,
  shippingInstructionState,
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
  /** Bước 1 chỉ còn hồ sơ "bổ sung sau" ⇒ "chờ HĐ ký" / "chờ L/C" (ba-spec 58 R5); bước tiếp tính từ bước 2. */
  contractNote: string;
}

const settled = (s: ExportItemState) => s === "done" || s === "not-applicable";

export function shipmentProgress(d: ExportData, s: ExportShipment, opts: EvidenceOptions): ShipmentProgress {
  const steps = Object.fromEntries(
    STEP_NOS.map((n) => [n, n === 1 ? contractStepState(d, s.contractId, opts) : stepState(d, s, n, opts)]),
  ) as Record<StepNo, ExportItemState>;
  const core: StepNo[] = [1, 2, 3, 4, 5];
  // Bước 1 chỉ chờ hồ sơ "bổ sung sau" ⇒ không chặn: bước tiếp tìm từ bước 2, chữ chờ ghi kèm (ba-spec 58 R5).
  const deferredOnly =
    !settled(steps[1]) && !!effectiveRevision(d, s.contractId) && !blockingAttachmentKinds(d, s.contractId, opts).length;
  const next = core.find((n) => !settled(steps[n]) && !(n === 1 && deferredOnly)) ?? null;
  const missing = next ? stepMissing(d, s, next) : [];
  const contractNote = deferredOnly ? stepMissing(d, s, 1).join(", ") : "";
  return { steps, next, missing, settledCount: core.filter((n) => settled(steps[n])).length, contractNote };
}

/** Những mục còn thiếu của MỘT bước (bước đã xong ⇒ rỗng). Câu chữ người dùng đọc. */
export function stepMissing(d: ExportData, s: ExportShipment, n: StepNo): string[] {
  switch (n) {
    case 1:
      // Bước 1 = HĐ có bản hiệu lực + đủ hồ sơ đính kèm (không còn bước duyệt HĐ — 2026-10-29).
      return effectiveRevision(d, s.contractId)
        ? missingAttachmentKinds(d, s.contractId).map((k) =>
            // "Bổ sung sau" (ba-spec 58 R5): bước đang làm, ghi "chờ HĐ ký" / "chờ L/C" — không chặn các bước sau.
            attachmentStatus(d, s.contractId, k) === "deferred" ? (DEFERRED_STEP_TEXT[k] ?? `chờ ${CONTRACT_ATTACHMENT_LABELS[k]}`) : `hồ sơ HĐ: ${CONTRACT_ATTACHMENT_LABELS[k]}`,
          )
        : ["bản hợp đồng có hiệu lực"];
    case 2:
      return ["lệnh sản xuất"];
    case 3:
      return ["bao bì"];
    case 4: {
      // Cùng trình tự với khối Đóng cont: lệnh xuất → số cont + seal → sơ đồ → hình ảnh → tờ khai.
      const out = LOADING_STEPS.filter((st) => !settled(subStepState(d, s.id, st))).map((st) => SUB_STEP_LABELS[st].toLowerCase());
      if (!containerIdentityOk(s)) out.splice(out[0] === SUB_STEP_LABELS["export-order"].toLowerCase() ? 1 : 0, 0, s.kind === "truck" ? "biển số xe" : "số cont + seal");
      // SI ngay sau số cont + seal (ba-spec 72 R10 v1.2) — cùng thứ tự với khối Đóng cont.
      if (d.shippingInstructionEnabled && !settled(shippingInstructionState(d, s))) {
        const after = [s.kind === "truck" ? "biển số xe" : "số cont + seal", SUB_STEP_LABELS["export-order"].toLowerCase()].map((l) => out.indexOf(l)).find((i) => i >= 0);
        out.splice(after == null ? 0 : after + 1, 0, "SI");
      }
      return out;
    }
    case 5: {
      const items = documentItems(d, s.id);
      return items.length
        ? items.filter((i) => !settled(itemState(d, i))).map((i) => requiredDocumentLabel({ kind: i.docKind, form: i.docForm, issuer: "" }, d.documentKinds))
        : ["mục chứng từ"];
    }
    case 6:
      return [];
  }
}

/** "Bước tiếp: Đóng cont — còn hình ảnh đóng cont, tờ khai" / "Khép kín". */
export function progressText(p: ShipmentProgress): string {
  if (p.next === null) return p.contractNote ? `Đủ hồ sơ — ${p.contractNote}` : "Đủ hồ sơ — xong bước 1–5";
  const head = `Bước tiếp: ${STEP_TITLES[p.next - 1]}`;
  // "Bước tiếp: Lệnh sản xuất — còn lệnh sản xuất" chỉ lặp tên bước (nhãn v5 e) ⇒ bỏ phần sau.
  const note = p.contractNote ? ` · ${p.contractNote}` : "";
  if (!p.missing.length || (p.missing.length === 1 && p.missing[0] === STEP_TITLES[p.next - 1].toLowerCase())) return head + note;
  const shown = p.missing.slice(0, 2).join(", ");
  return `${head} — còn ${shown}${p.missing.length > 2 ? ` và ${p.missing.length - 2} mục khác` : ""}${note}`;
}

/** Màu thẻ trạng thái hợp đồng — mọi màn dùng chung. */
export const CONTRACT_STATE_TAG: Record<ContractState, TagVariant> = {
  attaching: "warning",
  shipping: "source",
  "final-review": "pending",
  closed: "done",
  cancelled: "muted",
};

