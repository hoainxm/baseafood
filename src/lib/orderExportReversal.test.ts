import { describe, expect, test } from "vitest";
import type {
  ExportItem,
  ExportOrder,
  LotDispatch,
  OrderItem,
  SalesInvoice,
  SalesItem,
  SalesOrder,
  WipProductionItem,
} from "@/types";
import { computeWipStock } from "@/lib/inventory";
import {
  canReopenOrder,
  checkExportReversal,
  checkOrderDelete,
  findLinkedSalesInvoice,
  orderStatusFromExports,
  reverseExportOrder,
  type ExportReversalData,
} from "./orderExportReversal";

const wip = (id: string, kg: number, date: string): WipProductionItem => ({
  id,
  productionDate: date,
  postingDate: date,
  backdateReason: "",
  workshop: "Đông",
  productId: "p1",
  spec: "18-20",
  quantityKg: kg,
  blocksCount: kg / 10,
  warehouse: "Kho 1000T",
  status: "stocked",
  note: "",
});

const wips = [wip("w1", 300, "2026-10-01"), wip("w2", 500, "2026-10-02")];
const order: SalesOrder = { id: "o1", customerId: "c1", orderDate: "2026-11-01", status: "collecting", note: "" };
const orderItems: OrderItem[] = [
  { id: "oi1", orderId: "o1", productId: "p1", spec: "18-20", requiredQuantityKg: 600, requiredBlocksCount: 60 },
];
// Lệnh xuất bản mới: phiếu bán mang đúng id lệnh.
const exportOrder: ExportOrder = { id: "x1", orderId: "o1", exportDate: "2026-11-05", status: "closed", note: "" };
const exportItems: ExportItem[] = [
  { id: "xi1", exportId: "x1", wipId: "w1", productId: "p1", spec: "18-20", quantityKg: 300, blocksCount: 30 },
  { id: "xi2", exportId: "x1", wipId: "w2", productId: "p1", spec: "18-20", quantityKg: 300, blocksCount: 30 },
];
const invoice: SalesInvoice = {
  id: "x1",
  deliveryDate: "2026-11-05",
  postingDate: "2026-11-05",
  backdateReason: "",
  workshop: "Đông",
  customerId: "c1",
  channel: "Xuất khẩu",
  note: "",
};
const salesLines: SalesItem[] = exportItems.map((d, i) => ({
  id: `s${i}`,
  invoiceId: "x1",
  deliveryDate: "2026-11-05",
  productId: d.productId,
  spec: d.spec,
  quantityKg: d.quantityKg,
  unitPrice: i === 0 ? 7.5 : null,
  sourceWarehouse: "Đơn đặt",
}));
const otherInvoice: SalesInvoice = { ...invoice, id: "inv-retail", channel: "Nội địa" };
const otherLine: SalesItem = { ...salesLines[0]!, id: "s-retail", invoiceId: "inv-retail", sourceWarehouse: "Lưu trữ" };
const check: LotDispatch = {
  id: "d1",
  lotKind: "W",
  lotId: "w1",
  lotLabel: "W1",
  docKind: "export_item",
  docId: "xi1",
  quantityKg: 300,
  method: "scan",
  operator: "Thủ kho",
  recordedAt: "2026-11-05T08:00:00Z",
};

const data = (over: Partial<ExportReversalData> = {}): ExportReversalData => ({
  salesOrders: [{ ...order, status: "closed" }],
  orderItems,
  exportOrders: [exportOrder],
  exportItems,
  salesInvoices: [invoice, otherInvoice],
  salesItems: [...salesLines, otherLine],
  lotDispatches: [check],
  balancingOutputs: [],
  ...over,
});
const meta = { reason: "Xuất nhầm container", cancelledBy: "Nguyễn Văn A", cancelledAt: "2026-11-06T09:00:00Z" };

