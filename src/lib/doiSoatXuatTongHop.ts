/**
 * Ba sheet tổng hợp đứng ĐẦU file xuất — dựng theo đúng bố cục file mẫu kế toán
 * đang dùng: `ĐỐI CHIẾU TỔNG` · `TỰ KIỂM TRA` · `NGHI VẤN SỐ LIỆU`.
 *
 * Mở file ra là thấy ngay bức tranh tổng, không phải lội vào từng sheet hóa đơn.
 * Số liệu lấy từ chính kết quả engine (`KetQuaDoiSoat`) nên luôn khớp với màn hình.
 */
import type { KetQuaDoiSoat, NghiVan, SheetHoaDon } from "./doiSoatHddt";
import type { KetQuaSoHaiBan, NhomCungNgay } from "./doiSoatHaiBan";
import { gomCungMstCungNgay, soHaiBanHddt } from "./doiSoatHaiBan";

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
    kq.sheetPhanMem
      ? `Sổ kế toán dùng làm chuẩn: sheet "${tenSo}". Dữ liệu gốc KHÔNG bị sửa — mọi chỗ nghi sai liệt kê ở sheet NGHI VẤN SỐ LIỆU.`
      : '⚠️ FILE NÀY KHÔNG CÓ SHEET SỔ KẾ TOÁN nên cả bảng dưới đây KHÔNG dùng được (mọi hóa đơn đều rơi vào nhóm "chưa vào sổ"). Xem sheet SO HAI BẢN HĐĐT — đó mới là kết quả của file này.',
    `Ngưỡng coi là khớp: ${kq.nguong.toLocaleString("vi-VN")} đ. Cột F cho biết số lấy từ đâu, cột G hướng dẫn tự kiểm lại bằng tay.`,
  ]);
  if (kq.sheetPhanMem) {
    // Chỉ đường thẳng tới danh sách đi hạch toán — kế toán từng phản ánh "không thấy lọc chưa kê".
    const o = ws.getCell(4, 1);
    const nghi = hd.reduce((n, sh) => n + sh.dong.filter((d) => d.trangThai === "THIEU" && !d.khongCanVaoSo && d.ganKhopMoTa).length, 0);
    o.value = `→ DANH SÁCH HÓA ĐƠN CHƯA KÊ đã lọc sẵn ở sheet kế bên "HÓA ĐƠN CHƯA KÊ": ${T.n - Tkhong.n - nghi} hóa đơn phải kê${nghi ? ` + ${nghi} hóa đơn nghi đã kê nhưng gõ sai số ở sổ` : ""}.`;
    o.font = { bold: true, color: { argb: "FF9C0006" } };
  }
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

const NEN_NGHI = "FFFFEB9C";

/** "dd/mm/yyyy" → "yyyymmdd" để xếp theo ngày. */
const khoaNgay = (s: string): string => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s.trim());
  return m ? `${m[3]}${m[2]!.padStart(2, "0")}${m[1]!.padStart(2, "0")}` : s;
};

/**
 * Sheet HÓA ĐƠN CHƯA KÊ — danh sách LỌC SẴN, không bắt kế toán tự lọc cột A.
 *
 * Kế toán phản ánh "không thấy lọc chưa kê": nhãn có sẵn ở cột A từng sheet, nhưng
 * phải biết mà lọc, lại rải qua nhiều sheet. Đây là thứ họ cần nhất — danh sách đi
 * hạch toán — nên dựng riêng, xếp theo ngày lập, có dòng cộng.
 *
 * LOẠI hóa đơn `khongCanVaoSo` (đã bị thay thế/hủy — quy tắc 2026-09-16): liệt kê vào
 * đây là bắt người ta đi kê oan. Chúng được nêu riêng ở cuối cho minh bạch.
 * Phần 2: dòng sổ KHÔNG có hóa đơn điện tử (chiều ngược lại).
 */
