/**
 * Sheet tổng hợp đứng ĐẦU file xuất (v6.4 — ít sheet, một chỗ trả lời).
 *
 * Kế toán gửi file kèm MỘT câu hỏi ("lọc hóa đơn chưa kê", "cộng cột lệch ở đâu"…).
 * Mở file ra thấy 6 sheet lạ là không biết nhìn đâu. Nên:
 *  - `KẾT LUẬN CHUNG` luôn đứng đầu: trả lời trước (kết luận + xem ở đâu, có đường
 *    link bấm được), số liệu sau, bằng chứng máy tự kiểm ở cuối. Mọi thứ mang tính
 *    TRẢ LỜI/BẰNG CHỨNG gộp vào đây — đối chiếu tổng, cộng cột, chỗ nghi vấn, tự kiểm.
 *  - Sheet riêng CHỈ dành cho danh sách hóa đơn cần lọc/gửi đi, và CHỈ dựng khi kỳ đó
 *    có dữ liệu: `HÓA ĐƠN CHƯA KÊ` · `SO HAI BẢN HĐĐT` · `CÙNG MST CÙNG NGÀY`.
 *  - Chỗ nào dò được trên chính sheet gốc (cột A, cột "Nguyên nhân lệch") thì chỉ
 *    đường tới đó, không chép thành danh sách mới.
 *
 * Số liệu lấy từ chính kết quả engine (`KetQuaDoiSoat`) nên luôn khớp với màn hình.
 */
import type { KetQuaDoiSoat, SheetHoaDon } from "./doiSoatHddt";
import { NHAN_LECH_CONG, SHEET_TU_DUNG } from "./doiSoatHddt";
import type { KetQuaSoHaiBan, NhomCungNgay } from "./doiSoatHaiBan";
import { gomCungMstCungNgay, laBenThue, soHaiBanHddt } from "./doiSoatHaiBan";

type Workbook = import("exceljs").Workbook;
type Worksheet = import("exceljs").Worksheet;
/** `orderNo` quyết định thứ tự tab lúc ghi — có thật lúc chạy nhưng thiếu trong .d.ts của exceljs. */
type ThuTu = { orderNo: number };

/** Tên các sheet tự dựng — phải nằm trong `SHEET_TU_DUNG` để đọc lại bỏ qua, xuất lại xóa đi. */
const TEN = {
  ketLuan: "KẾT LUẬN CHUNG",
  chuaKe: "HÓA ĐƠN CHƯA KÊ",
  haiBan: "SO HAI BẢN HĐĐT",
  cungNgay: "CÙNG MST CÙNG NGÀY",
} as const;

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
const NEN_NGHI = "FFFFEB9C";

const to = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} đ`;
/** Địa chỉ nội bộ tới một ô, dạng `#'Sheet'!A1` — đích của hàm HYPERLINK. */
const lienKet = (sheet: string, o = "A1") => `#'${sheet.replace(/'/g, "''")}'!${o}`;
/**
 * Ô link bấm được bằng CÔNG THỨC `HYPERLINK` — không dùng kiểu link của exceljs vì nó
 * ghi lai (quan hệ ngoài + `location` còn dính dấu #), không chắc mọi bản Excel đọc đúng.
 */
const oLink = (dich: string, chu: string) => {
  const q = (x: string) => `"${x.replace(/"/g, '""')}"`;
  return { formula: `HYPERLINK(${q(dich)},${q(chu)})`, result: chu };
};

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

/** Một dòng chỉ tiêu ở khối SỐ LIỆU ĐỐI CHIẾU. */
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

/** Tiêu đề một khối trong sheet KẾT LUẬN CHUNG. */
function tieuDeKhoi(ws: Worksheet, r: number, ten: string): void {
  const o = ws.getCell(r, 1);
  o.value = ten;
  o.font = { bold: true, size: 12, color: { argb: "FF17529C" } };
}

// ---------------------------------------------------------------------------
// Các khối của sheet KẾT LUẬN CHUNG. Mỗi hàm ghi từ hàng `r`, trả hàng kế tiếp.
// Cả sheet dùng chung 7 cột: A chữ rộng · B–D tiền · E đếm · F–G chữ giải thích.
// ---------------------------------------------------------------------------