describe("Hủy lệnh xuất", () => {
  test("trả ĐÚNG số kg từng lô về tồn như trước khi xuất", () => {
    const before = computeWipStock(wips, []);
    const afterExport = computeWipStock(wips, exportItems);
    expect(afterExport.map((t) => t.remainingKg)).toEqual([0, 200]);
    const r = reverseExportOrder("x1", data(), meta);
    const afterCancel = computeWipStock(wips, r.exportItems);
    expect(afterCancel.map((t) => [t.wipId, t.remainingKg, t.remainingBlocks])).toEqual(
      before.map((t) => [t.wipId, t.remainingKg, t.remainingBlocks]),
    );
  });

  test("gỡ phiếu bán + dòng bán của lệnh, KHÔNG đụng phiếu khác; gỡ dấu quét kiểm", () => {
    const r = reverseExportOrder("x1", data(), meta);
    expect(r.salesInvoices.map((v) => v.id)).toEqual(["inv-retail"]);
    expect(r.salesItems.map((b) => b.id)).toEqual(["s-retail"]);
    expect(r.lotDispatches).toEqual([]);
    expect(r.preview.pricedLineCount).toBe(1);
    expect(r.preview.checkCount).toBe(1);
  });

  test("giữ đầu lệnh làm dấu vết: trạng thái đã hủy + lý do + người hủy", () => {
    const r = reverseExportOrder("x1", data(), meta);
    expect(r.exportOrders).toHaveLength(1);
    expect(r.exportOrders[0]!.status).toBe("cancelled");
    expect(r.exportOrders[0]!.note).toContain("Xuất nhầm container");
    expect(r.exportOrders[0]!.note).toContain("Nguyễn Văn A");
    expect(r.exportOrders[0]!.note).toContain("2026-11-06");
  });

  test("đơn quay về Đang gom khi không còn lệnh nào phủ đủ", () => {
    const r = reverseExportOrder("x1", data(), meta);
    expect(r.salesOrders[0]!.status).toBe("collecting");
  });

  test("hủy một trong hai lệnh: đơn còn thiếu ⇒ Đang gom; lệnh kia giữ nguyên", () => {
    const x2: ExportOrder = { ...exportOrder, id: "x2", exportDate: "2026-11-06" };
    const x2Items: ExportItem[] = [{ id: "xi3", exportId: "x2", wipId: "w2", productId: "p1", spec: "18-20", quantityKg: 100, blocksCount: 10 }];
    const r = reverseExportOrder("x2", data({ exportOrders: [exportOrder, x2], exportItems: [...exportItems, ...x2Items] }), meta);
    expect(r.exportItems.map((d) => d.id)).toEqual(["xi1", "xi2"]);
    // x1 vẫn phủ đủ 600 kg ⇒ đơn đóng
    expect(r.salesOrders[0]!.status).toBe("closed");
    // phiếu của x1 (id = x1) không bị gỡ vì x2 không có phiếu khớp
    expect(r.salesInvoices.map((v) => v.id)).toContain("x1");
  });

  test("không sửa mảng vào (Hoàn tác = ghi lại mảng cũ)", () => {
    const d = data();
    const snapshot = JSON.stringify(d);
    reverseExportOrder("x1", d, meta);
    expect(JSON.stringify(d)).toBe(snapshot);
  });

  test("CHẶN khi Cân đối kỳ đã hút dòng bán của phiếu", () => {
    const c = checkExportReversal("x1", data({ balancingOutputs: [{ salesItemId: "s1", periodId: "k1" }] }));
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toContain("Cân đối");
    expect(() => reverseExportOrder("x1", data({ balancingOutputs: [{ salesItemId: "s1", periodId: "k1" }] }), meta)).toThrow();
  });

  test("CHẶN khi lệnh đã hủy rồi", () => {
    const c = checkExportReversal("x1", data({ exportOrders: [{ ...exportOrder, status: "cancelled" }] }));
    expect(c.ok).toBe(false);
  });

  test("phiếu bán đã bị xóa ở sổ Bán hàng ⇒ vẫn hủy được, chỉ trả tồn", () => {
    const r = reverseExportOrder("x1", data({ salesInvoices: [otherInvoice], salesItems: [otherLine] }), meta);
    expect(r.preview.invoice).toBeUndefined();
    expect(r.exportItems).toEqual([]);
    expect(r.salesItems.map((b) => b.id)).toEqual(["s-retail"]);
    expect(r.exportOrders[0]!.note).toContain("không thấy phiếu bán");
  });
});