function sheetChuaKe(wb: Workbook, kq: KetQuaDoiSoat): Worksheet {
  const ws = wb.addWorksheet("HÓA ĐƠN CHƯA KÊ");
  [6, 12, 14, 12, 18, 42, 18, 16, 18, 20, 20, 56].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const hd = kq.sheetsHoaDon.filter((sh) => !sh.laPhu);
  const tatCa = hd.flatMap((sh) => sh.dong.filter((d) => d.trangThai === "THIEU"));
  const theoNgay = (a: (typeof tatCa)[number], b: (typeof tatCa)[number]) =>
    khoaNgay(a.ngayLap).localeCompare(khoaNgay(b.ngayLap)) || a.tenBan.localeCompare(b.tenBan, "vi");
  // Có "gần khớp" (cùng MST + cùng số tiền với một dòng sổ không ghép được) ⇒ nhiều
  // khả năng ĐÃ KÊ, chỉ gõ sai số hóa đơn ở sổ. Tách riêng kẻo kế toán đi kê trùng.
  // Vẫn để trong sheet này (chỉ là gợi ý của máy, người phải xác nhận).
  const phaiKe = tatCa.filter((d) => !d.khongCanVaoSo && !d.ganKhopMoTa).sort(theoNgay);
  const nghiSaiSo = tatCa.filter((d) => !d.khongCanVaoSo && d.ganKhopMoTa).sort(theoNgay);
  const boQua = tatCa.filter((d) => d.khongCanVaoSo);
  const tenSo = kq.sheetPhanMem?.ten ?? "sổ kế toán";
  const tongKe = phaiKe.reduce((t, d) => t + d.tongTtVnd, 0);

  tieuDeTrang(ws, `HÓA ĐƠN CHƯA KÊ — ${phaiKe.length} hóa đơn · ${Math.round(tongKe).toLocaleString("vi-VN")} đ`, [
    `Hóa đơn có trên cổng thuế nhưng CHƯA có trong sheet "${tenSo}". Xếp theo ngày lập. Đây là danh sách đi hạch toán.`,
    [
      nghiSaiSo.length
        ? `Tách riêng ${nghiSaiSo.length} hóa đơn NGHI ĐÃ KÊ NHƯNG GÕ SAI SỐ HÓA ĐƠN ở sổ (cùng MST + cùng số tiền) — xem mục ngay dưới bảng chính, xác nhận rồi sửa số ở sổ, đừng kê thêm.`
        : "",
      boQua.length ? `Loại ${boQua.length} hóa đơn đã bị thay thế/hủy (không cần kê) — nêu ở cuối sheet.` : "",
    ].filter(Boolean).join(" ") || "Không có hóa đơn nào nghi gõ sai số hay bị thay thế/hủy trong nhóm này.",
  ]);

  const dauBang = 5;
  const cot = [
    "STT", "Ký hiệu", "Số hóa đơn", "Ngày lập", "MST người bán", "Tên người bán",
    "Chưa thuế (VND)", "Thuế (VND)", "Tổng thanh toán (VND)", "Trạng thái hóa đơn",
    "Vị trí trong file", "Ghi chú",
  ];
  tieuDeBang(ws, dauBang, cot);
  let r = dauBang + 1;
  const ghiDong = (d: (typeof tatCa)[number], stt: number, nen?: string) => {
    const o = [
      stt, d.kyHieu, d.soHoaDon, d.ngayLap, d.mstBan, d.tenBan,
      d.chuaThueVnd, d.thueVnd, d.tongTtVnd, d.trangThaiHd,
      `${d.sheet} dòng ${d.dongFile}`, d.ganKhopMoTa ?? "",
    ];
    o.forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = (v === "" ? null : v) as never;
      if (c >= 6 && c <= 8) cell.numFmt = "#,##0";
      cell.alignment = { vertical: "top", wrapText: c === 5 || c === 11 };
      if (nen) cell.fill = to(nen);
    });
    r++;
  };
  phaiKe.forEach((d, i) => ghiDong(d, i + 1));

  // dòng cộng
  ws.getCell(r, 6).value = `CỘNG ${phaiKe.length} hóa đơn`;
  const tongCot: [number, number][] = [
    [7, phaiKe.reduce((t, d) => t + d.chuaThueVnd, 0)],
    [8, phaiKe.reduce((t, d) => t + d.thueVnd, 0)],
    [9, tongKe],
  ];
  for (const [c, v] of tongCot) {
    ws.getCell(r, c).value = v;
    ws.getCell(r, c).numFmt = "#,##0";
  }
  for (let c = 1; c <= cot.length; c++) {
    ws.getCell(r, c).font = { bold: true };
    ws.getCell(r, c).border = { top: { style: "thin" } };
  }
  if (!phaiKe.length) {
    ws.getCell(dauBang + 1, 1).value = "Không có hóa đơn nào chưa kê.";
    ws.getCell(dauBang + 1, 1).font = { italic: true };
  }
  ws.autoFilter = { from: { row: dauBang, column: 1 }, to: { row: dauBang, column: cot.length } };
  r += 2;

  if (nghiSaiSo.length) {
    ws.getCell(r, 1).value = `NGHI ĐÃ KÊ NHƯNG GÕ SAI SỐ HÓA ĐƠN Ở SỔ — ${nghiSaiSo.length} hóa đơn (cùng MST + cùng số tiền với một dòng sổ ở mục cuối). Xác nhận rồi SỬA SỐ Ở SỔ, đừng kê thêm lần nữa.`;
    ws.getCell(r, 1).font = { bold: true, color: { argb: "FF9C6500" } };
    r++;
    tieuDeBang(ws, r, cot);
    r++;
    nghiSaiSo.forEach((d, i) => ghiDong(d, i + 1, NEN_NGHI));
    r += 1;
  }

  if (boQua.length) {
    ws.getCell(r, 1).value = `KHÔNG CẦN KÊ — ${boQua.length} hóa đơn đã bị thay thế/hủy (kế toán hạch toán bản thay thế)`;
    ws.getCell(r, 1).font = { bold: true };
    r++;
    tieuDeBang(ws, r, cot);
    r++;
    boQua.forEach((d, i) => ghiDong(d, i + 1, "FFE7E6E6"));
    r += 1;
  }

  // Phần 2 — chiều ngược: dòng sổ không có hóa đơn điện tử
  const soThieu = (kq.sheetPhanMem?.dong ?? []).filter((d) => d.trangThai === "THIEU");
  ws.getCell(r, 1).value = `DÒNG SỔ KHÔNG CÓ HÓA ĐƠN ĐIỆN TỬ — ${soThieu.length} dòng (đã kê nhưng không tìm thấy hóa đơn trên cổng thuế)`;
  ws.getCell(r, 1).font = { bold: true };
  r++;
  tieuDeBang(ws, r, [
    "STT", "Ký hiệu", "Số hóa đơn", "Ngày HĐ", "MST người bán", "Tên người bán",
    "Số phiếu", "CTGS", "Tổng cộng (VND)", "", "Vị trí trong file", "Ghi chú",
  ]);
  r++;
  soThieu.forEach((d, i) => {
    const o = [
      i + 1, d.kyHieu, d.soHoaDon, d.ngayHd, d.mstBan, d.tenBan,
      d.phieu, d.ctgs, d.tongCong, "", `${d.sheet} dòng ${d.dongFile}`, d.ganKhopMoTa ?? "",
    ];
    o.forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = (v === "" ? null : v) as never;
      if (c === 8) cell.numFmt = "#,##0";
      cell.alignment = { vertical: "top", wrapText: c === 5 || c === 11 };
    });
    r++;
  });
  if (!soThieu.length) ws.getCell(r, 1).value = "Không có — mọi dòng sổ đều tìm thấy hóa đơn điện tử.";

  ws.views = [{ state: "frozen", ySplit: dauBang }];
  return ws;
}

