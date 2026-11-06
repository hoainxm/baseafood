// Oracle: docs/app-map/48-production-order.ba-spec.md R21 — đọc file Lệnh sản xuất để điền sẵn hộp Lập lệnh.
// Dữ liệu: dòng chữ đọc ra từ file thật "LSX 17.10 … Seachemot 10 2026.doc" (đính ở bước 2 chuyến của HĐ
// 23.26/BSF-SCM.2026, 2026-11-06) + 13 dòng bản 3 của HĐ đó (tên danh mục tiếng Việt).
import { describe, expect, it } from "vitest";
import type { ExportContractLine } from "@/types";
import { buildExportOrderLines } from "./documentTypes/exportOrderForm";
import { fillOrderForm, orderFromFile, isoDatesOf, matchOrderLines, parseOrderRows, parseLocalNumber, sizesOf, type OrderFillTarget } from "./productionOrderFile";

const ROWS: string[][] = [
  ["LỆNH SẢN XUẤT"],
  ["SỐ : 17.10"],
  ["Ngày 21 Tháng 10 Năm 2026"],
  ["KÍNH GỞI :", "BQĐ PHÂN XƯỞNG, PHÒNG KỸ THUẬT , PHÒNG KẾ HOẠCH"],
  ["Đề nghị các bộ phận triển khai sản xuất mặt hàng sau:"],
  ["STT", "Tên hàng", "Quy cách", "Số lượng", "Khối lượng", "MSL"],
  ["1", "Bạch tuộc luộc 1-under gr/pc Length max : 4 cm, 1.100-1.300 miếng/kg Thời gian luộc : 60 giây ( HSD : 24 tháng ) 80% Râu, 20% Bao tử , không lấy cổ.", "IQF, bulk 10kg/pe/ctn Dùng túi PE xanh 70x65cm ISO 27 10 2026 = 100 Thùng Keo vàng, đai đen", "100 thùng = 1.000 kg", "MSL 201"],
  ["2", "Bạch tuộc chần 2-3gr/pc, 400+-20 miếng/kg Length max : 4 cm Thời gian chần : 30 giây ( HSD : 24 tháng ) 80% Râu, 20% Bao tử , không lấy cổ.", "IQF, Bulk 10 kg/pe/ctn ISO 28,29 / 10 / 2026= 1.000 Thùng Băng keo trong, dây đai xanh lá", "1.000 thùng = 10.000 kg", "MSL 201"],
  ["3", "Bạch tuộc luộc 4-5 gr/pc Length max : 4 cm, Thời gian luộc : 60 giây (Luộc chín hoàn toàn), không ngâm hóa chất ( HSD : 24 tháng ) Mã vạch túi: 4582368510965 80% Râu, 20% Bao tử , không lấy cổ.", "IQF, 1 kg/pe x 10/ctn Dùng túi 22x34 in lụa CODE: BSF009 ISO 27 10 2026 = 200 Thùng Keo vàng, đai hồng", "200 thùng = 2.000 kg", "MSL 201"],
  ["4", "Tip Bạch tuộc luộc ( HSD : 24 tháng ) Mã vạch túi: 4582368510972", "1kg/Block/PE x 12/ctn Dùng túi 28x30, hàn miệng, in lụa CODE:BSF011 ISO 27 10 2026 = 250 thùng Băng keo trong, dây đai xanh lá", "250 thùng = 3.000 kg", "MSL 201"],
  ["5", "Tip Bạch tuộc sống(chần nhẹ) ( HSD : 24 tháng ) Mã túi: BSF017", "1kg/Block/PE x 12/ctn Dùng túi 28x30, hàn miệng, in lụa CODE:BSF017 ISO 30 10 2026= 50 Thùng Băng keo vàng, dây đai đỏ", "50 thùng = 600 kg", "MSL 201"],
  ["6", "Bạch tuộc 2da tẩm bột Cắt 9-12g (trước tẩm), cho phép lấy 1 leg, Size: 10-15 grs/PC(Sau tẩm) ( HSD : 24 tháng ) -Bột : BREADER-VR27102BR (Nitto-fuji) +Dusting: DUSTING-VD22601D (Nitto fuji) -70% Râu, 30% Bao tử không lấy cổ.", "IQF, 1 kg/pe x 10/ctn Dùng túi 25x35 in lụa CODE BSF039 Số barcode túi: 4582368511603 Đóng ISO 29 10 2026 = 100 thùng Băng keo trắng, dây đai xanh dương", "100 thùng = 1.000 kg", "MSL 201"],
  ["7", "Bạch tuộc 2da tẩm bột Cắt 9-12g (trước tẩm), cho phép lấy 1 leg, Size: 10-15 grs/PC(Sau tẩm) ( HSD : 24 tháng ) -Bột : BREADER-VR27102BR (Nitto-fuji) +Dusting: DUSTING-VD22601D (Nitto fuji) - 40% bao tử, 35% râu , 25% cổ.", "IQF, 1 kg/pe x 6/ctn x 2/kiện Dùng túi 25x35 in lụa CODE BSF40 có logo Đóng ISO 29 10 2026 = 200 kiện Sử dụng bao bì mới loại có logo hình ảnh ROMANTEI", "200 kiện = 2.400 kg", "MSL 201"],
  ["8", "Bạch tuộc 1 da Xẻ Banh Size: 26-40 pc/kg Tương ứng 25-35 gr/pc CODE: BSF024 ( HSD : 24 tháng )", "IQF 1kg/pe x10/ctn Dùng túi 25x35, mã túi mới ISO 30 10 2026= 150 thùng Keo trong, đai đỏ", "150 thùng = 1.500 kg", "MSL 201"],
  ["9", "Bạch tuộc 1 da xiên que chần màu Size: 16-24 gr/pc (Sử dụng xiên que tròn dài 30 cm) Thời gian chần: 30 giây với giấm gạo + 80S", "5pcs/ xiên x 10 xiên/ túi x 4 / thùng x 2/ kiện ISO 28 10 2026 = 50 kiện Keo trong, đai trắng", "50 kiện = 600 kg", "MSL 201"],
  ["10", "Bạch tuộc NCLS tiêu chuẩn Sashimi , luộc 95ºC trong 60s Size 15-25 gr/pc Như hàng mẫu PXĐ đã làm gửi khách Sử dụng MTR79", "1 kg/ túi PA 23x35 cm dán decal HCK x 10/ thùng ISO : 20,28/10/2026 = 500 Lưu ý : Bạch tuộc phải đủ 8 râu", "500 thùng = 5.000 kg", "MSL 201"],
  ["11", "Cổ Bạch tuộc xẻ banh cắt sống Mix size ( HSD : 24 tháng )", "1 kg/block/PE x 10/ctn Dùng túi 25x35 in lụa CODE:BSF013 ISO 30 10 2026 = 50 thùng Keo trong, đai trắng", "50 thùng = 500 kg", "MSL 201"],
  ["12", "Bạch tuộc luộc 6-7 gr/pc ( 150±10 pcs/kg ) Length max : 4,5 cm, Thời gian luộc : 60 giây ( HSD : 24 tháng ) 80% Râu, 20% Bao tử , không lấy cổ.", "IQF, 1 kg/pe x 10/ctn Sử dụng bao bì thiết kế CŨ mã vạch 4582368511368 ISO 28 10 2026= 100 Thùng Keo trong, đai đỏ", "100 thùng = 1.000 kg", "MSL 201"],
  ["13", "Cổ Bạch tuộc luộc Size 1-2grs/PC ( HSD : 24 tháng ) Mã vạch túi: 4582368511429", "IQF, 1 kg/pe x 10/ctn Dùng túi 25x35 in lụa CODE:BSF012 ISO 28 10 2026 = 200 thùng Keo trong, đai trắng", "200 thùng = 2.000 kg", "MSL 201"],
  ["Dự kiến có đầy đủ bao bì : 22/10/2026"],
  ["Ngày giao hàng:", "03/11/2026"],
  ["Xuất vào thị trường: Nhật ( khách SEACHEMOT CO.,LTD)"],
  ["Ghi ngày hết hạn 2028.10.01"],
  ["Đóng ngày ISO trên thùng."],
  ["Quy trình Sản xuất:", "Theo quy trình SX của Phòng Kỹ thuật."],
  ["Các yêu cầu về bao bì:"],
  ["Thùng Carton:", "Số lớp"],
  ["Các yêu cầu về kiểm Nafi:"],
  ["Vi sinh theo quy định"],
  ["CÔNG TY TNHH BASEAFOOD 1"],
];

