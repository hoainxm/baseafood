import { describe, expect, it } from "vitest";
import type { ImportShipment, MaterialImportItem, Packaging, SalesItem, WipProductionItem } from "@/types";
import { buildLabelPrintRecords, buildLotQrUrl, parseQrCode, listLotsToPrint, groupByTraceStage, assignSessionLots, listSelectableMaterialLots, findBatchesWithoutLot, formatMaterialLotLabel, buildLotNode, getDefaultLabelCount, summarizeLabelPrints, type TraceData } from "./lotTraceability";
import type { LabelPrint, LotInput, LotWaiver } from "@/types";

const makeShipment = (id: string, date: string, workshop: ImportShipment["workshop"], lotCode = ""): ImportShipment => ({
  id, deliveryDate: date, postingDate: date, backdateReason: "", workshop,
  supplierName: "Hồng Phú", driverName: "", licensePlate: "", note: "", lotCode,
});
const row = (shipmentId: string, date: string, kg: number, materialType: string): MaterialImportItem =>
  ({ id: `${shipmentId}-${materialType}`, shipmentId, deliveryDate: date, workshop: "Đông", quantityKg: kg, materialTypeName: materialType, category: materialType }) as MaterialImportItem;
const wip = (id: string, date: string, workshop: WipProductionItem["workshop"]): WipProductionItem => ({
  id, productionDate: date, postingDate: date, backdateReason: "", workshop, productId: "mh1",
  spec: "", quantityKg: 100, blocksCount: 0, warehouse: "", status: "pending" as WipProductionItem["status"], note: "",
});
const salesInvoice = (id: string, date: string): Packaging => ({
  id, date, workshop: "Đông", fromProductId: "mh1", fromSpec: "", inputKg: 50, inputBlocks: 0,
  toProductId: "mh2", toSpec: "", outputKg: 48, outputUnits: 4, warehouse: "", note: "",
});

const traceData: TraceData = {
  shipments: [makeShipment("s1", "2026-09-01", "Đông", "Đ-260901-01"), makeShipment("s2", "2026-09-03", "Cá"), makeShipment("s3", "2026-08-20", "Đông")],
  imports: [
    row("s1", "2026-09-01", 1000, "Mực ống"), row("s1", "2026-09-01", 200, "Bạch tuộc"),
    row("s2", "2026-09-03", 300, "Cá thu"), row("s3", "2026-08-20", 400, "Bạch tuộc"),
  ],
  wips: [wip("w1", "2026-09-02", "Đông")],
  packagings: [salesInvoice("p1", "2026-09-02")],
  lotInputs: [], exportItems: [], exportOrders: [], salesOrders: [], products: [], customers: [],
};

describe("listLotsToPrint", () => {
  it("lọc theo khoảng ngày + loại, mới trước, cùng ngày theo NL→BTP→TP; mỗi loại NL một lô", () => {
    const items = listLotsToPrint(traceData, { fromDate: "2026-09-01", toDate: "2026-09-30", workshop: "", kinds: ["S", "W", "P"] });
    expect(items.map((n) => `${n.kind}:${n.id}`)).toEqual(["S:s2-Cá thu", "W:w1", "P:p1", "S:s1-Bạch tuộc", "S:s1-Mực ống"]);
  });
  it("lọc theo xưởng và loại", () => {
    expect(listLotsToPrint(traceData, { fromDate: "2026-08-01", toDate: "2026-09-30", workshop: "Đông", kinds: ["S"] }).map((n) => n.id)).toEqual([
      "s1-Bạch tuộc", "s1-Mực ống", "s3-Bạch tuộc",
    ]);
    expect(listLotsToPrint(traceData, { fromDate: "2026-08-01", toDate: "2026-09-30", workshop: "", kinds: [] })).toEqual([]);
  });
  it("tem NL: mã lô chuyến + MỘT loại hàng + kg của loại đó", () => {
    const items = listLotsToPrint(traceData, { fromDate: "2026-09-01", toDate: "2026-09-01", workshop: "", kinds: ["S"] });
    expect(items.map((n) => [n.label, n.description, n.kg])).toEqual([
      ["Đ-260901-01", "Bạch tuộc", 200],
      ["Đ-260901-01", "Mực ống", 1000],
    ]);
  });
});

describe("formatMaterialLotLabel", () => {
  it("chuyến chưa có mã lô thì suy từ xưởng + ngày + đuôi id", () => {
    expect(formatMaterialLotLabel({ ...makeShipment("1787820268862-288016", "2026-08-26", "Đông") })).toBe("NĐ-260826-8016");
  });
});