/** Sheet SO HAI BẢN — chỉ dựng khi file có cả bản thuế gửi lẫn bản tự tải. */
function sheetSoHaiBan(wb: Workbook, so: KetQuaSoHaiBan): Worksheet {
  const ws = wb.addWorksheet("SO HAI BẢN HĐĐT");
  [26, 16, 16, 14, 40, 18, 18, 18, 16, 26, 26, 64].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  tieuDeTrang(ws, "SO HAI BẢN HÓA ĐƠN ĐIỆN TỬ — bản cơ quan thuế gửi ⇄ bản tự tải", [
    `Bản THUẾ: ${so.sheetThue.join(" + ")} (${so.tong.soThue} hóa đơn)  ·  Bản TỰ TẢI: ${so.sheetTai.join(" + ")} (${so.tong.soTai} hóa đơn)`,
    `Ghép theo khóa MST người bán | ký hiệu | số hóa đơn. Dòng xếp theo mức độ phải xử: thiếu ở bản tự tải lên trước.`,
  ]);
  const t = so.tong;
  const tomTat: [string, string][] = [
    ["CHỈ bản THUẾ có — bản tự tải THIẾU", `${t.chiThue} hóa đơn · ${Math.round(t.tienChiThue).toLocaleString("vi-VN")} đ`],
    ["CHỈ bản TỰ TẢI có — thuế không gửi", `${t.chiTai} hóa đơn · ${Math.round(t.tienChiTai).toLocaleString("vi-VN")} đ`],
    ["Có cả hai bản nhưng LỆCH TIỀN", `${t.lechTien} hóa đơn`],
    ["Có cả hai bản, KHÔNG so được tiền (dòng lệch bố cục cột)", `${t.khongSoDuocTien} hóa đơn`],
    ["Khớp cả hai bản", `${t.caHai - t.lechTien - t.khongSoDuocTien} hóa đơn`],
    ["Tổng tiền hai bản", `thuế ${Math.round(t.tienThue).toLocaleString("vi-VN")} đ / tự tải ${Math.round(t.tienTai).toLocaleString("vi-VN")} đ / chênh ${Math.round(t.chenhTongTien).toLocaleString("vi-VN")} đ`],
  ];
  tomTat.forEach(([a, b], i) => {
    ws.getCell(4 + i, 1).value = a;
    ws.getCell(4 + i, 1).font = { bold: true };
    ws.getCell(4 + i, 2).value = b;
  });

  const hang = 4 + tomTat.length + 1;
  tieuDeBang(ws, hang, [
    "KẾT QUẢ", "Ký hiệu", "Số hóa đơn", "Ngày lập", "Người bán", "MST người bán",
    "Tổng TT bản THUẾ", "Tổng TT bản TỰ TẢI", "Chênh", "Vị trí bản THUẾ", "Vị trí bản TỰ TẢI", "PHẢI LÀM GÌ",
  ]);
  const nhan: Record<string, string> = {
    CHI_THUE: "BẢN TỰ TẢI THIẾU", CHI_TAI: "THUẾ KHÔNG GỬI", CA_HAI: "CÓ CẢ HAI",
  };
  so.dong.forEach((d, i) => {
    const r = hang + 1 + i;
    const o = [
      d.ben === "CA_HAI" ? (d.khongSoDuocTien ? "KHÔNG SO ĐƯỢC TIỀN" : d.lechTien ? "LỆCH TIỀN" : "KHỚP") : nhan[d.ben],
      d.kyHieu, d.soHoaDon, d.ngayLap, d.tenBan, d.mstBan,
      d.tongT, d.tongX, d.chenhTong, d.viTriT, d.viTriX, d.ghiChu,
    ];
    o.forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = (v ?? null) as never;
      if (c >= 6 && c <= 8) cell.numFmt = "#,##0.00";
      cell.alignment = { vertical: "top", wrapText: c === 4 || c >= 9 };
    });
    const nen =
      d.ben === "CHI_THUE" ? NEN_TRUOT
      : d.ben === "CHI_TAI" ? NEN_NGHI
      : d.lechTien ? NEN_NGHI
      : d.khongSoDuocTien ? "FFE7E6E6"
      : NEN_DAT;
    for (let c = 1; c <= 12; c++) ws.getCell(r, c).fill = to(nen);
  });
  ws.autoFilter = { from: { row: hang, column: 1 }, to: { row: hang, column: 12 } };
  ws.views = [{ state: "frozen", ySplit: hang }];
  return ws;
}

