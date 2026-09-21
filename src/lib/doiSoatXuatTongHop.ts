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
import { SHEET_TU_DUNG } from "./doiSoatHddt";
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

// ---------------------------------------------------------------------------
// Sheet KẾT LUẬN CHUNG dùng chung 8 cột: A chữ · B–G số · H chữ giải thích.
// Câu dài thì GỘP ô cho đủ chỗ, và tự đặt chiều cao hàng (Excel không tự giãn
// hàng có ô gộp — không đặt là chữ bị cắt, người đọc tưởng thiếu).
// ---------------------------------------------------------------------------
const RONG = [36, 17, 17, 17, 17, 17, 17, 58] as const;
const HET = RONG.length;

/** 0-based → chữ cái cột Excel. */
const chuCot = (c0: number): string => {
  let n = c0 + 1, s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
};

type GiaTriO = string | number | null | { formula: string; result: string };
type Font = { bold?: boolean; italic?: boolean; size?: number; color?: { argb: string }; underline?: boolean };

/** Ghi một ô (gộp c1→c2 nếu cần); trả số dòng chữ ước tính để đặt chiều cao hàng. */
function oChu(ws: Worksheet, r: number, c1: number, c2: number, v: GiaTriO, font?: Font, nen?: string): number {
  if (c2 > c1) ws.mergeCells(r, c1, r, c2);
  const o = ws.getCell(r, c1);
  o.value = v as never;
  o.alignment = { vertical: "top", wrapText: true };
  if (font) o.font = font;
  if (typeof v === "number") o.numFmt = "#,##0";
  if (nen) for (let c = c1; c <= c2; c++) ws.getCell(r, c).fill = to(nen);
  const rong = RONG.slice(c1 - 1, c2).reduce((a, b) => a + b, 0);
  const chu = typeof v === "string" ? v : v && typeof v === "object" ? v.result : String(v ?? "");
  return chu.split("\n").reduce((n, x) => n + Math.max(1, Math.ceil((x.length * 1.1) / rong)), 0);
}
const datCao = (ws: Worksheet, r: number, soDong: number) => (ws.getRow(r).height = Math.max(15, soDong * 15));

/** Một câu gộp hết chiều ngang. */
function cau(ws: Worksheet, r: number, v: GiaTriO, font?: Font, nen?: string): number {
  datCao(ws, r, oChu(ws, r, 1, HET, v, font, nen));
  return r + 1;
}

/** Tiêu đề bảng: mỗi phần tử là [chữ, số cột chiếm]. */
function tieuDe8(ws: Worksheet, r: number, cot: readonly (readonly [string, number])[]): void {
  let c = 1;
  let cao = 1;
  for (const [ten, rong] of cot) {
    cao = Math.max(cao, oChu(ws, r, c, c + rong - 1, ten, { bold: true }, NEN_TIEU_DE));
    for (let k = c; k < c + rong; k++)
      ws.getCell(r, k).border = {
        left: { style: "thin" }, right: { style: "thin" }, top: { style: "thin" }, bottom: { style: "thin" },
      };
    c += rong;
  }
  datCao(ws, r, cao);
}

/** Một hàng dữ liệu theo đúng bố cục cột của `tieuDe8`. */
function hang8(ws: Worksheet, r: number, cot: readonly (readonly [GiaTriO, number])[], nen?: string, dam = false): void {
  let c = 1;
  let cao = 1;
  for (const [v, rong] of cot) {
    const la = typeof v === "object" && v !== null;
    cao = Math.max(cao, oChu(ws, r, c, c + rong - 1, v, la ? { color: { argb: "FF0563C1" }, underline: true, bold: dam } : dam ? { bold: true } : undefined, nen));
    c += rong;
  }
  datCao(ws, r, cao);
}

function tieuDeKhoi(ws: Worksheet, r: number, ten: string): number {
  return cau(ws, r, ten, { bold: true, size: 13, color: { argb: "FF17529C" } });
}

/** Một dòng chỉ tiêu ở khối SỐ LIỆU ĐỐI CHIẾU. */
type DongChiTieu = [string, Cong | null, string, string, boolean?];