describe("sổ in tem", () => {
  it("buildLabelPrintRecords: mỗi lô một dòng, nhãn đông cứng, bỏ lô đã mất", () => {
    let i = 0;
    const items = buildLabelPrintRecords([buildLotNode("S", "s1", traceData), buildLotNode("W", "w1", traceData), buildLotNode("W", "khong-co", traceData)], "Trúc", "2026-10-02T08:00:00Z", () => `id${++i}`);
    expect(items).toEqual([
      { id: "id1", lotKind: "S", lotId: "s1", label: "Đ-260901-01", copies: 1, operator: "Trúc", printedAt: "2026-10-02T08:00:00Z" },
      { id: "id2", lotKind: "W", lotId: "w1", label: items[1]!.label, copies: 1, operator: "Trúc", printedAt: "2026-10-02T08:00:00Z" },
    ]);
  });
  it("summarizeLabelPrints: gom theo lô, lấy lần in gần nhất", () => {
    const p = (id: string, lotId: string, luc: string, label = "A"): LabelPrint =>
      ({ id, lotKind: "S", lotId, label, copies: 1, operator: "", printedAt: luc });
    const m = summarizeLabelPrints([p("1", "s1", "2026-10-01", "cũ"), p("2", "s1", "2026-10-02", "mới"), p("3", "s2", "2026-10-01")]);
    expect(m.get("S:s1")).toMatchObject({ printCount: 2, labelCount: 2, lastPrint: { label: "mới" } });
    expect(m.get("S:s2")?.printCount).toBe(1);
    expect(m.has("W:s1")).toBe(false);
  });
});

describe("đợt 2b — chọn lô, chốt ngày, tem, gắn phiên", () => {
  const inputKg = (id: string, outputId: string, inputId: string, kg: number | null, luc: string) =>
    ({ id, outputKind: "W", outputId, inputKind: "S", inputId, inputLabel: "", material: "", quantityKg: kg, method: "picked", operator: "", recordedAt: luc }) as LotInput;

  it("listSelectableMaterialLots: lô cũ quá 45 ngày vẫn hiện nếu còn kg và đã vào thời truy xuất; lô cũ chưa từng theo dõi thì không", () => {
    const d: TraceData = {
      ...traceData,
      shipments: [makeShipment("moi", "2026-10-01", "Đông"), makeShipment("dong", "2026-07-10", "Đông"), makeShipment("xua", "2026-06-01", "Đông")],
      imports: [row("moi", "2026-10-01", 100, "Bạch tuộc"), row("dong", "2026-07-10", 500, "Bạch tuộc"), row("xua", "2026-06-01", 300, "Bạch tuộc")],
      lotInputs: [inputKg("a", "w1", "dong-Bạch tuộc", 200, "2026-07-11T08:00:00Z")],
    };
    expect(listSelectableMaterialLots(d, "Đông", "2026-10-05").map((n) => n.id)).toEqual(["moi-Bạch tuộc", "dong-Bạch tuộc"]);
    // dùng hết lô đông ⇒ thôi gợi ý
    const het = { ...d, lotInputs: [...d.lotInputs, inputKg("b", "w2", "dong-Bạch tuộc", 300, "2026-08-01T08:00:00Z")] };
    expect(listSelectableMaterialLots(het, "Đông", "2026-10-05").map((n) => n.id)).toEqual(["moi-Bạch tuộc"]);
  });

  it("listSelectableMaterialLots: cửa sổ 45 ngày tính theo NGÀY LỊCH, không lệch theo múi giờ máy (+07)", () => {
    const prevTz = process.env.TZ;
    process.env.TZ = "Asia/Ho_Chi_Minh";
    try {
      const d: TraceData = {
        ...traceData,
        shipments: [makeShipment("bien", "2026-08-24", "Đông"), makeShipment("ngoai", "2026-08-23", "Đông")],
        imports: [row("bien", "2026-08-24", 100, "Bạch tuộc"), row("ngoai", "2026-08-23", 100, "Bạch tuộc")],
      };
      // 08/10 lùi 45 ngày = 24/08: chuyến 24/08 nằm trong cửa sổ, 23/08 thì không.
      expect(listSelectableMaterialLots(d, "Đông", "2026-10-08").map((n) => n.id)).toEqual(["bien-Bạch tuộc"]);
    } finally {
      if (prevTz === undefined) delete process.env.TZ;
      else process.env.TZ = prevTz;
    }
  });

  it("findBatchesWithoutLot: mẻ có lô hoặc có lý do thì không còn thiếu", () => {
    const waivers = [{ outputKind: "W", outputId: "b" } as LotWaiver];
    const items = findBatchesWithoutLot([{ id: "a" }, { id: "b" }, { id: "c" }], [inputKg("x", "a", "s1", null, "")], waivers);
    expect(items.map((m) => m.id)).toEqual(["c"]);
  });

  it("getDefaultLabelCount: BTP theo số block, TP theo số thùng, NL 1 tem", () => {
    const d = { wips: [{ ...wip("w9", "2026-09-02", "Đông"), blocksCount: 24 }], packagings: [salesInvoice("p9", "2026-09-02")] };
    expect(getDefaultLabelCount({ kind: "W", id: "w9" }, d)).toBe(24);
    expect(getDefaultLabelCount({ kind: "P", id: "p9" }, d)).toBe(4);
    expect(getDefaultLabelCount({ kind: "S", id: "s1" }, d)).toBe(1);
    expect(getDefaultLabelCount({ kind: "W", id: "khong" }, d)).toBe(1);
  });

  it("buildLabelPrintRecords ghi đúng số tem từng lô", () => {
    const items = buildLabelPrintRecords([buildLotNode("W", "w1", traceData)], "", "", () => "i", () => 12);
    expect(items[0]!.copies).toBe(12);
  });

  it("assignSessionLots: không rõ loài vẫn gắn (chiều an toàn), không gắn trùng, báo dòng không khớp", () => {
    const d: TraceData = { ...traceData, products: [{ id: "mh1", code: "", name: "Hàng lạ", finishedGoodCode: "" }], lotInputs: [inputKg("cu", "w1", "s1-Mực ống", null, "")] };
    const result = assignSessionLots({
      wips: [{ id: "w1", productId: "mh1" }, { id: "w2", productId: "mh1" }],
      domesticSales: [{ id: "n1", materialTypeName: "Cá ngừ" }],
      materialLots: [{ node: buildLotNode("S", "s1-Mực ống", d), method: "typed" }],
      traceData: d, operator: "", recordedAt: "", newId: () => "g",
    });
    expect(result.lotInputs.map((l) => l.outputId)).toEqual(["w2"]); // w1 đã gắn s1 rồi
    expect(result.lotInputs[0]!.method).toBe("typed");
    expect(result.mismatches).toEqual([{ kind: "N", id: "n1" }]);
  });
});

