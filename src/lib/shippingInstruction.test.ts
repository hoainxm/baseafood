// ba-spec 72 AC-8…AC-12 — SI: bắt buộc theo loại chuyến, chuyến cũ không tụt, ô tự điền, nhớ theo khách, file Excel.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ComposedDocument, ExportContractLine, ExportFile, ExportShipment, ExportShipmentLine, ExportStepItem } from "@/types";
import { EMPTY_EXPORT_DATA, blankItem, containerSealPhotoRequired, containerSealState, shippingInstructionExemption, shippingInstructionState, stepState, type ExportData } from "./exportPlanning";
import { stepMissing } from "@/features/export-planning/progress";
import { initialSi, newSiDocument, previousSiOf, siGoodsRows, siLinked, siToValues, siTotals, splitVesselVoyage } from "./shippingInstruction";
import { shippingInstructionBytes } from "./shippingInstructionExcel";

const ship = (over: Partial<ExportShipment> = {}): ExportShipment => ({
  id: "s1",
  contractId: "c1",
  planMonth: "2026-11",
  kind: "20RF",
  goodsSummary: "",
  plannedKg: null,
  lotCode: "006",
  portOfDischarge: "Tokyo, Japan",
  bookingNo: "SGNGCM332800",
  loadingDate: "",
  etd: "",
  eta: "",
  vesselVoyage: "BANGKOK BRIDGE 0518E(JTI)",
  containerNo: "TCLU1234567",
  sealNo: "SL001",
  status: "open",
  cancelReason: "",
  note: "",
  createdAt: "2026-11-10T00:00:00Z",
  ...over,
});
const file = (shipmentId: string, step: ExportFile["step"], stepItemId = ""): ExportFile => ({
  id: `f-${step}-${shipmentId}`,
  contractId: "c1",
  shipmentId,
  stepItemId,
  step,
  path: "p",
  fileName: "x",
  layerNo: null,
  caption: "",
  uploadedBy: "a",
  createdAt: "2026-11-01",
});
const doneItem = (s: string, step: ExportStepItem["step"]): ExportStepItem => ({ ...blankItem(s, step, `i-${step}-${s}`, "2026-11-01"), state: "done", number: "TK1" });

describe("mục SI của bước 4", () => {
  it("AC-8: cont lạnh bắt buộc; xe tải / đóng ghép Không áp dụng", () => {
    const d = { ...EMPTY_EXPORT_DATA, shipments: [] };
    expect(shippingInstructionState(d, ship())).toBe("not-started");
    expect(shippingInstructionState(d, ship({ kind: "truck" }))).toBe("not-applicable");
    expect(shippingInstructionState(d, ship({ kind: "consolidated" }))).toBe("not-applicable");
    expect(shippingInstructionState({ ...d, files: [file("s1", "shipping-instruction")] }, ship())).toBe("done");
  });

  it("AC-9: chuyến cũ đã xong bước 4 không tụt; chuyến mới cùng tình trạng thì vẫn thiếu SI", () => {
    const build = (createdAt: string): ExportData => {
      const s = ship({ createdAt });
      const items = [doneItem("s1", "export-order"), doneItem("s1", "customs-declaration")];
      return {
        ...EMPTY_EXPORT_DATA,
        shipments: [s],
        items,
        files: [file("s1", "export-order", items[0].id), file("s1", "customs-declaration", items[1].id), file("s1", "loading-plan"), file("s1", "loading-photos")],
        shippingInstructionEnabled: true,
      };
    };
    const old = build("2026-10-20T00:00:00Z");
    expect(stepState(old, old.shipments[0], 4)).toBe("done");
    const fresh = build("2026-11-10T00:00:00Z");
    expect(stepState(fresh, fresh.shipments[0], 4)).toBe("in-progress");
    // Lý do hiện trên hàng SI; chuyến cũ vẫn lập SI được — có file ⇒ Xong.
    expect(shippingInstructionExemption(old, old.shipments[0])).toBe("old-loading");
    expect(shippingInstructionExemption(fresh, fresh.shipments[0])).toBeNull();
    expect(shippingInstructionExemption(old, ship({ kind: "truck" }))).toBe("kind");
    const withSi = { ...old, files: [...old.files, file("s1", "shipping-instruction")] };
    expect(shippingInstructionState(withSi, withSi.shipments[0])).toBe("done");
    // Có B/L Xong (chưa xong bước 4 cũ) ⇒ lý do B/L.
    const blOnly: ExportData = {
      ...EMPTY_EXPORT_DATA,
      shipments: [ship({ createdAt: "2026-10-20T00:00:00Z" })],
      items: [{ ...blankItem("s1", "document", "bl", "2026-10-21"), docKind: "bill-of-lading", state: "done" }],
      shippingInstructionEnabled: true,
    };
    expect(shippingInstructionExemption(blOnly, blOnly.shipments[0])).toBe("old-bl");
    // Máy chủ chưa chạy 0103 ⇒ SI chưa là mục của bước 4.
    expect(stepState({ ...fresh, shippingInstructionEnabled: false }, fresh.shipments[0], 4)).toBe("done");
  });
});