function bangChiTieu(ws: Worksheet, tuDong: number, dong: readonly DongChiTieu[]): number {
  let r = tuDong;
  for (const [ten, so, nguon, cach, dam] of dong) {
    if (ten === "") {
      r++;
      continue;
    }
    hang8(ws, r, [
      [ten, 1],
      [so ? so.chua : null, 1], [so ? so.thue : null, 1], [so ? so.tong : null, 1],
      [so && so.n !== 0 ? so.n : null, 1],
      [nguon, 2], [cach, 1],
    ], undefined, dam);
    r++;
  }
  return r;
}

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

  let r = tieuDeKhoi(ws, r0, `SỐ LIỆU ĐỐI CHIẾU VỚI SỔ "${tenSo}"`);
  tieuDe8(ws, r, [["CHỈ TIÊU", 1], ["TRƯỚC THUẾ", 1], ["THUẾ", 1], ["TỔNG THANH TOÁN", 1], ["SỐ DÒNG", 1], ["NGUỒN SỐ LIỆU", 2], ["CÁCH TỰ KIỂM TRA LẠI", 1]]);

  r = bangChiTieu(ws, r + 1, [
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
    r = cau(ws, r + 1, "BÓC TÁCH PHẦN CHÊNH — đến từ những hóa đơn nào", { bold: true });
    tieuDe8(ws, r, [["HÓA ĐƠN / LÝ DO", 3], ["SỐ TIỀN", 1], ["", 4]]);
    r++;
    for (const b of kq.cauNoi.bocTach) hang8(ws, r++, [[b.mo, 3], [b.tien, 1], ["", 4]]);
  }
  return r;
}

// ---------------------------------------------------------------------------
// DÒ LỆCH CỘNG CỘT — trả lời "chưa thuế + thuế phải bằng tổng thanh toán, lệch
// mấy triệu, sót dòng nào". Nói bằng ĐÚNG con số kế toán đang nhìn (ô lệch họ tự
// đặt cuối sheet, nếu máy nhận ra), bóc ra từng phần cộng lại đúng bằng số đó,
// rồi liệt kê từng dòng kèm địa chỉ ô — bấm là nhảy tới.
// ---------------------------------------------------------------------------

/** Cột AOA → cột 0-based trong FILE RA (tính cả cột A chèn/gỡ). */
export type CotRa = (sh: SheetHoaDon, c: number) => number;

interface PhanLech {
  ten: string;
  tien: number;
  loai: "that" | "phi" | "chietKhau" | "lamTron" | "khac";
  phaiSua: string;
}

/** Con số kế toán đang nhìn + các phần cộng lại đúng bằng nó. */
function phanTichLech(sh: SheetHoaDon): { V: number; phan: PhanLech[] } {
  const cd = sh.canDoiCot;
  const o = cd.oTuDat;
  const congPhi = o?.congPhi ?? false;
  const truCk = o?.truCk ?? false;
  const V = cd.lech - (congPhi ? cd.sumPhi : 0) + (truCk ? cd.sumCk : 0);
  const phan: PhanLech[] = [
    { ten: "Hóa đơn ghi SAI tiền (chưa thuế + thuế khác tổng thanh toán)", tien: cd.boc.lechThat, loai: "that", phaiSua: "CÓ — xem bảng DÒNG PHẢI SỬA ngay dưới." },
    { ten: congPhi ? "Phí không khớp cột phí" : "Phí — công thức chưa cộng cột phí", tien: cd.boc.phi - (congPhi ? cd.sumPhi : 0), loai: "phi", phaiSua: "Không — phí là một phần hợp lệ của tổng thanh toán." },
    { ten: truCk ? "Chiết khấu không khớp cột chiết khấu" : "Chiết khấu — công thức chưa trừ cột chiết khấu", tien: cd.boc.chietKhau + (truCk ? cd.sumCk : 0), loai: "chietKhau", phaiSua: "Không — chiết khấu hợp lệ. Muốn ô tổng về đúng thì công thức trừ thêm cột chiết khấu." },
    { ten: "Làm tròn 1 đồng của bên bán", tien: cd.boc.lamTron, loai: "lamTron", phaiSua: "Không — sai số làm tròn trên hóa đơn." },
  ].filter((p) => Math.abs(p.tien) > 0.5) as PhanLech[];
  const con = V - phan.reduce((t, p) => t + p.tien, 0);
  if (Math.abs(con) > 0.5)
    phan.push({ ten: "Phí / chiết khấu ghi ở cột nhưng không nằm trong tổng thanh toán", tien: con, loai: "khac", phaiSua: "Soát các dòng có phí/chiết khấu ở bảng dưới." });
  return { V, phan };
}