/** Khối SỐ LIỆU ĐỐI CHIẾU VỚI SỔ (trước v6.4 là sheet `ĐỐI CHIẾU TỔNG`) — chỉ khi có sổ. */
function khoiDoiChieu(ws: Worksheet, r0: number, kq: KetQuaDoiSoat): number {
  const hd = kq.sheetsHoaDon.filter((s) => !s.laPhu);
  const tenSo = kq.sheetPhanMem?.ten ?? "";
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

  tieuDeKhoi(ws, r0, `SỐ LIỆU ĐỐI CHIẾU VỚI SỔ "${tenSo}"`);
  tieuDeBang(ws, r0 + 1, ["CHỈ TIÊU", "TRƯỚC THUẾ", "THUẾ", "TỔNG THANH TOÁN", "SỐ DÒNG", "NGUỒN SỐ LIỆU", "CÁCH TỰ KIỂM TRA LẠI"]);

  let r = bangChiTieu(ws, r0 + 2, [
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
  return r;
}

/**
 * Khối CỘNG CỘT: Σ chưa thuế + Σ thuế có bằng Σ tổng thanh toán không, lệch thì do đâu.
 * Bảng XOAY (chỉ tiêu theo hàng, mỗi sheet một cột) cho vừa 7 cột của sheet.
 * Từng hóa đơn lệch KHÔNG chép ra đây — đã đánh dấu ngay trên sheet gốc (v6.3).
 */
function khoiCongCot(ws: Worksheet, r0: number, hd: readonly SheetHoaDon[], kiemBangKe: boolean): number {
  tieuDeKhoi(ws, r0, "CỘNG CỘT: chưa thuế + thuế có bằng tổng thanh toán không");
  const cuoi = hd.length + 2; // cột giải thích, ngay sau các cột sheet
  tieuDeBang(ws, r0 + 1, ["CHỈ TIÊU", ...hd.map((s) => `Sheet ${s.ten}`), "CÁCH HIỂU"]);
  const hang: [string, (s: SheetHoaDon) => number, string, "dam"?][] = [
    ["Σ chưa thuế", (s) => s.canDoiCot.sumChua, "Cộng cả cột chưa thuế của sheet."],
    ["Σ thuế", (s) => s.canDoiCot.sumThue, "Cộng cả cột thuế."],
    ["Σ tổng thanh toán", (s) => s.canDoiCot.sumTong, "Cộng cả cột tổng thanh toán."],
    ["LỆCH = Σ tổng thanh toán − (Σ chưa thuế + Σ thuế)", (s) => s.canDoiCot.lech, "Đúng con số kế toán thấy khi tự cộng cột. Bốn dòng dưới cộng lại bằng đúng dòng này.", "dam"],
    ["   do phí", (s) => s.canDoiCot.boc.phi, "Phí là một phần hợp lệ của tổng thanh toán — bình thường."],
    ["   do chiết khấu", (s) => s.canDoiCot.boc.chietKhau, "Chiết khấu thương mại trừ vào tổng — bình thường."],
    ["   do làm tròn ±1đ", (s) => s.canDoiCot.boc.lamTron, "Làm tròn của bên phát hành — bình thường."],
    ["   LỆCH THẬT — phải soát", (s) => s.canDoiCot.boc.lechThat, "Khác 0 là có hóa đơn cộng sai thật.", "dam"],
    ["   số hóa đơn lệch thật", (s) => s.canDoiCot.dongLechThat.length, kiemBangKe
      ? `Lọc cột A (KIỂM CỘNG) = "${NHAN_LECH_CONG.that}" ở sheet đó (dòng tô đỏ).`
      : `Lọc cột "Nguyên nhân lệch" (cột cuối) = "${NHAN_LECH_CONG.that}" ở sheet đó.`],
    ["LỆCH nếu công thức dòng tổng đã cộng phí", (s) => s.canDoiCot.lech - s.canDoiCot.boc.phi, "Σ tổng − (Σ chưa thuế + Σ thuế + Σ phí): con số ở dòng tổng cuối sheet nếu công thức đã cộng phí nhưng CHƯA trừ chiết khấu."],
  ];
  let r = r0 + 2;
  for (const [ten, lay, cach, dam] of hang) {
    ws.getCell(r, 1).value = ten;
    hd.forEach((s, i) => {
      const o = ws.getCell(r, i + 2);
      o.value = lay(s);
      o.numFmt = "#,##0";
    });
    ws.getCell(r, cuoi).value = cach;
    ws.getCell(r, cuoi).alignment = { vertical: "top", wrapText: true };
    if (dam) for (let c = 1; c < cuoi; c++) ws.getCell(r, c).font = { bold: true };
    if (ten.includes("LỆCH THẬT"))
      hd.forEach((s, i) => {
        if (Math.abs(s.canDoiCot.boc.lechThat) > 1) ws.getCell(r, i + 2).fill = to(NEN_TRUOT);
      });
    r++;
  }
  return r;
}

/** Khối CHỖ CẦN SOÁT LẠI (trước v6.4 là sheet `NGHI VẤN SỐ LIỆU`) — chỉ khi có. */
function khoiNghiVan(ws: Worksheet, r0: number, kq: KetQuaDoiSoat): number {
  tieuDeKhoi(ws, r0, `CHỖ CẦN SOÁT LẠI — ${kq.nghiVan.length + kq.nghiVanGop.length} chỗ nghi sai số liệu (không ô nào bị tự động sửa)`);
  tieuDeBang(ws, r0 + 1, [
    "VỊ TRÍ CHÍNH XÁC (trong chính file này)", "SỐ ĐANG CÓ", "SỐ ĐỐI CHỨNG", "NHÓM", "",
    "SAI Ở CHỖ NÀO · số đối chứng lấy từ đâu", "ẢNH HƯỞNG · AI LÀM GÌ",
  ]);
  let r = r0 + 2;
  const ghi = (o: unknown[]) => {
    o.forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = (v === "" ? null : v) as never;
      cell.alignment = { vertical: "top", wrapText: true };
    });
    r++;
  };
  kq.nghiVan.forEach((nv, i) =>
    ghi([
      `${i + 1}. ${nv.viTriXuat ?? nv.viTri}`, nv.soDangCo, nv.soDoiChung, `Nhóm ${nv.nhom} · ${TEN_NHOM[nv.nhom] ?? ""}`, "",
      `${nv.saiOCho}\nSố đối chứng lấy từ: ${nv.nguonDoiChung}`,
      `${nv.anhHuong}\n→ ${nv.giaTriDung != null
        ? "Máy suy được số đúng — bấm Sửa trên màn hình nếu xác nhận, giá trị cũ vẫn giữ ở sheet NHẬT KÝ SỬA."
        : "Không suy được số đúng — hỏi lại người bán hoặc xin lại bản xuất gốc từ cổng thuế."}`,
    ])
  );
  kq.nghiVanGop.forEach((g, i) =>
    ghi([
      `${kq.nghiVan.length + i + 1}. ${g.ten}`, `${g.soDong} dòng`, vnd(g.tongTien), `Nhóm ${g.nhom} · ${TEN_NHOM[g.nhom] ?? ""}`, "",
      `${g.canhBao}\n(gộp thống kê — chi tiết từng dòng xem trên màn hình)`,
      "Soát theo cảnh báo rồi xác nhận bản chốt.",
    ])
  );
  return r;
}

