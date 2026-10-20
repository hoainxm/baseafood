// Bộ demo Xuất khẩu (R14, AC-29 phần chạy được không cần DB): đủ 7 ca của buổi audit để trình diễn, file chỉ là
// đường dẫn giữ chỗ (không chép file thật), id không trùng, chạy lại ra cùng bộ.
import { describe, expect, it } from "vitest";
import { abbreviation, buildExportDemo, parseExportDemoPack, shiftMonths, type ExportDemoPack } from "./exportPlanningDemo";
import {
  DEMO_PLACEHOLDER_PREFIX,
  contractClosure,
  contractState,
  contractTotals,
  effectiveRevision,
  isShipmentClosed,
  isShipmentLate,
  revisionApprovalLabelState,
  stepState,
  unmappedLines,
} from "./exportPlanning";

const CUSTOMERS = [
  { id: "dm-kh-0", code: "1", name: "KH 0", market: "Nhật Bản" },
  { id: "dm-kh-1", code: "2", name: "KH 1", market: "Nhật Bản" },
  { id: "dm-kh-2", code: "3", name: "KH 2", market: "Hàn Quốc" },
];
const TODAY = "2026-10-20";
const PRODUCTS = Array.from({ length: 12 }, (_, i) => ({ id: `sp-${i}` }));

describe("bộ demo Xuất khẩu", () => {
  const d = buildExportDemo(CUSTOMERS, TODAY, { products: PRODUCTS });

  it("đủ 7 ca của buổi audit hồ sơ SCM", () => {
    expect(d.contracts.map((c) => c.contractNo)).toHaveLength(7);
    const st = Object.fromEntries(d.contracts.map((c) => [c.contractNo, contractState(d, c.id)]));
    expect(st).toEqual({
      "DM-01/2026": "closed",
      "21.26/BSF-SCM.2026": "closed",
      "02.26/BSF-SCM.2026": "approved",
      "07.26/BSF-HTC.2026": "approved",
      "11.26/BSF-MTD.2026": "pending",
      "05.26/BSF-PC.2026": "cancelled",
      "99.26/BSF-LK.2026": "pending",
    });
    const byNo = (no: string) => d.contracts.find((c) => c.contractNo === no)!;
    // 1. Không gói ⇒ ca 1 dùng số tự đặt (không số của khách trong mã nguồn); đủ hồ sơ, ngoài dung sai ⇒ chốt TAY
    const c1 = byNo("DM-01/2026");
    expect(c1.status).toBe("closed");
    const r1 = effectiveRevision(d, c1.id)!;
    expect(contractTotals(r1.lines).kg).toBe(19_400);
    const s165 = d.shipments.find((s) => s.lotCode === "D165")!;
    expect(isShipmentClosed(d, s165)).toBe(true);
    expect(contractClosure(d, c1.id).kgDeviationPct).toBeGreaterThan(10);
    expect(revisionApprovalLabelState(d, r1)).toBe("approved");
    // 2. Lô 181 tự xuất đủ; bản sửa 1 bị từ chối, bản 0 vẫn hiệu lực
    const c2 = byNo("21.26/BSF-SCM.2026");
    expect(c2.status).toBe("open");
    expect(contractClosure(d, c2.id).closed).toBe(true);
    expect(effectiveRevision(d, c2.id)!.revisionNo).toBe(0);
    // 3. Cont 20 dùng chung Lệnh SX + bao bì của cont 40 cùng booking
    const s20 = d.shipments.find((s) => s.kind === "20RF")!;
    expect(stepState(d, s20, 2)).toBe("done");
    expect(stepState(d, s20, 3)).toBe("done");
    // 4. CIF ⇒ có mục bảo hiểm; 1 dòng chưa nối ⇒ Lệnh SX bị chặn; xe tải trễ hạn
    const c4 = byNo("07.26/BSF-HTC.2026");
    const truck = d.shipments.find((s) => s.kind === "truck")!;
    expect(d.items.some((i) => i.shipmentId === truck.id && i.docKind === "insurance")).toBe(true);
    expect(unmappedLines(effectiveRevision(d, c4.id)!.lines)).toHaveLength(1);
    expect(isShipmentLate(d, truck)).toBe(true);
    // 6. Bị từ chối ⇒ chuyến kế hoạch hủy theo
    expect(d.shipments.filter((s) => s.contractId === byNo("05.26/BSF-PC.2026").id).every((s) => s.status === "cancelled")).toBe(true);
    // Không ghi tên người thật vào bộ demo
    expect(new Set(d.approvals.map((a) => a.approverName))).toEqual(new Set(["Giám đốc (demo)"]));
  });

  it("file chỉ là đường dẫn giữ chỗ — không trỏ tới file thật", () => {
    const paths = [...d.files.map((f) => f.path), ...d.revisions.map((r) => r.filePath), ...d.approvals.map((a) => a.filePath)].filter(Boolean);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((p) => p.startsWith(DEMO_PLACEHOLDER_PREFIX))).toBe(true);
  });

  it("id không trùng trong từng bảng; tất định", () => {
    for (const rows of Object.values(d)) {
      const ids = (rows as { id: string }[]).map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(buildExportDemo(CUSTOMERS, TODAY, { products: PRODUCTS })).toEqual(d);
  });

  it("không có khách ⇒ bộ rỗng", () => {
    expect(buildExportDemo([], TODAY).contracts).toEqual([]);
  });
});