// Bản 3 của HĐ 23.26/BSF-SCM.2026 (thứ tự như DB) + tên danh mục.
const CL: [string, string, string, string, number, number, "carton" | "bundle", number, string][] = [
  ["a", "FROZEN IWADAKO BOILED CUT", "1-under gr/pc", "BULK 10KG/PE/CTN", 100, 10, "carton", 1, "Bạch tuộc cắt luộc 1gr under"],
  ["b", "FROZEN IWADAKO BLANCHED CUT", "2-3 gr/pc", "BULK 10KG/PE/CTN", 1000, 10, "carton", 1, "Bạch tuộc cắt chần 2-3"],
  ["c", "FROZEN IWADAKO BOILED CUT", "4-5 gr/pc", "IQF, 1KG/PE X 10/CTN", 200, 10, "carton", 1, "Bạch tuộc cắt luộc 4-5 gr/pc"],
  ["d", "FROZEN IWADAKO BOILED CUT", "6-7 gr/pc", "IQF, 1KG/PE X 10/CTN", 100, 10, "carton", 1, "Bạch tuộc cắt luộc 6-7"],
  ["e", "FROZEN TAKO TIP BOILED CUT", "", "1KG/BLOCK/PE x 12/CTN", 150, 12, "carton", 1, "Típ bạch tuộc cắt luộc"],
  ["f", "FROZEN TAKO NECK BOILED CUT", "1-2 gr/pc", "IQF, 1KG/PE X 10/CTN", 200, 10, "carton", 1, "Cổ bạch tuộc 2 da luộc 1-3"],
  ["g", "FROZEN TAKO TIP RAW", "", "1KG/BLOCK/PE x 12/CTN", 50, 12, "carton", 1, "Típ bạch tuộc 2 da cắt sống"],
  ["h", "FROZEN TAKO NECK RAW", "Mix size", "1KG/BLOCK/PE x 10/CTN", 50, 10, "carton", 1, "Cổ bạch tuộc cắt sống"],
  ["i", "FROZEN TAKO KARAGE", "10-15 gr/pc", "IQF, 1KG/PE X 10/CTN", 100, 10, "carton", 1, "Bạch tuộc 2 da tẩm bột 10-15gr"],
  ["j", "FROZEN TAKO KARAGE", "10-15 gr/pc", "IQF, 1KG/PE X 6/CTN X 2/BUNDLE", 200, 6, "bundle", 2, "Bạch tuộc 2 da tẩm bột 10-15gr"],
  ["k", "FROZEN IIDAKO OPEN CUT", "25-35 gr/pc", "IQF, 1KG/PE X 10/CTN", 150, 10, "carton", 1, "Bạch tuộc 1 da xẻ banh"],
  ["l", "FROZEN IIDAKO SKEWER", "16-24 gr/pc (5pcs/skewer/100gr)", "10 skewers/bag (1kg) x 4/carton x 2/bundle", 100, 4, "bundle", 2, "Bạch tuộc 1 da chần xiên que 5pcs"],
  ["m", "FROZEN IIDAKO WHOLE CLEANED SASHIMI", "15-25 gr/pc ", "1kg/vaccum bag x 10/CTN", 400, 10, "carton", 1, "Bạch tuộc 1 da NCLS"],
];
const contractLines = CL.map(
  ([id, description, size, packing, quantity, netKgPerCarton, unitKind, cartonsPerUnit]) =>
    ({ id, description, size, packing, quantity, netKgPerCarton, unitKind, cartonsPerUnit, productId: `p-${id}`, hsCode: "", kg: null, unitPrice: 9, microSpec: "" }) as ExportContractLine,
);
const productName = (pid: string) => CL.find(([id]) => `p-${id}` === pid)?.[8] ?? "";