const soTien = (n: number) => Math.round(n).toLocaleString("vi-VN");

/** Câu trả lời một dòng cho một sheet — đặt ở bảng TRẢ LỜI đầu trang. */
function cauTraLoiCongCot(sh: SheetHoaDon, cotRa: CotRa): { cau: string; sai: boolean } {
  const cd = sh.canDoiCot;
  const { V, phan } = phanTichLech(sh);
  const sai = cd.dongLech.filter((d) => d.loai === "that");
  if (!sai.length && Math.abs(V) <= 0.5)
    return { cau: `Khớp — chưa thuế + thuế bằng tổng thanh toán${cd.dongLech.length ? " (lệch từng dòng chỉ do phí/chiết khấu/làm tròn, bình thường)" : ""}.`, sai: false };
  const o = cd.oTuDat;
  const dau = o ? `Ô ${chuCot(cotRa(sh, o.cot))}${o.dongFile} = ${soTien(o.giaTri)} đ` : `Cộng cả cột lệch ${soTien(V)} đ`;
  const noiSai = sai.length
    ? `do ${sai.length} hóa đơn ghi sai tiền ở ${sai.length <= 3 ? sai.map((d) => `dòng ${d.dongFile}`).join(", ") : `${sai.length} dòng (danh sách bên dưới)`} (${soTien(cd.boc.lechThat)} đ)`
    : "KHÔNG có hóa đơn nào ghi sai";
  const them = phan
    .filter((p) => p.loai !== "that")
    .map((p) => `${p.tien < 0 ? "trừ" : "cộng"} ${p.loai === "phi" ? "phí" : p.loai === "chietKhau" ? "chiết khấu" : p.loai === "lamTron" ? "làm tròn" : "phần phí/chiết khấu khác"} ${soTien(Math.abs(p.tien))} đ`);
  return { cau: `${dau}: ${noiSai}${them.length ? `, ${them.join(", ")}` : ""}.`, sai: sai.length > 0 };
}