/** Sheet CÙNG MST + CÙNG NGÀY — lọc hóa đơn nghi trùng / nghi tách đơn. */
function sheetCungNgay(wb: Workbook, nhom: readonly NhomCungNgay[]): Worksheet {
  const ws = wb.addWorksheet("CÙNG MST CÙNG NGÀY");
  [22, 14, 40, 20, 10, 20, 16, 18, 22, 40].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const nghi = nhom.filter((g) => g.trungSoTien).length;
  tieuDeTrang(ws, "HÓA ĐƠN CÙNG MỘT NHÀ CUNG CẤP, CÙNG MỘT NGÀY", [
    `${nhom.length} nhóm · ${nhom.reduce((s, g) => s + g.soHoaDon, 0)} hóa đơn. Trong đó ${nghi} nhóm có hóa đơn TRÙNG KHÍT số tiền (tô vàng) — chỗ dễ kê hai lần nhất.`,
    "Nhiều hóa đơn cùng nhà cung cấp trong một ngày KHÔNG có nghĩa là sai (xăng dầu, siêu thị…). Đây chỉ là danh sách để soát bằng mắt.",
  ]);
  tieuDeBang(ws, 5, [
    "NGHI TRÙNG", "Ngày lập", "Người bán", "MST người bán", "Số HĐ trong ngày",
    "Tổng tiền cả nhóm", "Ký hiệu", "Số hóa đơn", "Tổng thanh toán (VND)", "Vị trí · kết quả đối soát",
  ]);
  let r = 6;
  for (const g of nhom) {
    const dau = r;
    g.dong.forEach((d, i) => {
      const o = [
        i === 0 ? (g.trungSoTien ? `CÓ — ${g.moTaTrung}` : "") : "",
        i === 0 ? g.ngay : "", i === 0 ? g.tenBan : "", i === 0 ? g.mstBan : "",
        i === 0 ? g.soHoaDon : "", i === 0 ? g.tongTien : "",
        d.kyHieu, d.soHoaDon, d.tongTtVnd, `${d.sheet} dòng ${d.dongFile} · ${d.ketLuan}`,
      ];
      o.forEach((v, c) => {
        const cell = ws.getCell(r, c + 1);
        cell.value = (v === "" ? null : v) as never;
        if (c === 5 || c === 8) cell.numFmt = "#,##0";
        cell.alignment = { vertical: "top", wrapText: c === 0 || c === 2 || c === 9 };
      });
      if (g.trungSoTien) for (let c = 1; c <= 10; c++) ws.getCell(r, c).fill = to(NEN_NGHI);
      r++;
    });
    // viền dưới cho hết một nhóm, nhìn ra ranh giới
    for (let c = 1; c <= 10; c++) ws.getCell(r - 1, c).border = { bottom: { style: "thin" } };
    if (dau === r) r++;
  }
  if (!nhom.length) {
    ws.getCell(6, 1).value = "Không có nhà cung cấp nào xuất từ 2 hóa đơn trở lên trong cùng một ngày.";
    ws.getCell(6, 1).font = { italic: true };
  }
  ws.views = [{ state: "frozen", ySplit: 5 }];
  return ws;
}

