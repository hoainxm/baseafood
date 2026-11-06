// Phòng KH (chị Thảo) 2026-11-06: "chỗ chứng từ muốn bỏ chứng từ đó đi khỏi list thì làm sao" — loại chứng từ đó chuyến
// không có. Chứng từ HĐ yêu cầu trước chỉ đánh được Không áp dụng (vẫn nằm trong danh sách).
import { describe, expect, it } from "vitest";
import type { ExportContractTerms, ExportStepItem } from "@/types";
import {
  EMPTY_EXPORT_DATA,
  blankItem,
  isRemovedDocumentItem,
  missingDocumentItems,
  removeDocumentGate,
  removeDocumentItem,
  removedDocumentReason,
  restoreDocumentItem,
  itemState,
  type ExportData,
} from "./exportPlanning";

const T0 = "2026-11-06T00:00:00.000Z";
const doc = (id: string, kind: ExportStepItem["docKind"], over: Partial<ExportStepItem> = {}): ExportStepItem => ({ ...blankItem("s1", "document", id, T0), docKind: kind, ...over });
const terms = { requiredDocuments: [{ kind: "certificate-of-origin", form: "VJ", issuer: "" }, { kind: "expiry-list", form: "", issuer: "" }] } as Pick<ExportContractTerms, "requiredDocuments">;
const data = (items: ExportStepItem[]): ExportData => ({ ...EMPTY_EXPORT_DATA, items });

describe("bỏ chứng từ khỏi danh sách của chuyến", () => {
  it("chứng từ HĐ yêu cầu (C/O VJ) bỏ được: ẩn, tính Không áp dụng, giữ số / ghi chú; lưu bản sửa HĐ không thêm lại", () => {
    const co = doc("co", "certificate-of-origin", { docForm: "VJ", number: "CO-1", note: "hỏi lại khách" });
    const d = data([co, doc("ex", "expiry-list")]);
    expect(removeDocumentGate(d, co)).toEqual({ ok: true });
    const removed = removeDocumentItem(co);
    expect(isRemovedDocumentItem(removed)).toBe(true);
    expect(itemState(d, removed)).toBe("not-applicable");
    expect(removed.number).toBe("CO-1");
    expect(removed.note).toBe("hỏi lại khách");
    expect(removedDocumentReason(removed)).toBe("Chuyến này không có chứng từ này");
    expect(missingDocumentItems("s1", terms, [removed, doc("ex", "expiry-list")], () => "new")).toEqual([
      expect.objectContaining({ docKind: "commercial-invoice" }),
    ]);
  });

  it("ghi lý do riêng; Hiện lại ⇒ về Chưa làm, không còn dấu bỏ", () => {
    const ex = removeDocumentItem(doc("ex", "expiry-list"), "khách không cần");
    expect(removedDocumentReason(ex)).toBe("khách không cần");
    const back = restoreDocumentItem(ex);
    expect(isRemovedDocumentItem(back)).toBe(false);
    expect(back.state).toBe("not-started");
    expect(back.naReason).toBe("");
  });

  it("chặn: Commercial Invoice (thực xuất tính từ đây) · mục đã Xong · mục dùng chung · không phải chứng từ; Không áp dụng thường không bị coi là đã bỏ", () => {
    const ci = doc("ci", "commercial-invoice");
    expect(removeDocumentGate(data([ci]), ci)).toMatchObject({ ok: false, reason: "invoice" });
    const done = doc("bl", "bill-of-lading", { state: "done", number: "BL-1" });
    expect(removeDocumentGate(data([done]), done)).toMatchObject({ ok: false, reason: "done" });
    const shared = doc("pl", "packing-list", { sharedFromId: "x" });
    expect(removeDocumentGate(data([shared]), shared)).toMatchObject({ ok: false, reason: "shared" });
    const step = { ...blankItem("s1", "packaging", "p", T0) };
    expect(removeDocumentGate(data([step]), step)).toMatchObject({ ok: false, reason: "not-document" });
    expect(isRemovedDocumentItem(doc("na", "health-certificate", { state: "not-applicable", naReason: "khách tự làm" }))).toBe(false);
  });
});