/** Khối dò lệch của MỘT sheet. */
function khoiDoLech(ws: Worksheet, r0: number, sh: SheetHoaDon, cotRa: CotRa): number {
  const cd = sh.canDoiCot;
  const cot = (c: number) => (c >= 0 ? chuCot(cotRa(sh, c)) : "");
  const oCua = (c: number, dong: number) => (c >= 0 ? `${cot(c)}${dong}` : "");
  const { V, phan } = phanTichLech(sh);
  const o = cd.oTuDat;
  const diaChi = o ? `${cot(o.cot)}${o.dongFile}` : "";

  let r = tieuDeKhoi(ws, r0, `SHEET ${sh.ten} — ${o ? `ô ${diaChi} = ${soTien(o.giaTri)} đ` : `cộng cả cột lệch ${soTien(V)} đ`}`);
  const tp = (c: number, ten: string) => (c >= 0 ? `${ten} (cột ${cot(c)})` : "");
  const cachTinh = o
    ? `Ô ${diaChi} là ô tự tính ở cuối sheet: tổng cột tổng thanh toán (${cot(cd.cotTong)}) trừ đi tổng ${[tp(cd.cotChua, "chưa thuế"), tp(cd.cotThue, "thuế"), o.congPhi ? tp(cd.cotPhi, "phí") : ""].filter(Boolean).join(" + ")}${o.truCk ? `, rồi cộng lại chiết khấu (cột ${cot(cd.cotCk)})` : ""}.${o.dau < 0 ? " Ô tính ngược chiều nên mang dấu âm; bảng dưới dùng số dương." : ""}`
    : `Tổng cột tổng thanh toán (${cot(cd.cotTong)}) trừ đi tổng ${[tp(cd.cotChua, "chưa thuế"), tp(cd.cotThue, "thuế")].filter(Boolean).join(" + ")}.`;
  r = cau(ws, r, cachTinh, { italic: true });
  r = cau(ws, r, `Số ${soTien(V)} đ này gồm ${phan.length} phần dưới đây, cộng lại đúng bằng nó:`, { bold: true });

  // --- các phần cộng lại ra đúng con số ---
  const sai = cd.dongLech.filter((d) => d.loai === "that");
  const khac = cd.dongLech.filter((d) => d.loai !== "that");
  const noiDong = (loai: PhanLech["loai"]): GiaTriO => {
    const ds = cd.dongLech.filter((d) => d.loai === loai);
    if (!ds.length) return "";
    if (ds.length === 1) return oLink(lienKet(sh.ten, oCua(cd.cotChua, ds[0]!.dongFile)), `dòng ${ds[0]!.dongFile} (bấm để tới)`);
    return `${ds.length} dòng: ${ds.slice(0, 8).map((d) => d.dongFile).join(", ")}${ds.length > 8 ? "…" : ""} — xem bảng dưới`;
  };
  tieuDe8(ws, r++, [["PHẦN LỆCH", 1], ["SỐ TIỀN (đ)", 1], ["SỐ DÒNG", 1], ["Ở DÒNG NÀO", 4], ["CÓ PHẢI SỬA KHÔNG", 1]]);
  for (const p of phan) {
    const n = p.loai === "khac" ? "" : cd.dongLech.filter((d) => d.loai === p.loai).length;
    hang8(ws, r++, [[p.ten, 1], [p.tien, 1], [n, 1], [p.loai === "khac" ? "" : noiDong(p.loai), 4], [p.phaiSua, 1]], p.loai === "that" ? NEN_TRUOT : undefined, p.loai === "that");
  }
  const tong = phan.reduce((t, p) => t + p.tien, 0);
  hang8(ws, r++, [["CỘNG", 1], [tong, 1], ["", 1], [o ? `= đúng ô ${diaChi} ✓` : "= đúng số lệch khi cộng cả cột ✓", 4], ["", 1]], NEN_DAT, true);
  if (o?.congPhi && cd.sumPhi)
    r = cau(ws, r, `Phí ${soTien(cd.sumPhi)} đ (${cd.soDong.phi} dòng) đã được công thức của ô ${diaChi} cộng vào nên không gây lệch. Các dòng đó vẫn liệt kê ở bảng cuối để cộng lại cho đủ.`, { italic: true });
  r++;

  // --- từng dòng, có địa chỉ ô ---
  const tieuDeDong = () =>
    tieuDe8(ws, r++, [
      ["DÒNG (bấm để tới)", 1], ["KÝ HIỆU – SỐ HĐ", 1], ["NGÀY LẬP", 1],
      [cd.cotChua >= 0 ? `CHƯA THUẾ (cột ${cot(cd.cotChua)})` : "CHƯA THUẾ", 1],
      [cd.cotThue >= 0 ? `THUẾ (cột ${cot(cd.cotThue)})` : "THUẾ", 1],
      [cd.cotTong >= 0 ? `TỔNG TT (cột ${cot(cd.cotTong)})` : "TỔNG TT", 1],
      ["LỆCH = TỔNG TT − (CHƯA THUẾ + THUẾ)", 1],
      ["NGƯỜI BÁN · GIẢI THÍCH", 1],
    ]);
  const ghiDong = (d: (typeof cd.dongLech)[number], giaiThich: string, nen?: string) =>
    hang8(ws, r++, [
      [oLink(lienKet(sh.ten, oCua(cd.cotChua, d.dongFile)), `${sh.ten} dòng ${d.dongFile}`), 1],
      [d.ma, 1], [d.ngay, 1], [d.chua, 1], [d.thue, 1], [d.tong, 1], [d.lech, 1],
      [`${d.ban}\n${giaiThich}`, 1],
    ], nen);
  const TOI_DA = 300;

  if (sai.length) {
    r = cau(ws, r, `DÒNG PHẢI SỬA — ${sai.length} hóa đơn ghi tiền không khớp nhau`, { bold: true, color: { argb: "FF9C0006" } });
    tieuDeDong();
    for (const d of sai.slice(0, TOI_DA)) {
      const chuaDung = d.tong - d.thue - d.phi + d.ck;
      const tongDung = d.chua + d.thue + d.phi - d.ck;
      ghiDong(
        d,
        `Chưa thuế + thuế${d.phi ? " + phí" : ""}${d.ck ? " − chiết khấu" : ""} = ${soTien(tongDung)} nhưng tổng thanh toán ghi ${soTien(d.tong)}. ` +
          `Nếu tổng thanh toán đúng thì ô chưa thuế ${oCua(cd.cotChua, d.dongFile)} phải là ${soTien(chuaDung)}; ` +
          `nếu chưa thuế đúng thì ô tổng ${oCua(cd.cotTong, d.dongFile)} phải là ${soTien(tongDung)}. Mở hóa đơn gốc để biết ô nào gõ sai.`,
        NEN_TRUOT
      );
    }
    if (sai.length > TOI_DA) r = cau(ws, r, `… còn ${sai.length - TOI_DA} dòng — lọc cột "Nguyên nhân lệch" trên sheet ${sh.ten}.`, { italic: true });
    r++;
  }
  if (khac.length) {
    r = cau(ws, r, `DÒNG LỆCH BÌNH THƯỜNG — ${khac.length} dòng, không phải sửa (liệt kê để cộng lại cho đủ)`, { bold: true });
    tieuDeDong();
    const lyDo = (d: (typeof khac)[number]) =>
      d.loai === "phi" ? `Có phí ${soTien(d.phi)} đ${cd.cotPhi >= 0 ? ` (ô ${oCua(cd.cotPhi, d.dongFile)})` : ""} — tổng thanh toán đã gồm phí.`
      : d.loai === "chietKhau" ? `Chiết khấu ${soTien(d.ck)} đ${cd.cotCk >= 0 ? ` (ô ${oCua(cd.cotCk, d.dongFile)})` : ""} — tổng thanh toán đã trừ chiết khấu.`
      : "Làm tròn 1 đồng của bên bán.";
    for (const d of khac.slice(0, TOI_DA)) ghiDong(d, lyDo(d), NEN_NGHI);
    if (khac.length > TOI_DA) r = cau(ws, r, `… còn ${khac.length - TOI_DA} dòng — lọc cột "Nguyên nhân lệch" trên sheet ${sh.ten}.`, { italic: true });
  }
  return r + 1;
}

