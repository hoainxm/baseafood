/**
 * Ba sheet tổng hợp đứng ĐẦU file xuất — dựng theo đúng bố cục file mẫu kế toán
 * đang dùng: `ĐỐI CHIẾU TỔNG` · `TỰ KIỂM TRA` · `NGHI VẤN SỐ LIỆU`.
 *
 * Mở file ra là thấy ngay bức tranh tổng, không phải lội vào từng sheet hóa đơn.
 * Số liệu lấy từ chính kết quả engine (`KetQuaDoiSoat`) nên luôn khớp với màn hình.
 */
import type { KetQuaDoiSoat, NghiVan, SheetHoaDon } from "./doiSoatHddt";

type Workbook = import("exceljs").Workbook;
type Worksheet = import("exceljs").Worksheet;
/** `orderNo` quyết định thứ tự tab lúc ghi — có thật lúc chạy nhưng thiếu trong .d.ts của exceljs. */
type ThuTu = { orderNo: number };

const TEN_NHOM: Record<number, string> = {
  1: "CỘNG KHÔNG KHỚP",
  2: "THIẾU Ô CHƯA THUẾ/THUẾ",
  3: "GẦN KHỚP",
  4: "THIẾU CẢ CỤM",
  5: "TỔNG BỊ XÓA",
  6: "CỘT QUY ĐỔI PHỤ",
  7: "SHEET TRÙNG LẶP",
};

const NEN_TIEU_DE = "FFD9E1F2";
const NEN_TITLE = "FF17529C";
const NEN_DAT = "FFC6EFCE";
const NEN_TRUOT = "FFFFC7CE";

const to = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

/** Cộng ba cột tiền + đếm dòng cho một tập dòng hóa đơn. */
interface Cong {
  chua: number;
  thue: number;
  tong: number;
  n: number;
}
const CONG_0: Cong = { chua: 0, thue: 0, tong: 0, n: 0 };
function cong(sheets: readonly SheetHoaDon[], loc: (d: SheetHoaDon["dong"][number]) => boolean): Cong {
  const r = { ...CONG_0 };
  for (const sh of sheets)
    for (const d of sh.dong)
      if (loc(d)) {
        r.chua += d.chuaThueVnd;
        r.thue += d.thueVnd;
        r.tong += d.tongTtVnd;
        r.n++;
      }
  return r;
}

/** Bỏ ô SỐ DÒNG: dòng suy ra (hiệu/tổng) thì đếm dòng vô nghĩa. */
const khongDem = (c: Cong): Cong => ({ ...c, n: 0 });
const am = (c: Cong): Cong => ({ chua: -c.chua, thue: -c.thue, tong: -c.tong, n: -c.n });
const tru = (a: Cong, b: Cong): Cong => ({
  chua: a.chua - b.chua,
  thue: a.thue - b.thue,
  tong: a.tong - b.tong,
  n: a.n - b.n,
});

/** Một dòng chỉ tiêu ở sheet ĐỐI CHIẾU TỔNG. */
type DongChiTieu = [string, Cong | null, string, string, boolean?];

function bangChiTieu(ws: Worksheet, tuDong: number, dong: readonly DongChiTieu[]): number {
  let r = tuDong;
  for (const [ten, so, nguon, cach, dam] of dong) {
    if (ten === "") {
      r++;
      continue;
    }
    ws.getCell(r, 1).value = ten;
    if (so) {
      ws.getCell(r, 2).value = so.chua;
      ws.getCell(r, 3).value = so.thue;
      ws.getCell(r, 4).value = so.tong;
      if (so.n !== 0) ws.getCell(r, 5).value = so.n;
      for (let c = 2; c <= 4; c++) ws.getCell(r, c).numFmt = "#,##0.00";
      ws.getCell(r, 5).numFmt = "#,##0";
    }
    ws.getCell(r, 6).value = nguon;
    ws.getCell(r, 7).value = cach;
    if (dam) for (let c = 1; c <= 7; c++) ws.getCell(r, c).font = { bold: true };
    for (let c = 1; c <= 7; c++) ws.getCell(r, c).alignment = { vertical: "top", wrapText: c >= 6 };
    r++;
  }
  return r;
}