describe("ô SI tự điền", () => {
  it("tách tàu / chuyến", () => {
    expect(splitVesselVoyage("BANGKOK BRIDGE 0518E(JTI)")).toEqual({ vessel: "BANGKOK BRIDGE", voyage: "0518E(JTI)" });
    expect(splitVesselVoyage("EVER GIVEN")).toEqual({ vessel: "EVER GIVEN", voyage: "" });
  });

  it("AC-10: gross = kg cả bì × số kiện; tổng kiện; thiếu kg cả bì ⇒ cảnh báo đúng dòng", () => {
    const line = (i: number, gross: number | null, planned: number, loaded: number | null = null) =>
      ({ id: `l${i}`, shipmentId: "s1", contractId: "c1", sortOrder: i, contractLineId: "cl1", description: `OCTOPUS ${i}`, grossKgPerUnit: gross, plannedUnits: planned, loadedUnits: loaded }) as ExportShipmentLine;
    const cls = [{ id: "cl1", hsCode: "0307.52", description: "OCTOPUS" }] as ExportContractLine[];
    const { rows, warnings } = siGoodsRows("s1", [line(1, 11, 999, 400), line(2, 21.5, 390)], cls);
    expect(rows.map((r) => r.grossKg)).toEqual([4400, 8385]);
    expect(siTotals(rows)).toEqual({ packages: 790, grossKg: 12785 });
    expect(rows[0].hsCode).toBe("0307.52");
    expect(warnings).toHaveLength(0);
    expect(siGoodsRows("s1", [line(1, null, 10)], cls).warnings).toHaveLength(1);
    const l = siLinked(ship({ booking: { forwarder: "", placeOfReceipt: "Cái Mép", portOfLoading: "Cái Mép", placeOfDelivery: "Tokyo, Japan", returnYard: "", emptyPickupYard: "", docCutoff: "", vgmCutoff: "", cargoCutoff: "" } }), {
      nameEn: "BASEAFOOD 1 COMPANY LIMITED",
      addressEn: "321 TRAN XUAN DO STREET, QUARTER 2, BA RIA WARD, HO CHI MINH CITY, VIETNAM",
    });
    expect(l).toMatchObject({ vessel: "BANGKOK BRIDGE", voyage: "0518E(JTI)", sizeType: "20' RF", portOfLoading: "Cái Mép" });
    expect(l.shipper).toHaveLength(3);
  });

  it("AC-11: nhớ theo SI gần nhất của cùng khách; khách khác chỉ có consignee", () => {
    const prevValues = siToValues({
      ...initialSi({ saved: null, previous: null, customer: { name: "K" }, goods: [], today: "2026-10-01" }),
      notifyParty: "ABC",
      blRelease: "SURRENDER",
    });
    const docs: ComposedDocument[] = [
      newSiDocument({ id: "old", lotCode: "" }, "", "K", prevValues, { id: "d1", by: "a", at: "2026-10-01T00:00:00Z" }),
      newSiDocument({ id: "older", lotCode: "" }, "", "K", { ...prevValues, notifyParty: "CŨ" }, { id: "d0", by: "a", at: "2026-09-01T00:00:00Z" }),
    ];
    const si = initialSi({ saved: null, previous: previousSiOf(docs, "k", "s1"), customer: { name: "K" }, goods: [], today: "2026-11-04" });
    expect(si.notifyParty).toBe("ABC");
    expect(si.blRelease).toBe("SURRENDER");
    const other = initialSi({ saved: null, previous: previousSiOf(docs, "Khác", "s1"), customer: { name: "Khác", address: "Tokyo" }, goods: [], today: "2026-11-04" });
    expect(other.notifyParty).toBe("");
    expect(other.consignee).toBe("Khác\nTokyo");
  });
});