describe("groupByTraceStage — quy mô một năm", () => {
  it("~3.000 mẻ + 3.000 dòng bán: sổ tồn dựng MỘT lần, không tính lại từng lô (trước đây vài giây)", () => {
    const N = 3000;
    const wips = Array.from({ length: N }, (_, i) => ({
      ...wip(`w${i}`, `2026-${String(1 + (i % 12)).padStart(2, "0")}-10`, "Đông"), productId: `p${i % 50}`, status: "stocked" as const,
    }));
    const salesItems = Array.from({ length: N }, (_, i) =>
      ({ id: `b${i}`, productId: `p${i % 50}`, spec: "", quantityKg: 30, sourceWarehouse: "Kho dự trữ", deliveryDate: "2026-06-01", invoiceId: "" }) as SalesItem);
    const t = performance.now();
    const gd = groupByTraceStage({ ...traceData, wips, salesItems, packagings: [] }, { fromDate: "2026-01-01", toDate: "2026-12-31", workshop: "" });
    const ms = performance.now() - t;
    expect(gd[2]!.items).toHaveLength(N);
    expect(gd[2]!.items.reduce((s, m) => s + (m.stockKg ?? 0), 0)).toBe(N * 100 - N * 30);
    expect(ms).toBeLessThan(1500); // máy dev ~80 ms; cách cũ (computeWipStock mỗi lô) ~3 s
  });
});

describe("buildLotQrUrl + parseQrCode — đường link trên tem QR", () => {
  it("tem MỚI mang ?lot=, đọc lại ra đúng lô", () => {
    const url = buildLotQrUrl("W", "a b", "https://app.example");
    expect(url).toBe("https://app.example/#/qr?lot=W:a%20b");
    expect(parseQrCode(url)).toEqual({ kind: "W", id: "a b" });
  });
  it("tem ĐÃ IN trước 2026-10-13 (?lo=) vẫn đọc được", () => {
    expect(parseQrCode("https://app.example/#/qr?lo=S:HP-1")).toEqual({ kind: "S", id: "HP-1" });
  });
});