function tieuDeBang(ws: Worksheet, hang: number, cot: readonly string[]): void {
  cot.forEach((t, i) => {
    const o = ws.getCell(hang, i + 1);
    o.value = t;
    o.font = { bold: true };
    o.fill = to(NEN_TIEU_DE);
    o.alignment = { vertical: "middle", wrapText: true };
    o.border = {
      left: { style: "thin" }, right: { style: "thin" },
      top: { style: "thin" }, bottom: { style: "thin" },
    };
  });
}

function tieuDeTrang(ws: Worksheet, tieuDe: string, moTa: readonly string[]): void {
  const o = ws.getCell(1, 1);
  o.value = tieuDe;
  o.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  o.fill = to(NEN_TITLE);
  moTa.forEach((m, i) => {
    ws.getCell(2 + i, 1).value = m;
    ws.getCell(2 + i, 1).font = { italic: true, size: 10 };
  });
}

/** Sheet 1 — ĐỐI CHIẾU TỔNG. */
function sheetDoiChieuTong(wb: Workbook, kq: KetQuaDoiSoat): Worksheet {
  const ws = wb.addWorksheet("ĐỐI CHIẾU TỔNG");
  [46, 22, 22, 24, 10, 46, 60].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const hd = kq.sheetsHoaDon.filter((s) => !s.laPhu);
  const tenSo = kq.sheetPhanMem?.ten ?? "(không có sheet sổ)";
  const A = cong(hd, () => true);
  const K = cong(hd, (d) => d.trangThai === "KHOP");
  const L = cong(hd, (d) => d.trangThai === "LECH");
  const T = cong(hd, (d) => d.trangThai === "THIEU");
  // Tách riêng phần "chưa vào sổ nhưng ĐÚNG là không cần vào sổ" (hóa đơn đã bị
  // thay thế/hủy) — không đổi nhóm đếm, chỉ cho kế toán biết phải rà bao nhiêu thật.
  const Tkhong = cong(hd, (d) => d.trangThai === "THIEU" && d.khongCanVaoSo);
  const kiemTra = tru(A, { chua: K.chua + L.chua + T.chua, thue: K.thue + L.thue + T.thue, tong: K.tong + L.tong + T.tong, n: K.n + L.n + T.n });

  const pm = kq.sheetPhanMem;
  const congPm = (loc: (d: NonNullable<typeof pm>["dong"][number]) => boolean): Cong => {
    const r = { ...CONG_0 };
    for (const d of pm?.dong ?? [])
      if (loc(d)) {
        r.chua += d.chuaThue;
        r.thue += d.thue;
        r.tong += d.tongCong;
        r.n++;
      }
    return r;
  };
  const B = congPm(() => true);
  const Bco = congPm((d) => d.trangThai === "CO");
  const Bthieu = congPm((d) => d.trangThai === "THIEU");

  const chuaKe = tru(tru(A, K), L);
  const chenhCachTinh = tru(chuaKe, T);
  const truCheo = tru(A, Bco);
  const chenhTruCheo = tru(truCheo, chuaKe);
  const kiemChung = tru({ chua: K.chua + L.chua, thue: K.thue + L.thue, tong: K.tong + L.tong, n: 0 }, Bco);
  let tongCotChenh = 0;
  for (const sh of hd) for (const d of sh.dong) if (d.chenh != null) tongCotChenh += d.chenh;

  tieuDeTrang(ws, "ĐỐI CHIẾU TỔNG – HÓA ĐƠN ĐẦU VÀO", [
    `Sổ kế toán dùng làm chuẩn: sheet "${tenSo}". Dữ liệu gốc KHÔNG bị sửa — mọi chỗ nghi sai liệt kê ở sheet NGHI VẤN SỐ LIỆU.`,
    `Ngưỡng coi là khớp: ${kq.nguong.toLocaleString("vi-VN")} đ. Cột F cho biết số lấy từ đâu, cột G hướng dẫn tự kiểm lại bằng tay.`,
  ]);
  tieuDeBang(ws, 5, ["CHỈ TIÊU", "TRƯỚC THUẾ", "THUẾ", "TỔNG THANH TOÁN", "SỐ DÒNG", "NGUỒN SỐ LIỆU", "CÁCH TỰ KIỂM TRA LẠI"]);

  let r = bangChiTieu(ws, 6, [
    ["A. Tổng các sheet hóa đơn điện tử", A, 'Cộng cột "Chưa thuế (VND)", "Thuế (VND)", "Tổng thanh toán (VND)" của các sheet hóa đơn.', "Mở từng sheet, bôi đen cột cần cộng từ dòng đầu dữ liệu tới dòng cuối, đọc ô Sum dưới thanh trạng thái.", true],
    ["   – nhóm KHỚP (số trên hóa đơn)", K, 'Cộng ba cột VND với điều kiện cột A (KẾT QUẢ) = "KHỚP".', "Lọc cột A = KHỚP rồi cộng cột VND tương ứng."],
    ["   – nhóm LỆCH TIỀN (số trên hóa đơn)", L, 'Điều kiện cột A = "LỆCH TIỀN".', "Lọc cột A = LỆCH TIỀN, soát cột Chênh lệch."],
    [`   – nhóm CHƯA CÓ TRONG ${tenSo}`, T, `Điều kiện cột A = "CHƯA CÓ TRONG ${tenSo}".`, "Lọc cột A = CHƯA CÓ. Đây là danh sách cần rà để hạch toán."],
    ["        trong đó: đã bị thay thế/hủy — ĐÚNG là không vào sổ", Tkhong, 'Trong nhóm CHƯA CÓ, lọc cột A = "…KHÔNG CẦN VÀO SỔ".', "Trừ dòng này ra khỏi danh sách phải đi hạch toán — hóa đơn đã bị thay thế thì kế toán ghi bản thay thế, không ghi bản này."],
    ["        ⇒ CÒN LẠI THẬT SỰ PHẢI RÀ", tru(T, Tkhong), "Nhóm CHƯA CÓ trừ dòng ngay trên.", "Đây mới là con số đi làm việc.", true],
    ["KIỂM TRA: dòng A trừ ba nhóm phải bằng 0", khongDem(kiemTra), "Mỗi hóa đơn chỉ mang một nhãn.", "Khác 0 nghĩa là có dòng bị thêm, bị xóa, hoặc ô KẾT QUẢ bị ghi đè.", true],
    ["", null, "", ""],
    [`B. Sổ kế toán (sheet "${tenSo}")`, B, "Cộng cột tổng cộng của sổ.", "Bôi đen cột tổng cộng và đọc ô Sum.", true],
    ["   – dòng sổ ĐÃ CÓ hóa đơn điện tử", Bco, 'Điều kiện cột A của sổ = "ĐÃ CÓ HĐĐT".', "Mỗi dòng có cột BẰNG CHỨNG ĐỐI CHIẾU ghi rõ khớp hóa đơn nào, sheet nào."],
    ["   – dòng sổ KHÔNG CÓ trên hóa đơn điện tử", Bthieu, 'Điều kiện cột A của sổ = "KHÔNG CÓ TRÊN HĐĐT".', "Lọc cột A của sổ để ra danh sách đầy đủ."],
    ["", null, "", ""],
    ["C. CÁCH TÍNH ĐÚNG PHẦN CHƯA KÊ", null, "", "Phải trừ SỐ TRÊN HÓA ĐƠN của các nhóm đã đối chiếu được, không trừ số bên sổ.", true],
    ["   Tổng các sheet", khongDem(A), "Lấy lại dòng A.", ""],
    ["   trừ nhóm KHỚP (số trên hóa đơn)", khongDem(am(K)), "Đổi dấu dòng nhóm KHỚP.", ""],
    ["   trừ nhóm LỆCH TIỀN (số trên hóa đơn)", khongDem(am(L)), "Đổi dấu dòng nhóm LỆCH TIỀN.", ""],
    ["   = PHẦN CHƯA KÊ", khongDem(chuaKe), "Cộng ba dòng trên.", "", true],
    ["   Đối chiếu với tổng nhóm CHƯA CÓ", khongDem(T), "Lấy lại dòng nhóm CHƯA CÓ.", ""],
    ["   CHÊNH LỆCH – phải bằng 0", khongDem(chenhCachTinh), "Hai cách tính phải cho cùng một số.", "Bằng 0 thì con số phần chưa kê là đáng tin.", true],
    ["", null, "", ""],
    ['D. VÌ SAO KHÔNG LẤY "TỔNG TRỪ TỔNG SỔ"', null, "", "Bốn dòng dưới chỉ rõ phần chênh đến từ đâu.", true],
    ["   Tổng các sheet trừ sổ (dòng sổ đã có HĐĐT)", khongDem(truCheo), 'Dòng A trừ dòng B "ĐÃ CÓ HĐĐT".', ""],
    ["   Phần chưa kê thật", khongDem(chuaKe), 'Lấy lại dòng "= PHẦN CHƯA KÊ".', ""],
    ["   Chênh", khongDem(chenhTruCheo), "Hiệu hai dòng trên.", "KHÔNG phải hóa đơn bị sót, mà là chênh giữa số trên hóa đơn và số trên sổ của những hóa đơn ĐÃ đối chiếu được."],
    ["   Kiểm chứng: (KHỚP + LỆCH phía hóa đơn) trừ sổ", khongDem(kiemChung), "Cách tính khác cho cùng con số.", "Hai dòng này phải giống hệt nhau."],
    ['   Kiểm chứng tiếp: tổng cột "Chênh lệch"', { chua: 0, thue: 0, tong: tongCotChenh, n: 0 }, 'Cộng cột "Chênh lệch" của các sheet.', "Chỉ áp dụng cho cột Tổng thanh toán."],
  ]);

  if (kq.cauNoi.bocTach.length) {
    r++;
    ws.getCell(r, 1).value = "BÓC TÁCH PHẦN CHÊNH — đến từ những hóa đơn nào";
    ws.getCell(r, 1).font = { bold: true };
    r++;
    tieuDeBang(ws, r, ["HÓA ĐƠN / LÝ DO", "", "", "SỐ TIỀN", "", "", ""]);
    r++;
    for (const b of kq.cauNoi.bocTach) {
      ws.getCell(r, 1).value = b.mo;
      ws.getCell(r, 4).value = b.tien;
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r++;
    }
  }

  r++;
  ws.getCell(r, 1).value =
    "DỮ LIỆU GỐC GIỮ NGUYÊN 100%. Mọi chỗ nghi sai liệt kê ở sheet NGHI VẤN SỐ LIỆU, không ô nào bị tự động sửa.";
  ws.getCell(r, 1).font = { bold: true, italic: true };
  ws.views = [{ state: "frozen", ySplit: 5 }];
  return ws;
}

