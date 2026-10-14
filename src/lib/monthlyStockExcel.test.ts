import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import type { MonthlyStockLine } from "@/types";
import { parseStockStatementFile, parseWarehouseFromTitle, findWarehouseByText, buildNewWarehouseName, loadedRowId, mergeReload } from "./monthlyStockExcel";

/** Dựng sheet theo bố cục bảng kê thật: A tên mục/ngày, B tên hàng, J/L/N kg, R ghi chú kho. */
function stockRow(name: string, stock: number, write = ""): unknown[] {
  const r: unknown[] = Array(18).fill(null);
  r[1] = name;
  r[9] = stock;
  if (write) r[17] = write;
  return r;
}

async function docFile(dong6: unknown[] = []): Promise<ReturnType<typeof parseStockStatementFile>> {
  const aoa: unknown[][] = [
    ["BẢNG KÊ NGUYÊN LIỆU KHO 1500 THÁNG 08 / 2026"], // dòng 1
    ["I", "HÀNG NHẬP KHẨU"], // 2
    stockRow("SABA", 100, "GỬI KHO Á D"), // 3
    stockRow("CÁ SÒNG", 50, "gừi kho HP"), // 4
    stockRow("2 DA RÂU NGẮN", 30, "GỬI KHO HP"), // 5 ← đầu khối 2 DA
    dong6, // 6 trống (hoặc chỉ có ô chuỗi rỗng — xem test 28b)
    stockRow("4 DA RÂU NGẮN", 20), // 7
    ["TỔNG 2 DA"], // 8 — công thức SUM(J5:J7)
    ["TỔNG HÀNG NHẬP KHẨU"], // 9
    ["II", "HÀNG MUA NGOÀI"], // 10
    stockRow(" B.TUỘC  2 DA", 10, "xuất trả lại 4240"), // 11
    stockRow("BẠCH TUỘC <80gr", 5, "gửi kho phước cơ"), // 12
    ["TỔNG HÀNG NỘI ĐỊA"], // 13
    ["III", "HÀNG  TẠM"], // 14
    stockRow("CÁ TRÍCH DẠT", 573), // 15
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["J8"] = { t: "n", v: 50, f: "SUM(J7:J7)" }; // cột kg khoanh hẹp…
  ws["P8"] = { t: "n", v: 50, f: "SUM(P5:P7)" }; // …cột tồn cuối khoanh rộng ⇒ lấy dòng nhỏ nhất
  // Lô 2 DA: ngày nhập (serial 46193 = 20/06/2026) + invoice gộp dọc A5:A7 / E5:E7 (có dòng trống 6 giữa).
  ws["A5"] = { t: "n", v: 46193 };
  ws["E5"] = { t: "s", v: "IFE/07/2026" };
  ws["!merges"] = [XLSX.utils.decode_range("A5:A7"), XLSX.utils.decode_range("E5:E7")];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "8");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return parseStockStatementFile(new File([buf], "kho.xlsx"));
}

describe("parseStockStatementFile", () => {
  test("tách nhóm theo mục + khối con TỔNG 2 DA + Hàng tạm", async () => {
    const [sh] = await docFile();
    const group = Object.fromEntries(sh.rows.map((r) => [r.itemName, r.category]));
    expect(group["SABA"]).toBe("Nguyên liệu nhập khẩu");
    expect(group["CÁ SÒNG"]).toBe("Nguyên liệu nhập khẩu");
    expect(group["2 DA RÂU NGẮN"]).toBe("Nguyên liệu nhập khẩu – 2 DA");
    expect(group["4 DA RÂU NGẮN"]).toBe("Nguyên liệu nhập khẩu – 2 DA");
    expect(group["B.TUỘC  2 DA"]).toBe("Nguyên liệu mua ngoài");
    expect(group["CÁ TRÍCH DẠT"]).toBe("Hàng tạm");
    expect(parseWarehouseFromTitle(sh.title)).toBe("1500");
  });

  test("ô gộp ngày nhập/invoice chép xuống cả lô, ngày không lùi 1 ngày, dòng trống giữ nguyên", async () => {
    const [sh] = await docFile();
    const by = Object.fromEntries(sh.rows.map((r) => [r.itemName, r]));
    expect(by["2 DA RÂU NGẮN"]).toMatchObject({ importDate: "2026-06-20", origin: "IFE/07/2026" });
    expect(by["4 DA RÂU NGẮN"]).toMatchObject({ importDate: "2026-06-20", origin: "IFE/07/2026" });
    expect(by["SABA"].importDate).toBe("");
    // dòng trống (dòng 6) không bị biến thành dòng dữ liệu ⇒ rowIndex không xê dịch
    expect(by["4 DA RÂU NGẮN"].rowIndex).toBe(5);
  });

  test("dòng chỉ có ô chuỗi rỗng \"\" (SheetJS blankrows:false vẫn giữ) không làm lệch dòng cộng khối con", async () => {
    const [sh] = await docFile(["", ""]);
    const by = Object.fromEntries(sh.rows.map((r) => [r.itemName, r]));
    expect(by["2 DA RÂU NGẮN"].category).toBe("Nguyên liệu nhập khẩu – 2 DA");
    expect(by["4 DA RÂU NGẮN"].category).toBe("Nguyên liệu nhập khẩu – 2 DA");
    expect(by["CÁ SÒNG"].category).toBe("Nguyên liệu nhập khẩu");
  });

  test("cột R: kho gửi vs ghi chú thường", async () => {
    const [sh] = await docFile();
    const by = Object.fromEntries(sh.rows.map((r) => [r.itemName, r]));
    expect(by["SABA"].warehouseNote).toBe("Á D");
    expect(by["CÁ SÒNG"].warehouseNote).toBe("HP");
    expect(by["BẠCH TUỘC <80gr"].warehouseNote).toBe("phước cơ");
    expect(by["B.TUỘC  2 DA"]).toMatchObject({ warehouseNote: "", note: "xuất trả lại 4240" });
    expect(by["CÁ TRÍCH DẠT"]).toMatchObject({ warehouseNote: "", note: "" });
  });
});