describe("AC-12: file Excel đúng mẫu", () => {
  it("giữ 47 ô gộp, đánh X đúng ô, tổng = tổng dòng", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const tpl = fs.readFileSync(path.join(__dirname, "templates/si-form.xlsx"));
    const f = {
      ...initialSi({ saved: null, previous: null, customer: { name: "SCM CO., LTD", address: "Tokyo, Japan" }, goods: [], today: "2026-11-04" }),
      cbm: "28,5",
      goods: [
        { description: "FROZEN OCTOPUS", hsCode: "0307.52", packages: 400, grossKg: 4400 },
        { description: "FROZEN BABY OCTOPUS", hsCode: "0307.52", packages: 390, grossKg: 8385 },
      ],
    };
    const l = siLinked(ship(), { nameEn: "BASEAFOOD 1 COMPANY LIMITED", addressEn: "321 TRAN XUAN DO STREET" });
    const bytes = await shippingInstructionBytes(tpl.buffer.slice(tpl.byteOffset, tpl.byteOffset + tpl.byteLength), l, f);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = wb.getWorksheet("SI Form")!;
    expect(Object.keys((ws as unknown as { _merges: Record<string, unknown> })._merges)).toHaveLength(47);
    expect(ws.getCell("G9").value).toBe("X"); // ORIGINAL
    expect(ws.getCell("H9").value).toBe("");
    expect(ws.getCell("G40").value).toBe("X"); // PREPAID
    expect(ws.getCell("G5").value).toBe("SGNGCM332800");
    expect(ws.getCell("A33").value).toBe("TCLU1234567");
    expect(ws.getCell("G33").value).toBe(400);
    expect((ws.getCell("G37").value as { result: number }).result).toBe(790);
    expect((ws.getCell("H37").value as { result: number }).result).toBe(12785);
    expect(ws.getCell("I33").value).toBe(28.5);
    expect(String(ws.getCell("F33").value)).toContain("HS CODE: 0307.52");
  });
});

describe("AC-6 (R8 v1.7): ảnh cont / seal bắt buộc mới Xong", () => {
  const d: ExportData = { ...EMPTY_EXPORT_DATA, shipments: [ship()], shippingInstructionEnabled: true };
  const photo = file("s1", "container-seal-photos");

  it("đủ số cont + seal, 0 ảnh ⇒ đang làm; thêm 1 ảnh ⇒ Xong", () => {
    expect(containerSealState(d, ship())).toBe("in-progress");
    expect(containerSealState({ ...d, files: [photo] }, ship())).toBe("done");
  });

  it("có ảnh mà chưa điền số ⇒ đang làm (số vẫn bắt buộc)", () => {
    expect(containerSealState({ ...d, files: [photo] }, ship({ containerNo: "", sealNo: "" }))).toBe("in-progress");
    expect(containerSealState(d, ship({ containerNo: "", sealNo: "" }))).toBe("not-started");
  });

  it("thiếu ảnh ⇒ bước 4 không Xong dù mọi mục khác xong; danh sách thiếu ghi ảnh cont / seal", () => {
    const st = (dd: ExportData) => stepState(dd, ship(), 4);
    expect(st(d)).not.toBe("done");
    expect(stepMissing(d, ship(), 4)).toContain("ảnh cont / seal");
    expect(stepMissing({ ...d, files: [photo] }, ship(), 4)).not.toContain("ảnh cont / seal");
  });

  it("không bắt ảnh: đóng ghép · máy chủ chưa chạy 0103 · chuyến cũ đã đóng xong", () => {
    expect(containerSealState(d, ship({ kind: "consolidated" }))).toBe("not-applicable");
    expect(containerSealState({ ...d, shippingInstructionEnabled: false }, ship())).toBe("done");
    const old = ship({ createdAt: "2026-10-20T00:00:00Z" });
    const items = [doneItem("s1", "export-order"), doneItem("s1", "customs-declaration")];
    const loaded: ExportData = {
      ...d,
      items,
      files: [file("s1", "export-order", items[0].id), file("s1", "customs-declaration", items[1].id), file("s1", "loading-plan"), file("s1", "loading-photos")],
    };
    expect(containerSealPhotoRequired(loaded, old)).toBe(false);
    expect(containerSealState(loaded, old)).toBe("done");
    // Chuyến cũ chưa đóng xong ⇒ vẫn bắt ảnh.
    expect(containerSealPhotoRequired(d, old)).toBe(true);
  });
});