/** Khối CHỖ CẦN SOÁT LẠI (trước v6.4 là sheet `NGHI VẤN SỐ LIỆU`) — chỉ khi có. */
function khoiNghiVan(ws: Worksheet, r0: number, kq: KetQuaDoiSoat): number {
  const coSo = !!kq.sheetPhanMem;
  let r = tieuDeKhoi(ws, r0, `CHỖ CẦN SOÁT LẠI — ${kq.nghiVan.length + kq.nghiVanGop.length} ô nghi sai số liệu (máy KHÔNG tự sửa ô nào)`);
  tieuDe8(ws, r++, [["VỊ TRÍ (trong chính file này)", 1], ["SỐ ĐANG CÓ", 1], ["SỐ ĐỐI CHỨNG", 1], ["NHÓM", 2], ["SAI Ở CHỖ NÀO", 2], ["ẢNH HƯỞNG · AI LÀM GÌ", 1]]);
  kq.nghiVan.forEach((nv, i) =>
    hang8(ws, r++, [
      // file không sổ KHÔNG chèn cột A (v6.5) ⇒ địa chỉ theo file gốc
      [`${i + 1}. ${coSo ? (nv.viTriXuat ?? nv.viTri) : nv.viTri}`, 1], [nv.soDangCo, 1], [nv.soDoiChung, 1],
      [`Nhóm ${nv.nhom} · ${TEN_NHOM[nv.nhom] ?? ""}`, 2],
      [`${nv.saiOCho}\nSố đối chứng lấy từ: ${nv.nguonDoiChung}`, 2],
      [`${nv.anhHuong}\n→ ${nv.giaTriDung != null
        ? "Máy suy được số đúng — bấm Sửa trên màn hình nếu xác nhận, giá trị cũ vẫn giữ ở sheet NHẬT KÝ SỬA."
        : "Không suy được số đúng — hỏi lại người bán hoặc xin lại bản xuất gốc từ cổng thuế."}`, 1],
    ])
  );
  kq.nghiVanGop.forEach((g, i) =>
    hang8(ws, r++, [
      [`${kq.nghiVan.length + i + 1}. ${g.ten}`, 1], [`${g.soDong} dòng`, 1], [vnd(g.tongTien), 1],
      [`Nhóm ${g.nhom} · ${TEN_NHOM[g.nhom] ?? ""}`, 2],
      [`${g.canhBao}\n(gộp thống kê — chi tiết từng dòng xem trên màn hình)`, 2],
      ["Soát theo cảnh báo rồi xác nhận bản chốt.", 1],
    ])
  );
  return r;
}