describe("findWarehouseByText", () => {
  const dm = [
    { code: "KHP", name: "Kho Hồng Phú" },
    { code: "KAD", name: "Kho Ánh Dương" },
  ];
  test("khớp mã có/không tiền tố K, bỏ dấu + khoảng trắng", () => {
    expect(findWarehouseByText("HP", dm)).toBe("Kho Hồng Phú");
    expect(findWarehouseByText("Á D", dm)).toBe("Kho Ánh Dương");
    expect(findWarehouseByText("ánh dương", dm)).toBe("Kho Ánh Dương");
  });
  test("viết tắt lạ ⇒ null + tên kho mới", () => {
    expect(findWarehouseByText("phước cơ", dm)).toBeNull();
    expect(buildNewWarehouseName("phước cơ")).toBe("Kho Phước Cơ");
  });
});

describe("idDongNap + ghepNapLai — nạp lại không nhân đôi (#28a)", () => {
  const row = (id: string, p: Partial<MonthlyStockLine> = {}): MonthlyStockLine => ({
    id,
    period: "2026-08",
    category: "Nguyên liệu nhập khẩu",
    warehouse: "Kho 1000 tấn",
    itemName: "SABA",
    size: "",
    origin: "",
    importDate: "",
    storageLocation: "",
    kgPerCtn: null,
    unitPrice: null,
    openCtn: 0,
    openKg: 100,
    inCtn: 0,
    inKg: 0,
    outCtn: 0,
    outKg: 0,
    carriedFromId: "",
    sortOrder: 0,
    note: "",
    ...p,
  });

  test("id theo số tháng: sheet '8' giữ đúng id cũ", () => {
    expect(loadedRowId("K1000T", 8, 2026, 5)).toBe("xlsx|K1000T|8|2026|5");
  });

  test("dữ liệu cũ id theo tên sheet '08' + nạp lại (sheet 'T8') ⇒ thay, không nhân đôi, thừa kế vị trí", () => {
    const prev = [
      row("xlsx|K1000T|08|2026|5", { storageLocation: "Kho Ánh Dương", note: "đã kiểm" }),
      row("xlsx|K1000T|08|2026|6", { itemName: "SÒNG" }),
      row("xlsx|K1500T|08|2026|5"), // kho khác — không đụng
      row("xlsx|K1000T|7|2026|5", { period: "2026-07" }), // tháng khác — không đụng
    ];
    const incoming = [row(loadedRowId("K1000T", 8, 2026, 5), { openKg: 120 }), row(loadedRowId("K1000T", 8, 2026, 6), { itemName: "SÒNG" })];
    const result = mergeReload(prev, incoming, "K1000T");
    const t8 = result.lines.filter((l) => l.period === "2026-08" && l.warehouse === "Kho 1000 tấn" && l.id.includes("K1000T"));
    expect(t8.map((l) => l.id).sort()).toEqual(["xlsx|K1000T|8|2026|5", "xlsx|K1000T|8|2026|6"]);
    expect(result.replacedOldIds).toBe(2);
    const saba = result.lines.find((l) => l.id === "xlsx|K1000T|8|2026|5")!;
    expect(saba).toMatchObject({ openKg: 120, storageLocation: "Kho Ánh Dương", note: "đã kiểm" });
    expect(result.lines.some((l) => l.id === "xlsx|K1500T|08|2026|5")).toBe(true);
    expect(result.lines.some((l) => l.id === "xlsx|K1000T|7|2026|5")).toBe(true);
    expect(result.lines).toHaveLength(4);
  });

  test("cùng id mà tên hàng khác (rowIndex trượt) ⇒ không thừa kế vị trí/ghi chú + báo", () => {
    const prev = [row("xlsx|K1000T|8|2026|5", { storageLocation: "Kho Hồng Phú", note: "x" })];
    const result = mergeReload(prev, [row("xlsx|K1000T|8|2026|5", { itemName: "CÁ THU" })], "K1000T");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ itemName: "CÁ THU", storageLocation: "", note: "" });
    expect(result.nameMismatches).toHaveLength(1);
  });

  test("dòng cũ không còn trong file: trống ⇒ bỏ, còn số ⇒ giữ + báo; file có kho ở cột R thì file thắng", () => {
    const prev = [
      row("xlsx|K1000T|8|2026|1", { storageLocation: "Kho A" }),
      row("xlsx|K1000T|8|2026|9", { openKg: 0 }),
      row("xlsx|K1000T|8|2026|10", { openKg: 7 }),
      row("msl|2026-08|tach", { note: "Gửi kho (tách từ dòng xlsx|K1000T|8|2026|1)" }),
    ];
    const result = mergeReload(prev, [row("xlsx|K1000T|8|2026|1", { storageLocation: "Kho B" })], "K1000T");
    expect(result.droppedEmpty).toBe(1);
    expect(result.staleWithData.map((l) => l.id)).toEqual(["xlsx|K1000T|8|2026|10"]);
    expect(result.lines.find((l) => l.id === "xlsx|K1000T|8|2026|1")?.storageLocation).toBe("Kho B");
    expect(result.splitCount).toBe(1);
  });
});