describe("bộ demo Xuất khẩu từ GÓI (số + file thật trong kho file riêng)", () => {
  const PACK: ExportDemoPack = {
    version: 1,
    planLastMonth: "2026-04",
    case1826: {
      contractNo: "18.26/BSF-SCM.2026",
      orderRef: "#B182",
      customerName: "KH 1",
      lines: [
        ["Line A", 200, 10, 10.5],
        ["Line B", 100, 4, 10.15, 2],
      ],
      lotCode: "165",
      invoiceNo: "234/26",
      cartons: 500,
      netKg: 3500,
      amount: 30000,
      sampleInvoiceNo: "234M/26",
      blNo: "BL165",
      containerNo: "SZLU0000000",
      sealNo: "S1",
      vessel: "V 1",
    },
    files: [
      { key: "contract-1826", name: "HĐ 18.26.pdf", path: "site-demo/export-files/demo-pack/contract/hd-18.26.pdf" },
      { key: "ci-234", name: "Commercial Invoice 234-26.pdf", path: "site-demo/export-files/demo-pack/shipment/ci.pdf" },
      { key: "photo-165", name: "Ảnh 01.jpg", path: "site-demo/export-files/demo-pack/loading/a01.jpg" },
      { key: "photo-165", name: "Ảnh 02.jpg", path: "site-demo/export-files/demo-pack/loading/a02.jpg" },
      { key: "carton", name: "Thùng A.pdf", path: "site-demo/export-files/demo-pack/shipment/thung-a.pdf" },
    ],
    plan: [
      // 40+20 đã đóng (trước "hôm nay" sau khi dời), xe tải sắp đóng, khách mới chưa có trong danh mục, HĐ còn xa ⇒ chờ duyệt
      { cont: "40+20", customer: "KH 1", goods: "Bạch tuộc các loại", kg: 30000, extraLines: [], msl: "216+006", pod: "Tokyo", booking: "BK1", loading: "2026-03-05", etd: "2026-03-07" },
      { cont: "Xe tải", customer: "KH 0", goods: "Bạch tuộc luộc", kg: 3000, extraLines: [{ goods: "Cá đuối khô", kg: 1000 }], msl: "007", pod: "", booking: "", loading: "2026-04-22", etd: "" },
      { cont: "20", customer: "Khách Mới", goods: "Tôm đỏ", kg: 12000, extraLines: [], msl: "", pod: "Sydney", booking: "BK3", loading: "2026-04-10", etd: "2026-04-12" },
      { cont: "40", customer: "KH 2", goods: "Cá saba", kg: 20000, extraLines: [], msl: "", pod: "Osaka", booking: "", loading: "2026-05-30", etd: "" },
    ],
  };
  const d = buildExportDemo(CUSTOMERS, TODAY, { products: PRODUCTS, pack: PACK, originalNames: CUSTOMERS.map((c) => c.name) });

  it("ca 1 lấy số + file thật của gói; khách theo tên trong gói", () => {
    const c1 = d.contracts.find((c) => c.contractNo === "18.26/BSF-SCM.2026")!;
    expect(c1.customerId).toBe("dm-kh-1");
    expect(effectiveRevision(d, c1.id)!.filePath).toBe("site-demo/export-files/demo-pack/contract/hd-18.26.pdf");
    const s165 = d.shipments.find((s) => s.lotCode === "165")!;
    expect(d.files.filter((f) => f.shipmentId === s165.id && f.step === "loading-photos").map((f) => f.path)).toEqual([
      "site-demo/export-files/demo-pack/loading/a01.jpg",
      "site-demo/export-files/demo-pack/loading/a02.jpg",
    ]);
    expect(d.files.some((f) => f.shipmentId === s165.id && f.path.endsWith("/ci.pdf"))).toBe(true);
  });

  it("sổ kế hoạch: dời tháng cuối về tháng hiện tại; 40+20 thành 2 chuyến cùng booking; khách mới được thêm", () => {
    const fromPlan = d.contracts.filter((c) => c.note.startsWith("Theo sổ Kế hoạch"));
    expect(fromPlan).toHaveLength(4);
    const both = d.shipments.filter((s) => s.bookingNo === "BK1");
    expect(both.map((s) => s.kind)).toEqual(["40RF", "20RF"]);
    expect(both[0].loadingDate).toBe("2026-09-05"); // 03/2026 + 6 tháng (04/2026 → 10/2026)
    expect(d.extraCustomers.map((c) => c.name)).toEqual(["Khách Mới"]);
    // đã đóng > 20 ngày ⇒ đủ hồ sơ + có tiền về
    expect(isShipmentClosed(d, both[0])).toBe(true);
    // sắp đóng (> 15 ngày) ⇒ HĐ chờ duyệt
    const far = d.shipments.find((s) => s.goodsSummary === "Cá saba")!;
    expect(contractState(d, far.contractId)).toBe("pending");
    // dòng con gộp thành dòng hàng thứ 2
    const truck = d.shipments.find((s) => s.kind === "truck")!;
    expect(effectiveRevision(d, truck.contractId)!.lines).toHaveLength(2);
  });

  it("ẩn tên ⇒ khách mới của gói cũng ẩn tên; đọc gói sai khuôn ⇒ null", () => {
    const anon = buildExportDemo(CUSTOMERS, TODAY, { pack: PACK, anonymize: true, originalNames: CUSTOMERS.map((c) => c.name) });
    expect(anon.extraCustomers.map((c) => c.name)).toEqual(["Khách XK 01"]);
    expect(parseExportDemoPack({ version: 2 })).toBeNull();
    expect(parseExportDemoPack(PACK)?.plan).toHaveLength(4);
  });

  it("dời tháng giữ ngày, kẹp cuối tháng; viết tắt tên khách", () => {
    expect(shiftMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftMonths("2025-12-15", 6)).toBe("2026-06-15");
    expect(abbreviation("Seachemot")).toBe("SEA");
    expect(abbreviation("SB Trade")).toBe("STR");
  });
});