/** Sheet 2 — TỰ KIỂM TRA. */
function sheetTuKiemTra(wb: Workbook, kq: KetQuaDoiSoat): Worksheet {
  const ws = wb.addWorksheet("TỰ KIỂM TRA");
  [6, 58, 16, 20, 14, 92].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const dat = kq.phepThu.filter((p) => p.dat).length;
  const tong = kq.phepThu.length;

  tieuDeTrang(ws, `TỰ KIỂM TRA – ${tong} PHÉP THỬ CHẠY TỰ ĐỘNG`, [
    "Máy tự chấm ngay lúc xuất file. Phép nào KHÔNG ĐẠT là chỗ phải soát trước khi tin con số tổng.",
  ]);
  ws.getCell(4, 1).value = "KẾT QUẢ CHUNG";
  ws.getCell(4, 1).font = { bold: true };
  ws.getCell(4, 2).value = dat === tong ? `ĐẠT TẤT CẢ ${dat}/${tong}` : `CÓ ${tong - dat} PHÉP CHƯA ĐẠT (${dat}/${tong})`;
  ws.getCell(4, 2).font = { bold: true };
  ws.getCell(4, 2).fill = to(dat === tong ? NEN_DAT : NEN_TRUOT);

  tieuDeBang(ws, 6, ["STT", "NỘI DUNG PHÉP THỬ", "KỲ VỌNG", "KẾT QUẢ", "ĐÁNH GIÁ", "PHÉP THỬ NÀY BẮT LỖI GÌ"]);
  kq.phepThu.forEach((p, i) => {
    const r = 7 + i;
    ws.getCell(r, 1).value = i + 1;
    ws.getCell(r, 2).value = p.ten;
    ws.getCell(r, 3).value = p.mong;
    ws.getCell(r, 4).value = p.thuc;
    ws.getCell(r, 5).value = p.dat ? "ĐẠT" : "KHÔNG ĐẠT";
    ws.getCell(r, 5).fill = to(p.dat ? NEN_DAT : NEN_TRUOT);
    ws.getCell(r, 6).value = p.batLoiGi;
    for (let c = 1; c <= 6; c++) ws.getCell(r, c).alignment = { vertical: "top", wrapText: c === 2 || c === 6 };
  });
  ws.views = [{ state: "frozen", ySplit: 6 }];
  return ws;
}

