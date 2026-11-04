// ba-spec 72 AC-1, AC-2, AC-3, AC-5 — Lệnh xuất hàng: dòng hàng từ LSX / Hàng của chuyến, "Có" phải ghi rõ, khuôn Word.
import { describe, expect, it } from "vitest";
import type { ExportContractLine, ExportShipment, ExportShipmentLine, ProductionOrder, ProductionOrderLine } from "@/types";
import { checkTemplateTags, prefill, validateComposed } from "../documentComposer";
import { docxPlainText, fillDocx, readTemplateTags } from "../docxTemplate";
import { buildExportOrderRows, exportOrderForm, exportOrderMissingDetails, exportOrderTemplateData, workshopLine } from "./exportOrderForm";
import { buildExportOrderTemplate } from "./exportOrderTemplate";

const shipment = (over: Partial<ExportShipment> = {}): ExportShipment => ({
  id: "s1",
  contractId: "c1",
  planMonth: "2026-11",
  kind: "20RF",
  goodsSummary: "",
  plannedKg: null,
  lotCode: "006",
  portOfDischarge: "Tokyo, Japan",
  bookingNo: "SGNGCM332800",
  loadingDate: "2026-11-02",
  etd: "2026-11-05",
  eta: "2026-11-11",
  vesselVoyage: "BANGKOK BRIDGE 0518E(JTI)",
  containerNo: "",
  sealNo: "",
  status: "open",
  cancelReason: "",
  note: "",
  createdAt: "2026-11-01T00:00:00Z",
  booking: {
    forwarder: "",
    placeOfReceipt: "",
    portOfLoading: "",
    placeOfDelivery: "",
    returnYard: "",
    emptyPickupYard: "",
    docCutoff: "2026-11-03T10:00",
    vgmCutoff: "2026-11-03T19:00",
    cargoCutoff: "2026-11-04T19:00",
  },
  ...over,
});

const cl = (id: string, size: string, hsCode: string) => ({ id, size, hsCode }) as ExportContractLine;
const order = (over: Partial<ProductionOrder> = {}) =>
  ({ id: "o1", status: "issued", lotCode: "181", productionDates: ["2026-10-14", "2026-10-12"], shelfLifeMonths: 24, ...over }) as ProductionOrder;
const oline = (lineNo: number, contractLineId: string, units: number, kg: number) =>
  ({ id: `ol${lineNo}`, orderId: "o1", lineNo, contractLineId, productName: `Bạch tuộc ${lineNo}`, description: "", unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: 10, units, kg }) as ProductionOrderLine;

describe("buildExportOrderRows", () => {
  it("AC-1: dòng từ LSX đã phát hành — MSL, ngày SX, hạn, size + HS theo dòng HĐ", () => {
    const rows = buildExportOrderRows({
      shipment: shipment(),
      orders: [order()],
      orderLines: [oline(2, "cl2", 390, 3900), oline(1, "cl1", 400, 4000)],
      contractLines: [cl("cl1", "2-3 gr/pc", "0307.52"), cl("cl2", "3-5 gr/pc", "0307.52")],
      shipmentLines: [],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ productName: "Bạch tuộc 1", size: "2-3 gr/pc", cartons: 400, kg: 4000, lotCode: "181", hsCode: "0307.52" });
    expect(rows[0].productionDates).toBe("12, 14/10/2026");
    expect(rows[0].expiry).toBe("01/10/2028");
  });

  it("LSX chưa phát hành không tính", () => {
    const rows = buildExportOrderRows({ shipment: shipment(), orders: [order({ status: "draft" as ProductionOrder["status"] })], orderLines: [oline(1, "cl1", 1, 1)], contractLines: [], shipmentLines: [] });
    expect(rows).toHaveLength(0);
  });

  it("AC-2: không có LSX ⇒ Hàng của chuyến, MSL = mã lô chuyến, ngày SX trống", () => {
    const line = (i: number): ExportShipmentLine =>
      ({ id: `l${i}`, shipmentId: "s1", contractId: "c1", sortOrder: i, contractLineId: "cl1", description: `Hàng ${i}`, size: "", unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: 10, plannedUnits: 100, loadedUnits: null, expiry: "2028.01" }) as ExportShipmentLine;
    const rows = buildExportOrderRows({ shipment: shipment(), orders: [], orderLines: [], contractLines: [cl("cl1", "S", "0307")], shipmentLines: [line(3), line(1), line(2), { ...line(4), shipmentId: "khác" }] });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.productionDates === "" && r.lotCode === "006")).toBe(true);
    expect(rows[0]).toMatchObject({ productName: "Hàng 1", size: "S", cartons: 100, kg: 1000, expiry: "2028.01" });
  });
});

describe("ô Lệnh xuất", () => {
  const src = { shipment: shipment(), contractNo: "18.26", customerName: "SCM", rows: [{ productName: "A", size: "S", cartons: 10, kg: 100, lotCode: "181", productionDates: "", expiry: "", hsCode: "" }] };

  it("AC-3: chọn Có mà chưa ghi rõ ⇒ đúng một mục báo thiếu", () => {
    const st = prefill(exportOrderForm, src, null);
    const values = { ...st.values, orderNo: "LXH 01", samples: "Có" };
    expect(exportOrderMissingDetails(values)).toEqual(["Hàng mẫu"]);
    expect(validateComposed(exportOrderForm, values)).toEqual(["samplesNote"]);
    expect(validateComposed(exportOrderForm, { ...values, samplesNote: "2 thùng mẫu" })).toEqual([]);
  });

  it("thông tin giao hàng lấy theo chuyến + booking", () => {
    const v = prefill(exportOrderForm, src, null).values;
    expect(v).toMatchObject({ containers: "1 x 20RF", loadingDate: "2026-11-02", docCutoff: "03/11/2026 10:00", cargoCutoff: "04/11/2026 19:00", dischargePort: "Tokyo, Japan", etd: "05/11/2026" });
  });

  it("phân xưởng nhận", () => {
    expect(workshopLine({ toDong: true, toCa: true, toKho: false })).toBe("PHÂN XƯỞNG ĐÔNG, CÁ");
    expect(workshopLine({})).toBe("PHÂN XƯỞNG ……");
  });

  it("AC-5: khuôn gốc đủ thẻ; điền ra file có tiêu đề, mã mẫu, dòng hàng, tổng, cut-off", () => {
    const tpl = buildExportOrderTemplate();
    expect(checkTemplateTags(exportOrderForm, readTemplateTags(tpl)).ok).toBe(true);
    const values = {
      ...prefill(exportOrderForm, { ...src, rows: [...src.rows, { ...src.rows[0], productName: "B", cartons: 5, kg: 50 }] }, null).values,
      orderNo: "LXH 02.01",
      toDong: true,
      samples: "Có",
      samplesNote: "2 thùng",
    };
    const text = docxPlainText(fillDocx(tpl, exportOrderTemplateData(values)));
    for (const s of ["LỆNH XUẤT HÀNG", "QTI-KH-01-07", "LXH 02.01", "PHÂN XƯỞNG ĐÔNG", "10 thùng / 100 kg", "15 thùng / 150 kg", "03/11/2026 10:00", "Có: 2 thùng", "CÔNG TY TNHH BASEAFOOD 1"])
      expect(text).toContain(s);
    expect(text).not.toMatch(/\{[a-zA-Z#/.]+\}/);
  });
});