/** Khối TỰ KIỂM TRA — bằng chứng máy tự chấm, đứng CUỐI. */
function khoiTuKiem(ws: Worksheet, r0: number, kq: KetQuaDoiSoat): number {
  const dat = kq.phepThu.filter((p) => p.dat).length;
  const tong = kq.phepThu.length;
  let r = tieuDeKhoi(ws, r0, `MÁY TỰ KIỂM TRA — ${tong} phép thử chấm lúc xuất file`);
  r = cau(ws, r, dat === tong ? `ĐẠT TẤT CẢ ${dat}/${tong}` : `CÓ ${tong - dat} PHÉP CHƯA ĐẠT (${dat}/${tong}) — soát trước khi tin con số tổng`, { bold: true }, dat === tong ? NEN_DAT : NEN_TRUOT);
  tieuDe8(ws, r++, [["NỘI DUNG PHÉP THỬ", 1], ["KỲ VỌNG", 1], ["KẾT QUẢ", 1], ["ĐÁNH GIÁ", 1], ["PHÉP THỬ NÀY BẮT LỖI GÌ", 4]]);
  for (const p of kq.phepThu) {
    hang8(ws, r, [[p.ten, 1], [p.mong, 1], [p.thuc, 1], [p.dat ? "ĐẠT" : "KHÔNG ĐẠT", 1], [p.batLoiGi, 4]]);
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
  xem?: { chu: string; sheet?: string; o?: string; khoi?: string };
  lamGi: string;
  muc: "do" | "vang" | "xanh";
}

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
  ds: { chuaKe: MocChuaKe | null; haiBan: KetQuaSoHaiBan | null; cungNgay: readonly NhomCungNgay[] },
  cotRa: CotRa
): Worksheet {
  const ws = wb.addWorksheet(TEN.ketLuan);
  RONG.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const hd = kq.sheetsHoaDon.filter((s) => !s.laPhu);
  const phu = kq.sheetsHoaDon.filter((s) => s.laPhu);
  const coSo = !!kq.sheetPhanMem;
  const tenSo = kq.sheetPhanMem?.ten ?? "";
  const tenHd = hd.map((s) => `"${s.ten}"`).join(", ");
  const dong = hd.flatMap((s) => s.dong);
  // Sheet có gì để dò lệch cộng cột (lệch khác 0 hoặc có dòng ghi sai).
  const canDo = hd.filter((s) => s.canDoiCot.dongLech.some((d) => d.loai === "that") || Math.abs(phanTichLech(s).V) > 0.5);

  // --- Câu trả lời. Thứ tự theo việc chính của file: có sổ ⇒ chưa kê; hai bản ⇒ so
  // hai bản; chỉ bảng kê ⇒ cộng cột. Tự kiểm luôn cuối. ---
  const traLoi: TraLoi[] = [];
  const congCot: TraLoi[] = hd.map((s) => {
    const t = cauTraLoiCongCot(s, cotRa);
    const coKhoi = canDo.includes(s);
    return {
      viec: `Sheet ${s.ten}: chưa thuế + thuế có bằng tổng thanh toán?`,
      ketLuan: t.cau,
      xem: coKhoi ? { chu: `Chi tiết sheet ${s.ten} bên dưới`, khoi: `doLech:${s.ten}` } : undefined,
      lamGi: t.sai ? "Sửa các dòng tô đỏ theo bảng DÒNG PHẢI SỬA (có ghi rõ ô nào, số đúng là bao nhiêu)." : "",
      muc: t.sai ? "do" : coKhoi ? "vang" : "xanh",
    };
  });

  if (!coSo && !ds.haiBan) traLoi.push(...congCot);

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

  if (coSo || ds.haiBan) traLoi.push(...congCot);

  if (ds.cungNgay.length) {
    const nghi = ds.cungNgay.filter((g) => g.trungSoTien).length;
    traLoi.push({
      viec: "Hóa đơn cùng MST cùng ngày",
      ketLuan: `${ds.cungNgay.length} nhóm · ${ds.cungNgay.reduce((s, g) => s + g.soHoaDon, 0)} hóa đơn. ${nghi ? `${nghi} nhóm có hóa đơn TRÙNG KHÍT số tiền — chỗ dễ kê hai lần.` : "Không nhóm nào trùng khít số tiền."}`,
      xem: { chu: `Sheet ${TEN.cungNgay} (cuối file)`, sheet: TEN.cungNgay },
      lamGi: nghi ? "Chỉ để soát bằng mắt khi cần: nhóm tô vàng xếp đầu sheet. Nhiều hóa đơn một ngày chưa chắc là sai." : "Chỉ để soát bằng mắt khi cần — không phải lỗi.",
      muc: "xanh",
    });
  }

  const soNghi = kq.nghiVan.length + kq.nghiVanGop.length;
  traLoi.push({
    viec: "Ô số liệu nghi sai trong file",
    ketLuan: soNghi ? `${soNghi} chỗ cần soát (máy không tự sửa ô nào).` : "Không có chỗ nào nghi vấn.",
    xem: soNghi ? { chu: "Khối CHỖ CẦN SOÁT LẠI bên dưới", khoi: "nghiVan" } : undefined,
    lamGi: soNghi ? 'Mỗi dòng trỏ đúng ô trong file này; máy suy được số đúng thì bấm "Sửa" trên màn hình.' : "",
    muc: soNghi ? "vang" : "xanh",
  });

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
    xem: { chu: "Khối MÁY TỰ KIỂM TRA cuối sheet", khoi: "tuKiem" },
    lamGi: "",
    muc: dat === kq.phepThu.length ? "xanh" : "do",
  });

  // --- Đầu trang ---
  const tieuDe = coSo
    ? `KẾT QUẢ ĐỐI SOÁT HÓA ĐƠN ĐIỆN TỬ VỚI SỔ "${tenSo}"`
    : ds.haiBan
      ? "KẾT QUẢ SO HAI BẢN HÓA ĐƠN ĐIỆN TỬ"
      : "KẾT QUẢ DÒ: CHƯA THUẾ + THUẾ CÓ BẰNG TỔNG THANH TOÁN KHÔNG";
  const cheDo = coSo
    ? `Đối chiếu ${hd.length} sheet hóa đơn điện tử (${tenHd}) với sổ kế toán "${tenSo}". Cột A của các sheet là cột KẾT QUẢ mới chèn nên cột gốc dời sang phải 1 cột.`
    : ds.haiBan
      ? `File có HAI BẢN hóa đơn điện tử (thuế gửi: ${ds.haiBan.sheetThue.join(" + ")} · tự tải: ${ds.haiBan.sheetTai.join(" + ")}), không có sổ kế toán. Mọi ô vẫn ở đúng địa chỉ cũ.`
      : `File chỉ có bảng kê hóa đơn (${tenHd}), không có sổ kế toán. Mọi ô vẫn ở ĐÚNG ĐỊA CHỈ CŨ; kết quả kiểm từng dòng nằm ở 3 cột mới nối cuối mỗi sheet, dòng có lệch được tô màu.`;
  let r = cau(ws, 1, tieuDe, { bold: true, size: 14, color: { argb: "FFFFFFFF" } }, NEN_TITLE);
  r = cau(ws, r, `${cheDo}${phu.length ? ` Sheet ${phu.map((s) => `"${s.ten}"`).join(", ")} trùng lặp (tập con) nên không cộng vào tổng.` : ""}`, { italic: true });
  r = cau(ws, r, "Không ô số liệu gốc nào bị sửa. Chữ xanh gạch chân bấm được — nhảy thẳng tới dòng/mục cần xem.", { italic: true });
  r++;

  // --- Bảng TRẢ LỜI ---
  r = tieuDeKhoi(ws, r, "TRẢ LỜI");
  tieuDe8(ws, r++, [["ĐÃ KIỂM GÌ", 1], ["KẾT LUẬN", 4], ["XEM Ở ĐÂU", 2], ["PHẢI LÀM GÌ", 1]]);
  const hangTL = new Map<TraLoi, number>();
  for (const t of traLoi) hangTL.set(t, r++);
  r++;

  // --- Các khối phía dưới — ghi trước để biết hàng, rồi mới điền link ở bảng trả lời ---
  const moc = new Map<string, number>();
  for (const s of !coSo ? canDo : []) {
    moc.set(`doLech:${s.ten}`, r);
    r = khoiDoLech(ws, r, s, cotRa) + 1;
  }
  if (coSo) {
    r = khoiDoiChieu(ws, r, kq) + 2;
    for (const s of canDo) {
      moc.set(`doLech:${s.ten}`, r);
      r = khoiDoLech(ws, r, s, cotRa) + 1;
    }
  }
  if (soNghi) {
    moc.set("nghiVan", r);
    r = khoiNghiVan(ws, r, kq) + 2;
  }
  moc.set("tuKiem", r);
  khoiTuKiem(ws, r, kq);

  const NEN_MUC = { do: NEN_TRUOT, vang: NEN_NGHI, xanh: NEN_DAT } as const;
  for (const [t, hang] of hangTL) {
    let xem: GiaTriO = "";
    if (t.xem) {
      const dich = t.xem.khoi ? (moc.has(t.xem.khoi) ? lienKet(TEN.ketLuan, `A${moc.get(t.xem.khoi)}`) : null) : lienKet(t.xem.sheet!, t.xem.o);
      xem = dich ? oLink(dich, t.xem.chu) : t.xem.chu;
    }
    hang8(ws, hang, [[t.viec, 1], [t.ketLuan, 4], [xem, 2], [t.lamGi, 1]], NEN_MUC[t.muc]);
    ws.getCell(hang, 1).font = { bold: true };
  }
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
export function themSheetTongHop(wb: Workbook, kq: KetQuaDoiSoat, cotRa: CotRa): void {
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
  const ketLuan = sheetKetLuan(wb, kq, { chuaKe: chuaKe?.moc ?? null, haiBan: soHaiBan, cungNgay }, cotRa);

  [ketLuan, chuaKe?.ws, haiBan].forEach((w, i) => w && ((w as unknown as ThuTu).orderNo = i));
  // CÙNG MST CÙNG NGÀY là danh sách THAM KHẢO (nhiều hóa đơn một ngày chưa chắc
  // sai), không phải kết quả đối soát ⇒ xếp sau các sheet gốc, trước nhật ký sửa.
  if (ngay) (ngay as unknown as ThuTu).orderNo = 1000;
  const nk = wb.worksheets.find((w) => w.name === "NHẬT KÝ SỬA");
  if (nk) (nk as unknown as ThuTu).orderNo = 2000;
}
