// ============================================================
// Tên file: src/lib/contractValidity.ts
// Tên tiếng Việt: Hạn hợp đồng — kiểm lúc lưu, nhắc lệch hạn giao, trạng thái hết hạn / sắp hết hạn
// Description: Pure rules of ba-spec 69 for the export contract validity date (`terms.contractValidUntil`,
//              the "binding on from date of signing to …" date — not the latest shipment date).
// ============================================================
import { formatDateVN } from "./format";

/** Còn ≤ chừng này ngày ⇒ "sắp hết hạn" (ba-spec 69 A2). */
export const VALIDITY_SOON_DAYS = 30;

const dayNo = (iso: string) => Math.floor(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);

/** R2: hạn HĐ có thì phải ≥ ngày ký. Trả câu lỗi, hợp lệ ⇒ "". */
export function validityError(signedOn: string, validUntil: string | undefined): string {
  if (!validUntil || !signedOn) return "";
  return validUntil < signedOn ? `Hạn hợp đồng ${formatDateVN(validUntil)} trước ngày ký ${formatDateVN(signedOn)}.` : "";
}

/** R3: hạn giao muộn nhất sau hạn HĐ ⇒ câu nhắc (không chặn). */
export function validityWarning(latestShipmentDate: string, validUntil: string | undefined): string {
  if (!validUntil || !latestShipmentDate || latestShipmentDate <= validUntil) return "";
  return `Hạn giao muộn nhất (${formatDateVN(latestShipmentDate)}) sau hạn hợp đồng (${formatDateVN(validUntil)}) — kiểm lại hợp đồng hoặc ghi phụ lục gia hạn.`;
}

export type ValidityState = { kind: "none" } | { kind: "ok" } | { kind: "soon"; days: number } | { kind: "expired"; days: number };

/** R4: trạng thái hạn của HĐ đang chạy. HĐ đã đóng / hủy hoặc không có hạn ⇒ none. */
export function validityState(validUntil: string | undefined, today: string, contractOpen: boolean): ValidityState {
  if (!validUntil || !contractOpen) return { kind: "none" };
  const days = dayNo(validUntil) - dayNo(today);
  if (days < 0) return { kind: "expired", days: -days };
  return days <= VALIDITY_SOON_DAYS ? { kind: "soon", days } : { kind: "ok" };
}

/** Chữ ngắn của trạng thái hạn cho hồ sơ HĐ: "Đã hết hạn" · "Còn n ngày" · "". */
export const validityLabel = (s: ValidityState) => (s.kind === "expired" ? "Đã hết hạn" : s.kind === "soon" ? `Còn ${s.days} ngày` : "");
