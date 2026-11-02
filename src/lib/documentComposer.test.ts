// Oracle: docs/app-map/54-document-composer.ba-spec.md §10 — AC-1…3, 5…7, 9, 10, 12…15, 18 (+ phần hàm thuần của AC-4).
// AC-4 (đếm bảng), 8 (xem trước + PDF), 11 (RLS), 16 (demo), 17 (hướng dẫn) kiểm ở pha P2 / P3.
import { writeFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { ComposedDocument, ComposedDocumentExport, DocumentRow, DocumentTemplate, ProductionOrder, ProductionOrderLine } from "@/types";
import {
  activateTemplate,
  activeTemplateId,
  canEditComposed,
  checkTemplateTags,
  COMPOSED_STATUS_LABELS,
  composedStatus,
  editCell,
  editField,
  fieldDiffs,
  fieldSourceLabel,
  isSourceStale,
  makeExport,
  prefill,
  previousExportFor,
  refreshFromSource,
  replayExport,
  validateComposed,
  type DocumentTypeDef,
} from "./documentComposer";
import { buildDocx, docxPartXml, docxPlainText, fillDocx, readTemplateTags } from "./docxTemplate";
import { canComposeFromOrder, previousKeyOf, productionOrderForm, type ProductionOrderFormSource } from "./documentTypes/productionOrderForm";
import { buildProductionOrderTemplate, productionOrderTemplateXml } from "./documentTypes/productionOrderTemplate";
import { emptyRequirements } from "./productionOrder";

const T0 = "2026-10-01T00:00:00.000Z";

const order = (id: string, over: Partial<ProductionOrder> = {}): ProductionOrder => ({
  id,
  orderNo: "19.10",
  orderDate: "2026-10-27",
  contractId: "c1",
  contractRevisionId: "r0",
  contractNo: "01-26-HAT",
  customerName: "Matsuda Sangyo",
  market: "Nhật",
  lotCode: "205",
  productionDates: ["2026-11-02", "2026-11-03", "2026-11-04"],
  deliveryDate: "2026-11-15",
  shelfLifeMonths: 24,
  requirements: emptyRequirements(),
  note: "",
  status: "issued",
  issuedAt: T0,
  issuedBy: "KH",
  revisionNo: 0,
  revisionReason: "",
  cancelReason: "",
  staleAckRevisionId: "",
  staleAckReason: "",
  createdBy: "KH",
  createdAt: T0,
  ...over,
});

const oLine = (id: string, orderId: string, over: Partial<ProductionOrderLine> = {}): ProductionOrderLine => ({
  id,
  orderId,
  lineNo: 1,
  contractLineId: "l1",
  productId: "p-hat-luu",
  productName: "Bạch tuộc 1 da cắt hạt lựu",
  description: "Octopus diced",
  spec: "Size NL: 2.0-3.0 cm/Pc · 2KGS / BLOCK X 6 / CTN",
  unitKind: "carton",
  cartonsPerUnit: 1,
  netKgPerCarton: 12,
  units: 1000,
  kg: null,
  note: "",
  ...over,
});

const src = (o: ProductionOrder, lines: ProductionOrderLine[] = [oLine("ol1", o.id)]): ProductionOrderFormSource => ({ order: o, lines });
const LSX19 = src(order("o19"));

const composed = (id: string, s: ProductionOrderFormSource, values = prefill(productionOrderForm, s, null).values): ComposedDocument => {
  const k = previousKeyOf(s);
  return {
    id,
    docType: productionOrderForm.key,
    sourceType: "production-order",
    sourceId: s.order.id,
    sourceRef: s.order.orderNo,
    resource: "production-orders",
    values,
    fieldSources: {},
    sourceRevisionNo: 0,
    customerKey: k.customerKey,
    productIds: k.productIds,
    createdBy: "KH",
    createdAt: T0,
    updatedBy: "KH",
    updatedAt: T0,
  };
};

describe("AC-1 — điền sẵn từ lệnh (R2, R7)", () => {
  test("lệnh 19.10 ⇒ 9 ô từ lệnh, cách ghi như mẫu", () => {
    const { values, sources } = prefill(productionOrderForm, LSX19, null);
    const data = productionOrderForm.templateData(values);
    const rows = values.lines as DocumentRow[];
    expect(values.orderNo).toBe("19.10");
    expect(data.orderDate).toBe("Ngày 27 Tháng 10 Năm 2026");
    expect(rows).toHaveLength(1);
    expect(rows[0].cartons).toBe(1000);
    expect(rows[0].kg).toBe(12000);
    expect(values.lotCode).toBe("205");
    expect(values.productionDates).toBe("NSX: 02, 03, 04/11/2026");
    expect(data.deliveryDate).toBe("15/11/2026");
    expect(values.market).toBe("Nhật (Matsuda Sangyo)");
    expect(values.shelfLife).toBe("2 năm");
    for (const k of ["orderNo", "orderDate", "lines", "lotCode", "productionDates", "deliveryDate", "market", "shelfLife"]) expect(sources[k].kind).toBe("source");
    expect(fieldSourceLabel(productionOrderForm, sources.orderNo)).toBe("Từ lệnh");
  });
  test("hạn dùng lẻ tháng, ghi chú dòng xuống dòng dưới quy cách", () => {
    const s = src(order("o", { shelfLifeMonths: 18 }), [oLine("l", "o", { note: "Không dùng hàng da giấy" })]);
    const { values } = prefill(productionOrderForm, s, null);
    expect(values.shelfLife).toBe("18 tháng");
    expect((values.lines as DocumentRow[])[0].spec).toBe("Size NL: 2.0-3.0 cm/Pc · 2KGS / BLOCK X 6 / CTN\nKhông dùng hàng da giấy");
  });
});

describe("AC-2 — ô không ánh xạ lấy mặc định khi chưa có lần trước", () => {
  test("5 ô mặc định theo LSX 19.10", () => {
    const { values, sources } = prefill(productionOrderForm, LSX19, null);
    expect(values.cartonPrintColors).toBe("1");
    expect(values.cartonMfgFormat).toBe("yyyy/mm/dd");
    expect(values.bagMfgFormat).toBe("Không cần ghi");
    expect(values.peSealing).toBe("Không");
    expect(values.strapKind).toBe("Bình thường");
    for (const k of ["cartonPrintColors", "cartonMfgFormat", "bagMfgFormat", "peSealing", "strapKind"]) expect(sources[k].kind).toBe("default");
    expect(fieldSourceLabel(productionOrderForm, sources.peSealing)).toBe("Mặc định mẫu");
  });
  test("lệnh trống ô có ánh xạ ⇒ mặc định; Nafi từ lệnh", () => {
    const { values, sources } = prefill(productionOrderForm, LSX19, null);
    expect(values.process).toBe("Theo quy trình SX của Phòng Kỹ thuật.");
    expect(sources.process.kind).toBe("default");
    expect(values.nafiAntibiotic).toBe("Không");
    expect(sources.nafiAntibiotic.kind).toBe("source");
    const vs = src(order("o", { requirements: { ...emptyRequirements(), nafiTests: ["Vi sinh", "Khác"] } }));
    const v2 = prefill(productionOrderForm, vs, null).values;
    expect(v2.nafiMicro).toBe(true);
    expect(v2.nafiOther).toBe("Có");
  });
});

describe("AC-3 — chép từ lần xuất trước cùng khách + mặt hàng", () => {
  const s18 = src(order("o18", { orderNo: "18.10" }), [oLine("l18", "o18")]);
  const s17 = src(order("o17", { orderNo: "17.10", customerName: "Khách khác" }), [oLine("l17", "o17")]);
  const s16 = src(order("o16", { orderNo: "16.10" }), [oLine("l16", "o16")]);
  const withEdits = (s: ProductionOrderFormSource) => {
    let st = prefill(productionOrderForm, s, null);
    st = editField(st, "peSealing", "Có");
    st = editField(st, "cartonColor", "Xanh");
    return st.values;
  };
  const docs = [composed("d18", s18, withEdits(s18)), composed("d17", s17, withEdits(s17)), composed("d16", s16, withEdits(s16))];
  const exp = (docId: string, at: string): ComposedDocumentExport => makeExport(docs.find((d) => d.id === docId)!, "docx", productionOrderForm.builtinTemplateId, "KH", at, `e-${docId}`);
  const find = (exports: ComposedDocumentExport[]) =>
    previousExportFor(docs, exports, { docType: productionOrderForm.key, ...previousKeyOf(LSX19), excludeSourceId: "o19", isSourceLive: () => true });

  test("chỉ lần xuất của 18.10 được dùng", () => {
    const prev = find([exp("d18", "2026-10-20T00:00:00Z"), exp("d17", "2026-10-25T00:00:00Z")]);
    expect(prev?.ref).toBe("18.10");
    const { values, sources } = prefill(productionOrderForm, LSX19, prev);
    expect(values.peSealing).toBe("Có");
    expect(values.cartonColor).toBe("Xanh");
    expect(sources.peSealing).toEqual({ kind: "previous", ref: "18.10" });
    expect(fieldSourceLabel(productionOrderForm, sources.peSealing)).toContain("18.10");
    expect(values.orderNo).toBe("19.10");
  });
  test("18.10 chưa xuất ⇒ mặc định; bản soạn chưa xuất (16.10) không tính", () => {
    const prev = find([exp("d17", "2026-10-25T00:00:00Z")]);
    expect(prev).toBeNull();
    const { values, sources } = prefill(productionOrderForm, LSX19, prev);
    expect(values.peSealing).toBe("Không");
    expect(sources.peSealing.kind).toBe("default");
  });
  test("lệnh nguồn đã hủy không làm lần trước", () => {
    const prev = previousExportFor(docs, [exp("d18", "2026-10-20T00:00:00Z")], {
      docType: productionOrderForm.key,
      ...previousKeyOf(LSX19),
      excludeSourceId: "o19",
      isSourceLive: (id) => id !== "o18",
    });
    expect(prev).toBeNull();
  });
});

describe("AC-4 (phần hàm thuần) — sửa trên file ⇒ cờ Khác lệnh, lệnh giữ nguyên", () => {
  test("kg 12.000 → 11.500", () => {
    const st = editCell(prefill(productionOrderForm, LSX19, null), "lines", 0, "kg", 11500);
    expect(st.sources.lines.kind).toBe("manual");
    expect(fieldDiffs(productionOrderForm, st, LSX19)).toEqual([{ key: "lines", row: 0, column: "kg", sourceValue: 12000 }]);
    expect(LSX19.lines[0].kg).toBeNull();
    expect(LSX19.lines[0].units).toBe(1000);
    expect(productionOrderForm.labels.differs).toBe("Khác lệnh");
  });
});

describe("AC-5 — dòng Tổng theo số trên file (R6)", () => {
  test("600 + 400 thùng; sửa dòng 2 còn 300 thùng / 3.600 kg", () => {
    const s = src(order("o"), [oLine("a", "o", { units: 600 }), oLine("b", "o", { units: 400, lineNo: 2 })]);
    let st = prefill(productionOrderForm, s, null);
    let d = productionOrderForm.templateData(st.values);
    expect([d.totalCartons, d.totalKg]).toEqual(["1.000", "12.000"]);
    st = editCell(editCell(st, "lines", 1, "cartons", 300), "lines", 1, "kg", 3600);
    d = productionOrderForm.templateData(st.values);
    expect([d.totalCartons, d.totalKg]).toEqual(["900", "10.800"]);
    expect((d.lines as { stt: string; lotCode: string }[]).map((r) => [r.stt, r.lotCode])).toEqual([
      ["1", "205"],
      ["2", ""],
    ]);
  });
});

describe("AC-6 — thiếu ô bắt buộc thì không xuất (R5)", () => {
  test("market + deliveryDate trống ⇒ kê đủ 2 ô, theo thứ tự mẫu", () => {
    const st = prefill(productionOrderForm, src(order("o", { market: "", customerName: "", deliveryDate: "" })), null);
    expect(validateComposed(productionOrderForm, st.values)).toEqual(["deliveryDate", "market"]);
    expect(validateComposed(productionOrderForm, prefill(productionOrderForm, LSX19, null).values)).toEqual([]);
  });
  test("bảng 0 dòng hoặc dòng thiếu kg ⇒ thiếu lines", () => {
    expect(validateComposed(productionOrderForm, prefill(productionOrderForm, src(order("o"), []), null).values)).toEqual(["lines"]);
    const st = editCell(prefill(productionOrderForm, LSX19, null), "lines", 0, "kg", null);
    expect(validateComposed(productionOrderForm, st.values)).toEqual(["lines"]);
  });
});

describe("AC-7 — file Word đúng khuôn gốc (R7, R8)", () => {
  test("đủ chữ của mẫu, không sót thẻ, A4 dọc, tên file", () => {
    const { values } = prefill(productionOrderForm, LSX19, null);
    const file = fillDocx(buildProductionOrderTemplate(), productionOrderForm.templateData(values));
    const text = docxPlainText(file);
    for (const s of ["QTI-KH-01-04", "19.10", "1.000", "12.000", "205", "NSX: 02, 03, 04/11/2026", "15/11/2026", "Nhật (Matsuda Sangyo)", "Ngày 27 Tháng 10 Năm 2026"])
      expect(text).toContain(s);
    expect(text.match(/[{}]/g) ?? []).toHaveLength(0);
    expect(docxPartXml(file)).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
    expect(productionOrderForm.fileName(values)).toBe("LSX-19.10-Matsuda-Sangyo-20261027.docx");
    // Xuất bản điền số 19.10 cho Phòng KH duyệt hình (P0): DOCX_OUT=/đường/dẫn.docx npx vitest run documentComposer
    if (process.env.DOCX_OUT) writeFileSync(process.env.DOCX_OUT, file);
  });
  test("khuôn gốc có đủ thẻ của loại văn bản", () => {
    const check = checkTemplateTags(productionOrderForm, readTemplateTags(buildProductionOrderTemplate()));
    expect(check).toEqual({ ok: true, missingRequired: [], missingOptional: [], unknownTags: [] });
  });
});

describe("AC-9 — lịch sử xuất và trạng thái (R9, R10)", () => {
  test("Nháp → Word + PDF ⇒ Đã xuất → sửa ⇒ Sửa sau lần xuất", () => {
    let st = prefill(productionOrderForm, LSX19, null);
    const doc = composed("d", LSX19, st.values);
    expect(composedStatus(st.values, null)).toBe("draft");
    const e1 = makeExport(doc, "docx", productionOrderForm.builtinTemplateId, "KH", "2026-10-28T01:00:00Z", "e1");
    const e2 = makeExport(doc, "pdf", productionOrderForm.builtinTemplateId, "KH", "2026-10-28T02:00:00Z", "e2");
    const exports = [e1, e2];
    expect(exports.map((e) => e.format)).toEqual(["docx", "pdf"]);
    expect(e2.snapshot.orderNo).toBe("19.10");
    expect(e2.templateId).toBe("builtin:production-order-form");
    expect(composedStatus(st.values, e2)).toBe("exported");
    st = editField(st, "notes", "Đóng hàng lên cont theo ngày sản xuất thực tế HACCP");
    expect(composedStatus(st.values, e2)).toBe("edited-after-export");
    expect(e2.snapshot.notes).toBe("");
    expect(Object.values(COMPOSED_STATUS_LABELS)).toEqual(["Nháp", "Đã xuất", "Sửa sau lần xuất"]);
  });
});

describe("AC-10 — lệnh sửa sau khi soạn (R10)", () => {
  test("cờ cũ; lấy lại số từ lệnh giữ ô sửa tay", () => {
    let st = editField(prefill(productionOrderForm, LSX19, null), "cartonColor", "Đỏ");
    const revised = src(order("o19", { revisionNo: 1, deliveryDate: "2026-11-20" }));
    expect(isSourceStale(0, revised.order.revisionNo)).toBe(true);
    st = refreshFromSource(productionOrderForm, st, revised);
    expect(productionOrderForm.templateData(st.values).deliveryDate).toBe("20/11/2026");
    expect(st.values.cartonColor).toBe("Đỏ");
    expect(st.sources.cartonColor.kind).toBe("manual");
    expect(isSourceStale(revised.order.revisionNo, revised.order.revisionNo)).toBe(false);
  });
  test("ô ngày giao sửa tay thì lấy lại không đè, vẫn cờ Khác lệnh", () => {
    let st = editField(prefill(productionOrderForm, LSX19, null), "deliveryDate", "2026-11-18");
    const revised = src(order("o19", { revisionNo: 1, deliveryDate: "2026-11-20" }));
    st = refreshFromSource(productionOrderForm, st, revised);
    expect(st.values.deliveryDate).toBe("2026-11-18");
    expect(fieldDiffs(productionOrderForm, st, revised)).toEqual([{ key: "deliveryDate", sourceValue: "2026-11-20" }]);
  });
});

/** Khuôn gốc đã sửa chữ (thay / xóa thẻ) — giả một khuôn quản trị tải lên. */
const variant = (edit: (xml: string) => string) => buildDocx(edit(productionOrderTemplateXml()));

describe("AC-12 — kiểm thẻ khi tải khuôn (R13)", () => {
  test("A thiếu {deliveryDate} ⇒ từ chối; B thiếu {cartonColor}, thừa {foo} ⇒ nhận kèm cảnh báo", () => {
    const a = checkTemplateTags(productionOrderForm, readTemplateTags(variant((x) => x.replace("{deliveryDate}", ""))));
    expect(a.ok).toBe(false);
    expect(a.missingRequired).toEqual(["deliveryDate"]);
    const b = checkTemplateTags(productionOrderForm, readTemplateTags(variant((x) => x.replace("Màu: {cartonColor}", "Màu: {foo}"))));
    expect(b).toEqual({ ok: true, missingRequired: [], missingOptional: ["cartonColor"], unknownTags: ["foo"] });
  });
  test("đúng 1 khuôn đang dùng mỗi loại văn bản", () => {
    const t = (id: string, versionNo: number, status: DocumentTemplate["status"]): DocumentTemplate => ({
      id,
      docType: productionOrderForm.key,
      versionNo,
      fileName: `${id}.docx`,
      filePath: id,
      tags: [],
      status,
      uploadedBy: "admin",
      uploadedAt: T0,
    });
    const after = activateTemplate([t("v1", 1, "active"), t("v2", 2, "retired")], "v2");
    expect(after.filter((x) => x.status === "active").map((x) => x.id)).toEqual(["v2"]);
    expect(activeTemplateId(after, productionOrderForm.key)).toBe("v2");
  });
});

describe("AC-13 — tải lại đúng khuôn và giá trị lúc xuất (R14)", () => {
  test("lần xuất #1 giữ v1 + ảnh chụp; lần mới dùng v2", () => {
    let st = prefill(productionOrderForm, LSX19, null);
    const e1 = makeExport(composed("d", LSX19, st.values), "docx", "v1", "KH", "2026-10-28T01:00:00Z", "e1");
    st = editField(st, "notes", "Sửa sau");
    const e2 = makeExport(composed("d", LSX19, st.values), "docx", "v2", "KH", "2026-10-29T01:00:00Z", "e2");
    expect(replayExport(e1)).toEqual({ values: e1.snapshot, templateId: "v1" });
    expect(replayExport(e1).values.notes).toBe("");
    expect(e2.templateId).toBe("v2");
  });
});

describe("AC-14 — lệnh hủy (R11)", () => {
  test("không soạn mới, không sửa; tải lại vẫn được", () => {
    const cancelled = order("o", { status: "cancelled" });
    expect(canComposeFromOrder(cancelled)).toEqual({ ok: false, reason: "cancelled" });
    expect(canComposeFromOrder(order("o"))).toEqual({ ok: true });
    expect(canEditComposed(false)).toBe(false);
    const e = makeExport(composed("d", src(cancelled)), "docx", "builtin:production-order-form", "KH", T0, "e1");
    expect(replayExport(e).values.orderNo).toBe("19.10");
  });
});

describe("AC-15 — thêm loại văn bản không sửa bộ soạn (R1)", () => {
  type Memo = { title: string; day: string; items: { name: string; qty: number }[] };
  const memoType: DocumentTypeDef<Memo> = {
    key: "test-memo",
    name: "Phiếu thử",
    formCode: "TEST-01",
    sourceType: "memo",
    resource: "documents",
    labels: { source: "Từ phiếu", differs: "Khác phiếu", stale: "Phiếu đã sửa", sourceCancelled: "Phiếu đã hủy", previous: (r) => `Từ phiếu ${r}` },
    fields: [
      { key: "title", label: "Tiêu đề", group: "Đầu", kind: "text", required: true, mapped: true },
      { key: "day", label: "Ngày", group: "Đầu", kind: "date", mapped: true },
      { key: "items", label: "Hàng", group: "Bảng", kind: "table", mapped: true, columns: [{ key: "name", label: "Tên", kind: "text" }, { key: "qty", label: "SL", kind: "number" }] },
    ],
    templateTags: { required: ["title"], optional: ["day", "items", "items.name", "items.qty"] },
    sourceValues: (m) => ({ title: m.title, day: m.day, items: m.items.map((i) => ({ ...i })) }),
    templateData: (v) => v,
    fileName: () => "phieu.docx",
    builtinTemplateId: "builtin:test-memo",
  };
  const tpl = buildDocx(
    '<w:p><w:r><w:t xml:space="preserve">{title} — {day}</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">{#items}{name}: {qty};{/items}</w:t></w:r></w:p><w:sectPr/>',
  );
  test("điền sẵn, kiểm thiếu, sinh file bằng hàm chung", () => {
    const st = prefill(memoType, { title: "Phiếu A", day: "2026-10-31", items: [{ name: "Mực", qty: 2 }, { name: "Cá", qty: 3 }] }, null);
    expect(checkTemplateTags(memoType, readTemplateTags(tpl)).ok).toBe(true);
    const text = docxPlainText(fillDocx(tpl, memoType.templateData(st.values)));
    expect(text).toContain("Phiếu A — 2026-10-31");
    expect(text).toContain("Mực: 2;Cá: 3;");
    expect(validateComposed(memoType, editField(st, "title", "").values)).toEqual(["title"]);
  });
});

describe("AC-18 — chưa tải khuôn thì dùng khuôn gốc (R13)", () => {
  test("không có dòng khuôn ⇒ builtin", () => {
    expect(activeTemplateId([], productionOrderForm.key)).toBe("builtin:production-order-form");
    const e = makeExport(composed("d", LSX19), "docx", activeTemplateId([], productionOrderForm.key), "KH", T0, "e1");
    expect(e.templateId).toBe("builtin:production-order-form");
  });
});