/** Sheet 3 — NGHI VẤN SỐ LIỆU. */
function sheetNghiVan(wb: Workbook, kq: KetQuaDoiSoat): Worksheet {
  const ws = wb.addWorksheet("NGHI VẤN SỐ LIỆU");
  [6, 24, 34, 22, 22, 46, 46, 46, 46].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const tong = kq.nghiVan.length + kq.nghiVanGop.length;

  tieuDeTrang(ws, `NGHI VẤN SỐ LIỆU – ${tong} chỗ cần soát lại`, [
    "Không có ô dữ liệu nào trong file bị tự động sửa. Đây là danh sách để người soát tự quyết.",
    'Cột "VỊ TRÍ CHÍNH XÁC" trỏ đúng ô trong CHÍNH FILE NÀY (đã tính cả cột KẾT QUẢ chèn thêm ở đầu).',
  ]);
  tieuDeBang(ws, 5, [
    "STT", "NHÓM", "VỊ TRÍ CHÍNH XÁC", "SỐ ĐANG CÓ TRONG FILE", "SỐ ĐỐI CHỨNG",
    "SỐ ĐỐI CHỨNG LẤY Ở ĐÂU RA", "SAI Ở CHỖ NÀO", "ẢNH HƯỞNG", "AI LÀM GÌ",
  ]);

  const aiLamGi = (nv: NghiVan): string =>
    nv.giaTriDung != null
      ? "Máy suy được số đúng — bấm Sửa trên màn hình nếu xác nhận, giá trị cũ vẫn giữ ở sheet NHẬT KÝ SỬA."
      : "Không suy được số đúng — hỏi lại người bán hoặc xin lại bản xuất gốc từ cổng thuế.";

  let r = 6;
  kq.nghiVan.forEach((nv, i) => {
    const o = [
      i + 1, `Nhóm ${nv.nhom} · ${TEN_NHOM[nv.nhom] ?? ""}`, nv.viTriXuat ?? nv.viTri,
      nv.soDangCo, nv.soDoiChung, nv.nguonDoiChung, nv.saiOCho, nv.anhHuong, aiLamGi(nv),
    ];
    o.forEach((v, c) => {
      ws.getCell(r, c + 1).value = v as never;
      ws.getCell(r, c + 1).alignment = { vertical: "top", wrapText: c >= 2 };
    });
    r++;
  });
  kq.nghiVanGop.forEach((g, i) => {
    const o = [
      kq.nghiVan.length + i + 1, `Nhóm ${g.nhom} · ${TEN_NHOM[g.nhom] ?? ""}`, g.ten,
      `${g.soDong} dòng`, `${g.tongTien.toLocaleString("vi-VN")} đ`, "gộp thống kê (xem chi tiết trên màn hình)",
      g.canhBao, "xem cảnh báo bên cạnh", "Soát theo cảnh báo rồi xác nhận bản chốt.",
    ];
    o.forEach((v, c) => {
      ws.getCell(r, c + 1).value = v as never;
      ws.getCell(r, c + 1).alignment = { vertical: "top", wrapText: c >= 2 };
    });
    r++;
  });
  if (tong === 0) {
    ws.getCell(6, 1).value = "Không có chỗ nào nghi vấn.";
    ws.getCell(6, 1).font = { italic: true };
  }
  ws.views = [{ state: "frozen", ySplit: 5 }];
  return ws;
}

/** Dựng 3 sheet tổng hợp và đẩy chúng lên ĐẦU workbook. */
export function themSheetTongHop(wb: Workbook, kq: KetQuaDoiSoat): void {
  // Chạy lại trên file đã xuất: bỏ bản cũ đi rồi dựng lại, kẻo trùng tên.
  for (const ten of ["ĐỐI CHIẾU TỔNG", "TỰ KIỂM TRA", "NGHI VẤN SỐ LIỆU"]) {
    const cu = wb.worksheets.find((w) => w.name === ten);
    if (cu) wb.removeWorksheet(cu.id);
  }
  // Sheet gốc lùi về sau; 3 sheet tổng hợp chiếm 3 chỗ đầu.
  wb.worksheets.forEach((w, i) => ((w as unknown as ThuTu).orderNo = 10 + i));
  const ds = [sheetDoiChieuTong(wb, kq), sheetTuKiemTra(wb, kq), sheetNghiVan(wb, kq)];
  ds.forEach((w, i) => ((w as unknown as ThuTu).orderNo = i));
}