/** Khối TỰ KIỂM TRA (trước v6.4 là sheet riêng) — bằng chứng nội bộ, đứng CUỐI. */
function khoiTuKiem(ws: Worksheet, r0: number, kq: KetQuaDoiSoat): number {
  const dat = kq.phepThu.filter((p) => p.dat).length;
  const tong = kq.phepThu.length;
  tieuDeKhoi(ws, r0, `TỰ KIỂM TRA — ${tong} phép thử máy tự chấm lúc xuất file`);
  const o = ws.getCell(r0 + 1, 1);
  o.value = dat === tong ? `ĐẠT TẤT CẢ ${dat}/${tong}` : `CÓ ${tong - dat} PHÉP CHƯA ĐẠT (${dat}/${tong}) — soát trước khi tin con số tổng`;
  o.font = { bold: true };
  o.fill = to(dat === tong ? NEN_DAT : NEN_TRUOT);
  tieuDeBang(ws, r0 + 2, ["NỘI DUNG PHÉP THỬ", "KỲ VỌNG", "KẾT QUẢ", "ĐÁNH GIÁ", "", "PHÉP THỬ NÀY BẮT LỖI GÌ", ""]);
  let r = r0 + 3;
  for (const p of kq.phepThu) {
    [p.ten, p.mong, p.thuc, p.dat ? "ĐẠT" : "KHÔNG ĐẠT", "", p.batLoiGi].forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = (v === "" ? null : v) as never;
      cell.alignment = { vertical: "top", wrapText: c === 0 || c === 5 };
    });
    ws.getCell(r, 4).fill = to(p.dat ? NEN_DAT : NEN_TRUOT);
    r++;
  }
  return r;
}

/** Một câu trả lời ở đầu sheet KẾT LUẬN CHUNG. */
interface TraLoi {
  viec: string;
  ketLuan: string;
  /** Chỗ xem tiếp: sheet khác (+ ô) hoặc một khối ngay trong sheet này. */
  xem?: { chu: string; sheet?: string; o?: string; khoi?: Khoi };
  lamGi: string;
  muc: "do" | "vang" | "xanh";
}
type Khoi = "doiChieu" | "congCot" | "nghiVan" | "tuKiem";