describe("AC-4: xuất file Lệnh xuất ⇒ mục Xong", () => {
  it("file Word đủ bằng chứng để đánh Xong; mục lưu Xong ⇒ done", async () => {
    const { canMarkDone, subStepState } = await import("./exportPlanning");
    // Xuất Word ⇒ màn đặt mục Xong + đính file (ExportPlanningScreen.saveExportOrderFile).
    const item = { ...blankItem("s1", "export-order", "i-eo", "2026-11-04"), number: "LXH 01", state: "done" as const };
    const d = { ...EMPTY_EXPORT_DATA, shipments: [ship()], items: [item] };
    expect(canMarkDone(item, d).ok).toBe(false);
    const withFile = { ...d, files: [file("s1", "export-order", "i-eo")] };
    expect(canMarkDone(item, withFile).ok).toBe(true);
    expect(subStepState(withFile, "s1", "export-order")).toBe("done");
  });
});

describe("SI mở lại theo hợp đồng hiện tại (v1.5)", () => {
  it("sửa tên hàng ở HĐ ⇒ SI đã lưu lấy tên mới, giữ số kiện / gross đã gõ", () => {
    const line = { id: "l1", shipmentId: "s1", contractId: "c1", sortOrder: 1, contractLineId: "cl1", description: "OCTOPUS SAI TÊN", grossKgPerUnit: null, plannedUnits: 100, loadedUnits: null } as ExportShipmentLine;
    const oldCl = [{ id: "cl1", hsCode: "0307.52", description: "OCTOPUS SAI TÊN" }] as ExportContractLine[];
    const first = initialSi({ saved: null, previous: null, customer: { name: "K" }, goods: siGoodsRows("s1", [line], oldCl).rows, today: "2026-11-04" });
    const savedValues = siToValues({ ...first, goods: first.goods.map((g) => ({ ...g, grossKg: 1234 })) });
    const saved = newSiDocument({ id: "s1", lotCode: "" }, "", "K", savedValues, { id: "d", by: "a", at: "2026-11-04T00:00:00Z" });
    const newCl = [{ id: "cl1", hsCode: "0307.59", description: "FROZEN OCTOPUS" }] as ExportContractLine[];
    const again = initialSi({ saved, previous: null, customer: { name: "K" }, goods: siGoodsRows("s1", [line], newCl).rows, today: "2026-11-05" });
    expect(again.goods[0]).toMatchObject({ description: "FROZEN OCTOPUS", hsCode: "0307.59", packages: 100, grossKg: 1234 });
    expect(again.date).toBe("2026-11-04");
  });
});

describe("SI: gross mỗi kiện, tổng gross tự nhân (Phòng KH 2026-11-05)", () => {
  it("đổi gross mỗi kiện / số kiện ⇒ tổng = kiện × gross; gõ tổng ⇒ gross mỗi kiện tự chia", async () => {
    const { siRowWith } = await import("./shippingInstruction");
    const row = { contractLineId: "l1", description: "FROZEN INDIAN MACKEREL WHOLE ROUND", hsCode: "", packages: 1500, grossPerUnit: null, grossKg: null };
    const a = siRowWith(row, { grossPerUnit: 10.8 });
    expect(a.grossKg).toBe(16200);
    expect(siRowWith(a, { packages: 1400 }).grossKg).toBe(15120);
    expect(siRowWith(a, { grossKg: 15000 }).grossPerUnit).toBe(10);
    expect(siRowWith(a, { grossPerUnit: null }).grossKg).toBeNull();
  });
  it("bản lưu cũ chưa có gross mỗi kiện ⇒ suy từ tổng ÷ kiện", async () => {
    const { siFromValues } = await import("./shippingInstruction");
    const f = siFromValues({ goods: [{ description: "X", hsCode: "", packages: 700, grossKg: 7000 }] } as never);
    expect(f.goods[0].grossPerUnit).toBe(10);
  });
});