/** Dựng các sheet tổng hợp và đẩy chúng lên ĐẦU workbook. */
export function themSheetTongHop(wb: Workbook, kq: KetQuaDoiSoat): void {
  // Chạy lại trên file đã xuất: bỏ bản cũ đi rồi dựng lại, kẻo trùng tên.
  for (const ten of ["ĐỐI CHIẾU TỔNG", "HÓA ĐƠN CHƯA KÊ", "TỰ KIỂM TRA", "NGHI VẤN SỐ LIỆU", "SO HAI BẢN HĐĐT", "CÙNG MST CÙNG NGÀY"]) {
    const cu = wb.worksheets.find((w) => w.name === ten);
    if (cu) wb.removeWorksheet(cu.id);
  }
  // Sheet gốc lùi về sau; 3 sheet tổng hợp chiếm 3 chỗ đầu.
  wb.worksheets.forEach((w, i) => ((w as unknown as ThuTu).orderNo = 10 + i));
  const soHaiBan = soHaiBanHddt(kq.sheetsHoaDon, kq.nguong);
  const cungNgay = gomCungMstCungNgay(kq.sheetsHoaDon.filter((s) => !s.laPhu));
  // Không có sheet sổ kế toán thì bảng "đối chiếu tổng" vô nghĩa (mọi hóa đơn sẽ
  // rơi vào nhóm chưa vào sổ) — việc thật của file đó là SO HAI BẢN, cho lên đầu.
  const khongCoSo = !kq.sheetPhanMem;
  const ds = [
    ...(soHaiBan && khongCoSo ? [sheetSoHaiBan(wb, soHaiBan)] : []),
    sheetDoiChieuTong(wb, kq),
    // Ngay sau bảng tổng: thứ kế toán cần nhất là danh sách đi hạch toán.
    ...(khongCoSo ? [] : [sheetChuaKe(wb, kq)]),
    ...(soHaiBan && !khongCoSo ? [sheetSoHaiBan(wb, soHaiBan)] : []),
    ...(cungNgay.length ? [sheetCungNgay(wb, cungNgay)] : []),
    sheetTuKiemTra(wb, kq),
    sheetNghiVan(wb, kq),
  ];
  ds.forEach((w, i) => ((w as unknown as ThuTu).orderNo = i));
}