/** Mốc dòng trong sheet HÓA ĐƠN CHƯA KÊ — để link nhảy thẳng tới đúng mục. */
interface MocChuaKe {
  nghiSaiSo?: number;
  soThieu?: number;
}

/**
 * Sheet KẾT LUẬN CHUNG — luôn đứng đầu. Trả lời trước, số liệu sau, tự kiểm cuối.
 * `ds` cho biết sheet danh sách nào THẬT SỰ được dựng (để chỉ đường cho đúng).
 */
function sheetKetLuan(
  wb: Workbook,
  kq: KetQuaDoiSoat,
  ds: { chuaKe: MocChuaKe | null; haiBan: KetQuaSoHaiBan | null; cungNgay: readonly NhomCungNgay[] }
): Worksheet {
  const ws = wb.addWorksheet(TEN.ketLuan);
  [52, 20, 20, 22, 12, 50, 60].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const hd = kq.sheetsHoaDon.filter((s) => !s.laPhu);
  const phu = kq.sheetsHoaDon.filter((s) => s.laPhu);
  const coSo = !!kq.sheetPhanMem;
  const tenSo = kq.sheetPhanMem?.ten ?? "";
  const tenHd = hd.map((s) => `"${s.ten}"`).join(", ");
  const dong = hd.flatMap((s) => s.dong);

  // --- Câu trả lời. Thứ tự theo việc chính của file: có sổ ⇒ chưa kê; hai bản ⇒ so
  // hai bản; chỉ bảng kê ⇒ cộng cột. Còn lại xếp sau, tự kiểm luôn cuối. ---
  const traLoi: TraLoi[] = [];

  if (coSo) {
    const thieu = dong.filter((d) => d.trangThai === "THIEU");
    const phaiKe = thieu.filter((d) => !d.khongCanVaoSo && !d.ganKhopMoTa);
    const nghiSai = thieu.filter((d) => !d.khongCanVaoSo && d.ganKhopMoTa);
    const boQua = thieu.filter((d) => d.khongCanVaoSo);
    traLoi.push({
      viec: `Hóa đơn chưa kê vào sổ "${tenSo}"`,
      ketLuan: phaiKe.length
        ? `${phaiKe.length} hóa đơn · ${vnd(phaiKe.reduce((t, d) => t + d.tongTtVnd, 0))} chưa có trong sổ.${boQua.length ? ` Đã loại ${boQua.length} hóa đơn bị thay thế/hủy (không cần kê).` : ""}`
        : `Không có — mọi hóa đơn cần kê đều đã vào sổ.${boQua.length ? ` (${boQua.length} hóa đơn bị thay thế/hủy — đúng là không vào sổ.)` : ""}`,
      xem: ds.chuaKe ? { chu: `Sheet ${TEN.chuaKe}`, sheet: TEN.chuaKe } : undefined,
      lamGi: phaiKe.length ? "Kê bổ sung vào sổ theo danh sách (đã xếp theo ngày lập, có dòng cộng)." : "",
      muc: phaiKe.length ? "do" : "xanh",
    });
    if (nghiSai.length)
      traLoi.push({
        viec: "Nghi đã kê nhưng gõ sai số hóa đơn ở sổ",
        ketLuan: `${nghiSai.length} hóa đơn cùng MST + cùng số tiền với một dòng sổ không ghép được.`,
        xem: ds.chuaKe?.nghiSaiSo ? { chu: `${TEN.chuaKe} · mục tô vàng`, sheet: TEN.chuaKe, o: `A${ds.chuaKe.nghiSaiSo}` } : undefined,
        lamGi: "Xác nhận rồi SỬA SỐ Ở SỔ — đừng kê thêm lần nữa.",
        muc: "vang",
      });
    const lech = dong.filter((d) => d.trangThai === "LECH");
    const sheetLech = hd.filter((s) => s.dong.some((d) => d.trangThai === "LECH"));
    traLoi.push({
      viec: "Hóa đơn đã vào sổ nhưng LỆCH TIỀN",
      ketLuan: lech.length
        ? `${lech.length} hóa đơn · chênh ${vnd(lech.reduce((t, d) => t + (d.chenh ?? 0), 0))}.`
        : "Không có — hóa đơn nào đã vào sổ đều khớp tiền.",
      xem: sheetLech.length
        ? { chu: `Lọc cột A = "LỆCH TIỀN" ở sheet ${sheetLech.map((s) => s.ten).join(", ")}`, sheet: sheetLech[0]!.ten }
        : undefined,
      lamGi: lech.length ? 'Soát cột "Chênh lệch" và "BẰNG CHỨNG ĐỐI CHIẾU" trên chính dòng đó.' : "",
      muc: lech.length ? "do" : "xanh",
    });
    const soThieu = (kq.sheetPhanMem?.dong ?? []).filter((d) => d.trangThai === "THIEU");
    traLoi.push({
      viec: "Dòng sổ không tìm thấy hóa đơn điện tử",
      ketLuan: soThieu.length
        ? `${soThieu.length} dòng sổ · ${vnd(soThieu.reduce((t, d) => t + d.tongCong, 0))}.`
        : "Không có — mọi dòng sổ đều có hóa đơn điện tử.",
      xem: soThieu.length && ds.chuaKe?.soThieu
        ? { chu: `${TEN.chuaKe} · mục cuối`, sheet: TEN.chuaKe, o: `A${ds.chuaKe.soThieu}` }
        : undefined,
      lamGi: soThieu.length ? "Kiểm lại số/ký hiệu hóa đơn gõ ở sổ, hoặc hóa đơn chưa lên cổng thuế." : "",
      muc: soThieu.length ? "vang" : "xanh",
    });
  }

  if (ds.haiBan) {
    const t = ds.haiBan.tong;
    const viec = t.chiThue + t.chiTai + t.lechTien;
    traLoi.push({
      viec: "So hai bản hóa đơn điện tử (thuế gửi ⇄ tự tải)",
      ketLuan: `Bản tự tải THIẾU ${t.chiThue} hóa đơn (${vnd(t.tienChiThue)}) · thuế không gửi ${t.chiTai} (${vnd(t.tienChiTai)}) · lệch tiền ${t.lechTien} · khớp ${t.caHai - t.lechTien - t.khongSoDuocTien}.`,
      xem: { chu: `Sheet ${TEN.haiBan}`, sheet: TEN.haiBan },
      lamGi: viec ? "Xử theo cột PHẢI LÀM GÌ, dòng tô đỏ (bản tự tải thiếu) trước." : "",
      muc: viec ? "do" : "xanh",
    });
  }

  if (hd.length) {
    const lechThat = hd.flatMap((s) => s.canDoiCot.dongLechThat.map((d) => ({ sheet: s.ten, ...d })));
    const tien = hd.reduce((t, s) => t + s.canDoiCot.boc.lechThat, 0);
    const binhThuong = hd.reduce((t, s) => t + s.canDoiCot.lech - s.canDoiCot.boc.lechThat, 0);
    const cho = lechThat.length <= 5 ? ` Ở: ${lechThat.map((d) => `${d.sheet} dòng ${d.dongFile}`).join(", ")}.` : "";
    // Nối về ĐÚNG con số kế toán đang nhìn ở dòng tổng tự đặt cuối sheet: có người
    // cộng trần (chưa thuế + thuế), có người đã cộng phí nhưng chưa trừ chiết khấu.
    const soTien = (n: number) => Math.round(n).toLocaleString("vi-VN");
    const theoSheet = hd.map((s) => {
      const c = s.canDoiCot;
      if (Math.abs(c.lech) <= 1) return `• Sheet ${s.ten}: cộng cột khớp.`;
      const phan = [
        c.boc.lechThat ? `lệch thật ${soTien(c.boc.lechThat)}` : "",
        c.boc.chietKhau ? `chiết khấu ${soTien(c.boc.chietKhau)}` : "",
        c.boc.lamTron ? `làm tròn ${soTien(c.boc.lamTron)}` : "",
      ].filter(Boolean);
      const trun = `Σ tổng − (Σ chưa thuế + Σ thuế) = ${soTien(c.lech)}${c.boc.phi ? ` = phí ${soTien(c.boc.phi)}${phan.length ? ` + ${phan.join(" + ")}` : ""}` : ""}`;
      const daCongPhi = c.boc.phi
        ? `. Nếu dòng tổng tự đặt đã CỘNG PHÍ thì ra ${soTien(c.lech - c.boc.phi)}${phan.length ? ` = ${phan.join(" + ")}` : ""}`
        : phan.length ? ` = ${phan.join(" + ")}` : "";
      return `• Sheet ${s.ten}: ${trun}${daCongPhi}.`;
    });
    traLoi.push({
      viec: "Cộng cột: chưa thuế + thuế = tổng thanh toán",
      ketLuan: [
        lechThat.length
          ? `LỆCH THẬT ở ${lechThat.length} hóa đơn · ${vnd(tien)}.${cho} Phần lệch còn lại ${vnd(binhThuong)} do phí/chiết khấu/làm tròn — bình thường.`
          : `Không có lệch thật.${Math.abs(binhThuong) > 1 ? ` Lệch ${vnd(binhThuong)} chỉ do phí/chiết khấu/làm tròn — bình thường.` : ""}`,
        ...theoSheet,
      ].join("\n"),
      xem: { chu: "Bảng CỘNG CỘT bên dưới", khoi: "congCot" },
      lamGi: lechThat.length
        ? coSo
          ? `Trên từng sheet, lọc cột "Nguyên nhân lệch" (cột cuối) = "${NHAN_LECH_CONG.that}". Hai cột trước nó là công thức trỏ ô gốc.`
          : `Trên từng sheet, lọc cột A (KIỂM CỘNG) = "${NHAN_LECH_CONG.that}" (dòng tô đỏ).`
        : "",
      muc: lechThat.length ? "do" : "xanh",
    });
  }

  if (ds.cungNgay.length) {
    const nghi = ds.cungNgay.filter((g) => g.trungSoTien).length;
    traLoi.push({
      viec: "Hóa đơn cùng MST cùng ngày",
      ketLuan: `${ds.cungNgay.length} nhóm · ${ds.cungNgay.reduce((s, g) => s + g.soHoaDon, 0)} hóa đơn. ${nghi ? `${nghi} nhóm có hóa đơn TRÙNG KHÍT số tiền — chỗ dễ kê hai lần.` : "Không nhóm nào trùng khít số tiền."}`,
      xem: { chu: `Sheet ${TEN.cungNgay}`, sheet: TEN.cungNgay },
      lamGi: nghi ? "Soát các nhóm tô vàng (xếp đầu sheet). Nhiều hóa đơn một ngày chưa chắc là sai." : "Chỉ để soát bằng mắt khi cần — không phải lỗi.",
      muc: nghi ? "vang" : "xanh",
    });
  }

  const soNghi = kq.nghiVan.length + kq.nghiVanGop.length;
  traLoi.push({
    viec: "Ô số liệu nghi sai trong file",
    ketLuan: soNghi ? `${soNghi} chỗ cần soát (không ô nào bị tự động sửa).` : "Không có chỗ nào nghi vấn.",
    xem: soNghi ? { chu: "Khối CHỖ CẦN SOÁT LẠI bên dưới", khoi: "nghiVan" } : undefined,
    lamGi: soNghi ? 'Mỗi dòng trỏ đúng ô trong file này; máy suy được số đúng thì bấm "Sửa" trên màn hình.' : "",
    muc: soNghi ? "vang" : "xanh",
  });

  // Cảnh báo lúc đọc file (sheet trộn bố cục, chưa chọn được sổ chuẩn…). "Thiếu sổ"
  // bỏ qua vì câu đầu sheet đã nói rõ chế độ kiểm.
  // "Không cần vào sổ" đã nói ở dòng chưa kê; không có sổ thì "thiếu sổ" đã nói ở
  // đầu trang. Có hai bản thì cùng một hóa đơn hiện ở cả hai bên là chuyện đương
  // nhiên — chỉ giữ trùng khóa CÙNG một bên.
  const daNoi = new Set(coSo ? ["Hóa đơn không cần vào sổ"] : ["Thiếu dữ liệu", "Hóa đơn không cần vào sổ"]);
  const trungKhacBen = (c: { loai: string; chiTiet: string }) => {
    if (!ds.haiBan || c.loai !== "Trùng khóa HĐĐT") return false;
    const m = /\(([^()]+)\)\.?$/.exec(c.chiTiet);
    if (!m) return false;
    // "(A#12, B#80, …)": trùng chỉ vì mỗi bên có một bản ⇒ mỗi bên đúng một lần.
    const ben = m[1]!.split(", ").map((x) => laBenThue(x.replace(/#\d+$/, "")));
    return ben.filter(Boolean).length === 1 && ben.length === 2;
  };
  const theoLoai = new Map<string, string[]>();
  for (const c of kq.canhBao)
    if (!daNoi.has(c.loai) && !trungKhacBen(c))
      theoLoai.set(c.loai, [...(theoLoai.get(c.loai) ?? []), c.chiTiet]);
  for (const [loai, ct] of theoLoai)
    traLoi.push({
      viec: `⚠ ${loai}`,
      ketLuan: ct.length > 1 ? `${ct[0]} (và ${ct.length - 1} cảnh báo cùng loại — xem trên màn hình)` : ct[0]!,
      lamGi: "",
      muc: "vang",
    });

  const dat = kq.phepThu.filter((p) => p.dat).length;
  traLoi.push({
    viec: "Máy tự kiểm lại kết quả",
    ketLuan: dat === kq.phepThu.length ? `ĐẠT ${dat}/${kq.phepThu.length} phép thử.` : `CÓ ${kq.phepThu.length - dat} PHÉP CHƯA ĐẠT (${dat}/${kq.phepThu.length}) — soát trước khi tin con số tổng.`,
    xem: { chu: "Khối TỰ KIỂM TRA cuối sheet", khoi: "tuKiem" },
    lamGi: "",
    muc: dat === kq.phepThu.length ? "xanh" : "do",
  });

  // --- Đầu trang ---
  const cheDo = coSo
    ? `Đối chiếu ${hd.length} sheet hóa đơn điện tử (${tenHd}) với sổ kế toán "${tenSo}".`
    : ds.haiBan
      ? `File có HAI BẢN hóa đơn điện tử (thuế gửi: ${ds.haiBan.sheetThue.join(" + ")} · tự tải: ${ds.haiBan.sheetTai.join(" + ")}) và KHÔNG có sổ kế toán ⇒ đã so hai bản với nhau và kiểm cộng từng dòng; không đối chiếu với sổ.`
      : `File chỉ có bảng kê hóa đơn điện tử (${tenHd}), KHÔNG có sổ kế toán ⇒ đã kiểm cộng từng dòng (chưa thuế + thuế = tổng thanh toán) ngay trên sheet; không đối chiếu với sổ.`;
  tieuDeTrang(ws, "KẾT LUẬN CHUNG — đọc bảng TRẢ LỜI trước, bấm cột XEM Ở ĐÂU để nhảy tới chỗ chi tiết", [
    cheDo + (phu.length ? ` Sheet ${phu.map((s) => `"${s.ten}"`).join(", ")} trùng lặp (tập con) nên không cộng vào tổng.` : ""),
    `SỐ LIỆU GỐC GIỮ NGUYÊN 100%: không ô nào của file bị sửa — kết quả nằm ở cột A và các cột thêm ở cuối từng sheet. Ngưỡng coi là khớp: ${kq.nguong.toLocaleString("vi-VN")} đ.`,
  ]);

  // --- Bảng TRẢ LỜI (hàng 5) ---
  const dauTL = 5;
  tieuDeBang(ws, dauTL, ["VIỆC ĐÃ KIỂM", "KẾT LUẬN", "", "", "", "XEM Ở ĐÂU", "PHẢI LÀM GÌ"]);
  ws.mergeCells(dauTL, 2, dauTL, 5);

  // --- Các khối phía dưới — ghi trước để biết hàng, rồi mới điền link ở bảng trả lời ---
  const moc: Partial<Record<Khoi, number>> = {};
  let r = dauTL + traLoi.length + 2;
  if (coSo) {
    moc.doiChieu = r;
    r = khoiDoiChieu(ws, r, kq) + 1;
  }
  if (hd.length) {
    moc.congCot = r;
    r = khoiCongCot(ws, r, hd, !coSo) + 1;
  }
  if (soNghi) {
    moc.nghiVan = r;
    r = khoiNghiVan(ws, r, kq) + 1;
  }
  moc.tuKiem = r;
  khoiTuKiem(ws, r, kq);

  const NEN_MUC = { do: NEN_TRUOT, vang: NEN_NGHI, xanh: NEN_DAT } as const;
  traLoi.forEach((t, i) => {
    const hang = dauTL + 1 + i;
    ws.getCell(hang, 1).value = t.viec;
    ws.getCell(hang, 1).font = { bold: true };
    ws.getCell(hang, 2).value = t.ketLuan;
    ws.mergeCells(hang, 2, hang, 5);
    if (t.xem) {
      const dich = t.xem.khoi ? (moc[t.xem.khoi] != null ? lienKet(TEN.ketLuan, `A${moc[t.xem.khoi]}`) : null) : lienKet(t.xem.sheet!, t.xem.o);
      const o = ws.getCell(hang, 6);
      o.value = dich ? oLink(dich, t.xem.chu) : t.xem.chu;
      if (dich) o.font = { color: { argb: "FF0563C1" }, underline: true };
    }
    ws.getCell(hang, 7).value = t.lamGi || null;
    for (let c = 1; c <= 7; c++) {
      const o = ws.getCell(hang, c);
      o.fill = to(NEN_MUC[t.muc]);
      o.alignment = { vertical: "top", wrapText: true };
      o.border = { bottom: { style: "hair" } };
    }
    // Ô gộp B:E — ước chiều cao theo độ dài chữ, Excel không tự giãn hàng có ô gộp.
    const dongKl = t.ketLuan.split("\n").reduce((n, x) => n + Math.max(1, Math.ceil(x.length / 70)), 0);
    const dai = Math.max(dongKl, Math.ceil(t.lamGi.length / 55), Math.ceil(t.viec.length / 48), t.xem ? Math.ceil(t.xem.chu.length / 45) : 0);
    ws.getRow(hang).height = Math.max(15, dai * 15);
  });

  ws.views = [{ state: "frozen", ySplit: dauTL }];
  return ws;
}

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
function sheetChuaKe(wb: Workbook, kq: KetQuaDoiSoat): { ws: Worksheet; moc: MocChuaKe } | null {
  const hd = kq.sheetsHoaDon.filter((sh) => !sh.laPhu);
  const tatCa = hd.flatMap((sh) => sh.dong.filter((d) => d.trangThai === "THIEU"));
  const soThieu = (kq.sheetPhanMem?.dong ?? []).filter((d) => d.trangThai === "THIEU");
  // Cả hai chiều đều sạch ⇒ không có gì để lọc, đừng đẻ sheet rỗng.
  if (!tatCa.length && !soThieu.length) return null;
  const moc: MocChuaKe = {};
  const ws = wb.addWorksheet(TEN.chuaKe);
  [6, 12, 14, 12, 18, 42, 18, 16, 18, 20, 20, 56].forEach((w, i) => (ws.getColumn(i + 1).width = w));
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
    moc.nghiSaiSo = r;
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
  moc.soThieu = r;
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
  return { ws, moc };
}

/** Sheet SO HAI BẢN — chỉ dựng khi file có cả bản thuế gửi lẫn bản tự tải. */
function sheetSoHaiBan(wb: Workbook, so: KetQuaSoHaiBan): Worksheet {
  const ws = wb.addWorksheet(TEN.haiBan);
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
  const ws = wb.addWorksheet(TEN.cungNgay);
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

/**
 * Dựng các sheet tổng hợp và đẩy chúng lên ĐẦU workbook.
 *
 * `KẾT LUẬN CHUNG` luôn có; ba sheet danh sách CHỈ dựng khi kỳ đó có dữ liệu. Thứ
 * tự: KẾT LUẬN → chưa kê (có sổ) / so hai bản → các sheet gốc → cùng MST cùng ngày
 * (tham khảo) → nhật ký sửa.
 */
export function themSheetTongHop(wb: Workbook, kq: KetQuaDoiSoat): void {
  // Chạy lại trên file đã xuất: bỏ mọi sheet tự dựng (kể cả tên cũ trước v6.4)
  // rồi dựng lại, kẻo trùng tên hoặc sót sheet cũ nằm lại.
  for (const w of [...wb.worksheets]) if (SHEET_TU_DUNG.has(w.name) && w.name !== "NHẬT KÝ SỬA") wb.removeWorksheet(w.id);
  // Sheet gốc lùi về sau; sheet tổng hợp chiếm các chỗ đầu.
  wb.worksheets.forEach((w, i) => ((w as unknown as ThuTu).orderNo = 10 + i));

  const soHaiBan = soHaiBanHddt(kq.sheetsHoaDon, kq.nguong);
  const cungNgay = gomCungMstCungNgay(kq.sheetsHoaDon.filter((s) => !s.laPhu));
  const chuaKe = kq.sheetPhanMem ? sheetChuaKe(wb, kq) : null;
  const haiBan = soHaiBan ? sheetSoHaiBan(wb, soHaiBan) : null;
  const ngay = cungNgay.length ? sheetCungNgay(wb, cungNgay) : null;
  const ketLuan = sheetKetLuan(wb, kq, { chuaKe: chuaKe?.moc ?? null, haiBan: soHaiBan, cungNgay });

  [ketLuan, chuaKe?.ws, haiBan].forEach((w, i) => w && ((w as unknown as ThuTu).orderNo = i));
  // CÙNG MST CÙNG NGÀY là danh sách THAM KHẢO (nhiều hóa đơn một ngày chưa chắc
  // sai), không phải kết quả đối soát ⇒ xếp sau các sheet gốc, trước nhật ký sửa.
  if (ngay) (ngay as unknown as ThuTu).orderNo = 1000;
  const nk = wb.worksheets.find((w) => w.name === "NHẬT KÝ SỬA");
  if (nk) (nk as unknown as ThuTu).orderNo = 2000;
}
