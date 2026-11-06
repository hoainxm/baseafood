// Phòng KH (chị Thảo) 2026-11-06: "chỗ chứng từ muốn bỏ chứng từ đó đi khỏi list thì làm sao" — chuyến không có loại
// chứng từ đó. Chủ dự án: nút Xóa nằm trong hộp Cập nhật (như mọi chỗ xóa của hệ thống), không làm nút riêng ở hàng.
import { describe, expect, it } from "vitest";
import type { ExportContractTerms, ExportStepItem } from "@/types";
import { EMPTY_EXPORT_DATA, blankItem, deleteDocumentGate, isRemovedDocumentItem, newlyRequiredDocumentItems, type ExportData } from "./exportPlanning";

const T0 = "2026-11-06T00:00:00.000Z";
const doc = (id: string, kind: ExportStepItem["docKind"], over: Partial<ExportStepItem> = {}): ExportStepItem => ({ ...blankItem("s1", "document", id, T0), docKind: kind, ...over });
const data = (items: ExportStepItem[]): ExportData => ({ ...EMPTY_EXPORT_DATA, items });
type Terms = Pick<ExportContractTerms, "requiredDocuments" | "incoterm">;
const terms = (kinds: [ExportStepItem["docKind"], string][]): Terms => ({ incoterm: "CFR", requiredDocuments: kinds.map(([kind, form]) => ({ kind, form, issuer: "" })) }) as Terms;

describe("xóa chứng từ chuyến không có", () => {
  it("chứng từ HĐ yêu cầu (C/O VJ, H/C) xóa được khi chưa Xong; chặn Commercial Invoice · mục Xong · mục dùng chung", () => {
    const co = doc("co", "certificate-of-origin", { docForm: "VJ", note: "khách không cần" });
    expect(deleteDocumentGate(data([co]), co)).toEqual({ ok: true });
    const ci = doc("ci", "commercial-invoice");
    expect(deleteDocumentGate(data([ci]), ci)).toMatchObject({ ok: false, reason: "invoice" });
    const bl = doc("bl", "bill-of-lading", { state: "done", number: "BL-1" });
    expect(deleteDocumentGate(data([bl]), bl)).toMatchObject({ ok: false, reason: "done" });
    const pl = doc("pl", "packing-list", { sharedFromId: "x" });
    expect(deleteDocumentGate(data([pl]), pl)).toMatchObject({ ok: false, reason: "shared" });
    const step = blankItem("s1", "packaging", "p", T0);
    expect(deleteDocumentGate(data([step]), step)).toMatchObject({ ok: false, reason: "not-document" });
  });

  it("lưu bản sửa HĐ: chứng từ đã yêu cầu từ trước mà chuyến đã xóa ⇒ không tự thêm lại; chứng từ MỚI yêu cầu ⇒ thêm", () => {
    const before = terms([["commercial-invoice", ""], ["certificate-of-origin", "VJ"]]);
    const after = terms([["commercial-invoice", ""], ["certificate-of-origin", "VJ"], ["health-certificate", ""]]);
    // Chuyến đã xóa C/O, chỉ còn invoice.
    const existing = [doc("ci", "commercial-invoice")];
    const added = newlyRequiredDocumentItems("s1", before, after, existing, () => "new");
    expect(added.map((i) => i.docKind)).toEqual(["health-certificate"]);
    // HĐ không đổi chứng từ ⇒ không thêm gì.
    expect(newlyRequiredDocumentItems("s1", before, before, existing, () => "new")).toEqual([]);
    // Chưa có bản trước (HĐ mới) ⇒ đủ mục như luật cũ.
    expect(newlyRequiredDocumentItems("s1", null, before, [], () => "new").map((i) => i.docKind)).toEqual(["commercial-invoice", "certificate-of-origin"]);
  });

  it("mục bỏ bằng nút cũ (dấu ⟦removed⟧, 06/11) vẫn nhận ra để ẩn; Không áp dụng thường không bị ẩn", () => {
    expect(isRemovedDocumentItem(doc("hc", "health-certificate", { state: "not-applicable", naReason: "⟦removed⟧ Chuyến này không có chứng từ này" }))).toBe(true);
    expect(isRemovedDocumentItem(doc("na", "health-certificate", { state: "not-applicable", naReason: "khách tự làm" }))).toBe(false);
  });
});