describe("dò phiếu bán của lệnh cũ (id phiếu ngẫu nhiên)", () => {
  const legacyInvoice = { ...invoice, id: "rand-123" };
  const legacyLines = salesLines.map((b) => ({ ...b, invoiceId: "rand-123" }));

  test("khớp theo khách + ngày + bộ (mặt hàng × quy cách × kg) + nguồn Đơn đặt", () => {
    const found = findLinkedSalesInvoice(exportOrder, order, exportItems, [exportOrder], [otherInvoice, legacyInvoice], [otherLine, ...legacyLines]);
    expect(found?.id).toBe("rand-123");
  });

  test("lệch kg / khác khách / khác ngày ⇒ không nhận", () => {
    const lines = legacyLines.map((b, i) => (i === 0 ? { ...b, quantityKg: 299 } : b));
    expect(findLinkedSalesInvoice(exportOrder, order, exportItems, [exportOrder], [legacyInvoice], lines)).toBeUndefined();
    expect(findLinkedSalesInvoice(exportOrder, { customerId: "c2" }, exportItems, [exportOrder], [legacyInvoice], legacyLines)).toBeUndefined();
    expect(
      findLinkedSalesInvoice({ ...exportOrder, exportDate: "2026-11-04" }, order, exportItems, [exportOrder], [legacyInvoice], legacyLines),
    ).toBeUndefined();
  });

  test("không lấy phiếu đã thuộc lệnh khác (id phiếu = id lệnh khác)", () => {
    const x2: ExportOrder = { ...exportOrder, id: "x2" };
    const x2Invoice = { ...invoice, id: "x2" };
    const x2Lines = salesLines.map((b) => ({ ...b, id: `${b.id}-x2`, invoiceId: "x2" }));
    const legacyOrder = { ...exportOrder, id: "x-old" };
    const legacyItems = exportItems.map((d) => ({ ...d, exportId: "x-old" }));
    expect(findLinkedSalesInvoice(legacyOrder, order, legacyItems, [legacyOrder, x2], [x2Invoice], x2Lines)).toBeUndefined();
  });
});

describe("xóa đơn / mở lại đơn", () => {
  test("CHẶN xóa đơn còn lệnh xuất hiệu lực", () => {
    const c = checkOrderDelete("o1", [exportOrder]);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toContain("Hủy lệnh xuất");
  });

  test("đơn chỉ còn lệnh đã hủy ⇒ xóa được, đầu lệnh hủy đi theo", () => {
    const c = checkOrderDelete("o1", [{ ...exportOrder, status: "cancelled" }, { ...exportOrder, id: "x9", orderId: "o2" }]);
    expect(c).toEqual({ ok: true, cancelledExportIds: ["x1"] });
  });

  test("chỉ đơn Đủ mới Mở lại về Đang gom", () => {
    expect(canReopenOrder({ status: "complete" })).toBe(true);
    expect(canReopenOrder({ status: "collecting" })).toBe(false);
    expect(canReopenOrder({ status: "closed" })).toBe(false);
  });

  test("lệnh đã hủy không được tính là đã xuất", () => {
    expect(orderStatusFromExports("o1", orderItems, [exportOrder], exportItems)).toBe("closed");
    expect(orderStatusFromExports("o1", orderItems, [{ ...exportOrder, status: "cancelled" }], exportItems)).toBe("collecting");
  });
});