describe("đọc file lệnh sản xuất", () => {
  it("số kiểu Việt, ngày ISO, size gr/pc", () => {
    expect(parseLocalNumber("1.000")).toBe(1000);
    expect(parseLocalNumber("2.400")).toBe(2400);
    expect(parseLocalNumber("4,5")).toBe(4.5);
    expect(isoDatesOf("IQF ISO 28,29 / 10 / 2026= 1.000 Thùng")).toEqual(["2026-10-28", "2026-10-29"]);
    expect(isoDatesOf("ISO : 20,28/10/2026 = 500")).toEqual(["2026-10-20", "2026-10-28"]);
    expect(isoDatesOf("Đóng ISO 29 10 2026 = 100 thùng")).toEqual(["2026-10-29"]);
    expect(sizesOf("Bạch tuộc luộc 1-under gr/pc Length max")).toEqual(["1-under"]);
    expect(sizesOf("Size: 26-40 pc/kg Tương ứng 25-35 gr/pc")).toEqual(["25-35"]);
    expect(sizesOf("Bạch tuộc cắt luộc 1gr under")).toEqual(["1-under"]);
    expect(sizesOf("Cổ Bạch tuộc xẻ banh cắt sống Mix size")).toEqual(["mix"]);
  });

  it("LSX 17.10: số, ngày, ngày giao, thị trường, khách, MSL, HSD, ngày sản xuất, lưu ý, 13 dòng", () => {
    const f = parseOrderRows(ROWS)!;
    expect(f.orderNo).toBe("17.10");
    expect(f.orderDate).toBe("2026-10-21");
    expect(f.deliveryDate).toBe("2026-11-03");
    expect(f.market).toBe("Nhật");
    expect(f.customer).toBe("SEACHEMOT CO.,LTD");
    expect(f.lotCode).toBe("201");
    expect(f.shelfLifeMonths).toBe(24);
    expect(f.processNote).toBe("Theo quy trình SX của Phòng Kỹ thuật.");
    expect(f.productionDates).toEqual(["2026-10-20", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
    expect(f.notes).toEqual(["Dự kiến có đầy đủ bao bì: 22/10/2026", "Ghi ngày hết hạn 2028.10.01", "Đóng ngày ISO trên thùng."]);
    expect(f.lines).toHaveLength(13);
    expect(f.lines.map((l) => [l.units, l.unitKind, l.kg])).toEqual([
      [100, "carton", 1000], [1000, "carton", 10000], [200, "carton", 2000], [250, "carton", 3000], [50, "carton", 600], [100, "carton", 1000],
      [200, "bundle", 2400], [150, "carton", 1500], [50, "bundle", 600], [500, "carton", 5000], [50, "carton", 500], [100, "carton", 1000], [200, "carton", 2000],
    ]);
  });

  it("chữ tách dấu (NFD) của file Word cũ vẫn đọc được số lệnh, ngày, HSD", () => {
    const nfd = ROWS.map((r) => r.map((c) => c.normalize("NFD")));
    const f = parseOrderRows(nfd)!;
    expect(f.orderNo).toBe("17.10");
    expect(f.orderDate).toBe("2026-10-21");
    expect(f.shelfLifeMonths).toBe(24);
    expect(f.deliveryDate).toBe("2026-11-03");
    expect(f.market).toBe("Nhật");
    expect(f.lines).toHaveLength(13);
  });

  it("không phải file lệnh sản xuất ⇒ null", () => {
    expect(parseOrderRows([["SALES CONTRACT"], ["Seller", "Buyer"]])).toBeNull();
  });

  it("13 dòng file khớp đúng 13 dòng HĐ (tên Việt ↔ danh mục + size + quy cách)", () => {
    const f = parseOrderRows(ROWS)!;
    const m = matchOrderLines(f.lines, contractLines, productName);
    expect([...m.entries()].map(([no, id]) => `${no}${id}`)).toEqual(["1a", "2b", "3c", "4e", "5g", "6i", "7j", "8k", "9l", "10m", "11h", "12d", "13f"]);
  });

  it("điền form trống: mọi ô + 13 dòng; cảnh báo vượt HĐ và kg lệch, giữ số lệnh trùng", () => {
    const f = parseOrderRows(ROWS)!;
    const blank: OrderFillTarget = { orderNo: "01.11", orderDate: "2026-11-06", lotCode: "", productionDates: [""], deliveryDate: "", shelfLifeMonths: 24, market: "Xuất khẩu", lines: [{ id: "x", contractLineId: "", units: null, kg: null }], processNote: "", note: "" };
    let n = 0;
    const out = fillOrderForm(blank, f, {
      contractLines,
      productName,
      remainingKg: (id) => {
        const cl = contractLines.find((c) => c.id === id)!;
        return (cl.quantity ?? 0) * (cl.netKgPerCarton ?? 0) * (cl.unitKind === "bundle" ? cl.cartonsPerUnit : 1);
      },
      customerName: "SEACHEMOT CO., LTD",
      takenOrderNos: [],
      // Thị trường gợi ý theo khách lúc mở hộp ("Xuất khẩu") chưa phải ô người dùng gõ ⇒ nhận "Nhật" của file.
      defaults: { orderNo: "01.11", orderDate: "2026-11-06", shelfLifeMonths: 24, market: "Xuất khẩu" },
      newId: () => `n${++n}`,
    });
    const r = out.form;
    expect(r.orderNo).toBe("17.10");
    expect(r.orderDate).toBe("2026-10-21");
    expect(r.lotCode).toBe("201");
    expect(r.deliveryDate).toBe("2026-11-03");
    expect(r.market).toBe("Nhật");
    expect(r.productionDates).toHaveLength(5);
    expect(r.processNote).toBe("Theo quy trình SX của Phòng Kỹ thuật.");
    expect(r.note).toContain("Ghi ngày hết hạn 2028.10.01");
    expect(r.lines).toHaveLength(13);
    expect(r.lines[3]).toMatchObject({ contractLineId: "e", units: 250 });
    expect(r.lines[3].note).toContain("CODE:BSF011");
    // Tip luộc 250 thùng × 12 = 3.000 kg > HĐ 150 × 12 = 1.800 kg; Sashimi 500 > 400; xiên que 50 kiện × 8 kg = 400 ≠ file 600.
    expect(out.report.warnings.some((w) => w.startsWith("Dòng 4") && w.includes("vượt"))).toBe(true);
    expect(out.report.warnings.some((w) => w.startsWith("Dòng 10") && w.includes("vượt"))).toBe(true);
    expect(out.report.warnings.some((w) => w.startsWith("Dòng 9") && w.includes("600 kg") && w.includes("400 kg"))).toBe(true);
    expect(out.report.warnings.some((w) => w.includes("không khớp"))).toBe(false);
    expect(out.report.warnings.some((w) => w.includes("khách"))).toBe(false);
  });

  it("ô người dùng đã gõ thì giữ, kê lại; khách khác HĐ và số lệnh trùng thì cảnh báo", () => {
    const f = parseOrderRows(ROWS)!;
    const typed: OrderFillTarget = { orderNo: "18.10", orderDate: "2026-10-22", lotCode: "205", productionDates: ["2026-10-25"], deliveryDate: "2026-11-05", shelfLifeMonths: 18, market: "Nhật", lines: [{ id: "x", contractLineId: "c", units: 180, kg: null }], processNote: "", note: "" };
    const out = fillOrderForm(typed, f, {
      contractLines, productName, remainingKg: () => null, customerName: "DAIREI CO., LTD", takenOrderNos: ["18.10"],
      defaults: { orderNo: "01.11", orderDate: "2026-11-06", shelfLifeMonths: 24, market: "" }, newId: () => "n",
    });
    expect(out.form.orderNo).toBe("18.10");
    expect(out.form.lotCode).toBe("205");
    expect(out.form.lines).toEqual([{ id: "x", contractLineId: "c", units: 180, kg: null, note: expect.stringContaining("BSF009") }]);
    expect(out.report.kept.some((k) => k.startsWith("Số lệnh"))).toBe(true);
    expect(out.report.kept.some((k) => k.startsWith("Hạn sử dụng"))).toBe(true);
    expect(out.report.warnings.some((w) => w.includes("SEACHEMOT") && w.includes("DAIREI"))).toBe(true);
    expect(out.report.warnings.some((w) => w.includes("Số lệnh 18.10 đã có"))).toBe(true);
    expect(out.report.warnings.filter((w) => w.includes("chưa có dòng đó")).length).toBe(12);
  });

  it("Lệnh xuất (ba-spec 72 R2c): file LSX đính ở chuyến ⇒ 13 dòng tên danh mục, MSL 201, ngày SX theo ISO từng dòng, hạn 01/10/2028", () => {
    const f = parseOrderRows(ROWS)!;
    expect(f.expiryDate).toBe("2028-10-01");
    const v = orderFromFile(f, { id: "file:lsx", contractId: "c23", contractNo: "23.26/BSF-SCM.2026", contractLines, productName });
    expect(v.matched).toBe(13);
    expect(v.unmatched).toBe(0);
    const built = buildExportOrderLines({
      shipment: { id: "s1", lotCode: "", contractId: "c23" },
      orders: [v.order],
      orderLines: v.lines,
      contractLines,
      shipmentLines: [],
      overrides: { expiry: new Map([[v.order.id, v.expiry]]), productionDates: v.datesByLine },
    });
    expect(built.rows).toHaveLength(13);
    expect(built.rows[0]).toMatchObject({ productName: "Bạch tuộc cắt luộc 1gr under", size: "1-under gr/pc", cartons: 100, kg: 1000, lotCode: "201", productionDates: "27/10/2026", expiry: "01/10/2028" });
    expect(built.rows[1].productionDates).toBe("28, 29/10/2026");
    expect(built.rows[6]).toMatchObject({ productName: "Bạch tuộc 2 da tẩm bột 10-15gr", cartons: 400, kg: 2400 });
    // Chuyến chưa nhập Hàng của chuyến ⇒ số theo cả lệnh + nhắc.
    expect(built.notices.some((n) => n.includes("17.10") && n.includes("cả lệnh"))).toBe(true);
  });

  it("Lệnh xuất từ lệnh trong app (lập bằng Đọc file): ngày SX của dòng theo ngày ISO trong Ghi chú dòng", () => {
    const f = parseOrderRows(ROWS)!;
    const v = orderFromFile(f, { id: "o17", contractId: "c23", contractNo: "23.26", contractLines, productName });
    // Như lệnh 17.10 thật: lệnh trong app, Ghi chú dòng = quy cách đóng gói của file, không có override.
    const built = buildExportOrderLines({ shipment: { id: "s1", lotCode: "201", contractId: "c23" }, orders: [v.order], orderLines: v.lines, contractLines, shipmentLines: [] });
    expect(built.rows[0].productionDates).toBe("27/10/2026");
    expect(built.rows[9].productionDates).toBe("20, 28/10/2026");
    // Ghi chú không có ISO ⇒ mọi ngày của lệnh.
    const plain = buildExportOrderLines({ shipment: { id: "s1", lotCode: "201", contractId: "c23" }, orders: [v.order], orderLines: v.lines.map((l) => ({ ...l, note: "" })), contractLines, shipmentLines: [] });
    expect(plain.rows[0].productionDates).toBe("20, 27, 28, 29, 30/10/2026");
  });
});
