/**
 * Xuất Excel đối soát **GIỮ NGUYÊN ĐỊNH DẠNG FILE GỐC**.
 *
 * Vì sao có file này: bản cũ (`xuatExcelDoiSoat` trong `doiSoatHddt.ts`) dựng
 * workbook MỚI từ giá trị, nên font / khung / định dạng số / ô gộp / độ rộng cột
 * của file cổng thuế đều biến mất — kế toán mở ra thấy một file lạ, không soi
 * song song với bản gốc được nữa.
 *
 * Cách làm ở đây: **nạp lại chính bytes file người dùng tải lên rồi sửa tại chỗ**
 * bằng `exceljs` (thư viện đọc-ghi giữ được font/khung/numFmt/merge/công thức —
 * `xlsx-js-style` chỉ giữ mỗi màu nền khi đọc). Hai nguyên tắc bất di bất dịch:
 *
 * 1. **Bố cục bám đúng file mẫu kế toán đang dùng**: chèn cột `KẾT QUẢ` làm cột A,
 *    dữ liệu gốc dời sang phải 1 cột, khối cột phân tích nằm SAU vùng dữ liệu
 *    (chừa 1 cột trống ngăn cách), và sheet `KẾT LUẬN CHUNG` đứng đầu workbook
 *    (+ sheet danh sách chỉ khi có dữ liệu — xem `doiSoatXuatTongHop.ts`).
 *    Chèn cột thì **bắt buộc phải dịch tham chiếu công thức** — xem `doiSoatXuatShift.ts`.
 * 2. Chỉ ghi đè hai thứ trong vùng dữ liệu: **màu nền dòng** (để nhìn ra khớp/lệch/
 *    thiếu) và **ô người dùng bấm Sửa**. Font, khung, canh lề, định dạng số, ô gộp,
 *    độ rộng cột, chiều cao dòng của file gốc giữ nguyên.
 *
 * Chạy lại trên chính file đã xuất thì ghi đè đúng khối cột cũ (không đẻ thêm cột)
 * — `goCotDoiSoatCu` bên `doiSoatHddt.ts` lo phần gỡ khỏi dữ liệu đọc vào.
 */
import type {
  DongHoaDon,
  DongPhanMem,
  KetQuaDoiSoat,
  SheetHoaDon,
  SheetPhanMem,
  ToaDoGoc,
} from "./doiSoatHddt";
import {
  CHU_THICH,
  CHU_THICH_PM,
  DICH_COT_XUAT,
  HEADER_HD_THEM,
  HEADER_KIEM,
  NHAN_LECH_CONG,
  base64SangXlsx,
  HEADER_PM_THEM,
  cotExcel,
  ngayHienThi,
} from "./doiSoatHddt";
import { chenCotDau, dichThamChieuCheoSheet, xoaCotDuoi } from "./doiSoatXuatShift";
import { themSheetTongHop } from "./doiSoatXuatTongHop";

// exceljs nạp động: chunk /doi-soat đã nặng, không kéo thêm vào bundle chính.
type Worksheet = import("exceljs").Worksheet;

/** Màu nền theo nhãn — trùng bảng màu ở `doiSoatHddt.ts` (ARGB cho exceljs). */
const NEN = {
  xanh: "FFC6EFCE",
  vang: "FFFFEB9C",
  do: "FFFFC7CE",
  tieuDe: "FFD9E1F2",
  sua: "FFFFD966",
} as const;

const to = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

/** 1 cột trống ngăn giữa dữ liệu gốc và khối cột đối soát. */
const COT_NGAN = 1;

/** Ô là công thức sống: `{r}` thay bằng số dòng thật lúc ghi. */
type OCongThuc = { ct: string };
const laCongThuc = (v: unknown): v is OCongThuc =>
  typeof v === "object" && v !== null && typeof (v as OCongThuc).ct === "string";

function oXuat(v: unknown): string | number | null {
  if (v instanceof Date) return ngayHienThi(v);
  if (typeof v === "number" || typeof v === "string") return v;
  if (v == null || v === "") return null;
  return String(v);
}

/**
 * Ghi khối đối soát vào một sheet CÓ SẴN của file gốc.
 * @param rong  số cột dữ liệu gốc (đã trừ cột đối soát của lần chạy trước)
 */
function ghiKhoiDoiSoat(
  ws: Worksheet,
  goc: ToaDoGoc,
  hIdx: number,
  rong: number,
  chuThich: string,
  headerThem: readonly string[],
  dong: readonly { dongFile: number; ketLuan: string; nen: string | null; them: readonly unknown[] }[],
  cotSua: readonly { dongFile: number; cot: number; giaTri: number }[],
  /** Tiêu đề cột A. */
  nhanCotA = "KẾT QUẢ",
  /**
   * false = KHÔNG có cột A chèn thêm (file chỉ có bảng kê — v6.5): địa chỉ mọi ô giữ
   * nguyên như file của kế toán, chỉ nối khối kiểm ở cuối.
   */
  coCotA = true,
  /** Cột AOA → cột trong file ra lệch bao nhiêu (tính cả cột A cũ/mới) — để ghi ô Sửa đúng chỗ. */
  dichCot: number = DICH_COT_XUAT
): void {
  const D = coCotA ? DICH_COT_XUAT : 0;
  // Dữ liệu gốc đã dời sang phải D cột ⇒ khối thêm bắt đầu sau nó, chừa 1 cột trống.
  const cot1 = goc.c0 + rong + D + COT_NGAN + 1; // 1-based
  const cotCuoi = cot1 + headerThem.length - 1;
  const hangTieuDe = goc.r0 + hIdx + 1;
  const COT_KQ = 1; // cột "KẾT QUẢ" vừa chèn vào đầu sheet
  const cotDauTo = coCotA ? COT_KQ : goc.c0 + 1; // tô nền từ cột này

  // --- tiêu đề: lấy dáng từ chính tiêu đề gốc để nhìn liền mạch ---
  const mau = ws.getCell(hangTieuDe, goc.c0 + D + 1);
  const dungTieuDe = (o: ReturnType<Worksheet["getCell"]>, ten: string) => {
    o.value = ten;
    if (mau.font) o.font = { ...mau.font, bold: true };
    if (mau.border) o.border = { ...mau.border };
    o.alignment = { ...(mau.alignment ?? {}), vertical: "middle", wrapText: true };
    o.fill = to(NEN.tieuDe);
  };
  if (coCotA) {
    dungTieuDe(ws.getCell(hangTieuDe, COT_KQ), nhanCotA);
    ws.getColumn(COT_KQ).width = 24;
  }
  headerThem.forEach((ten, i) => {
    dungTieuDe(ws.getCell(hangTieuDe, cot1 + i), ten);
    const c = ws.getColumn(cot1 + i);
    if (!c.width) c.width = Math.min(Math.max(ten.length + 2, 12), 42);
  });

  // --- chú thích màu: ô A ngay trên hàng tiêu đề (đúng chỗ file mẫu đặt) ---
  if (hangTieuDe > 1) {
    const oCt = ws.getCell(hangTieuDe - 1, coCotA ? COT_KQ : cot1);
    if (oCt.value == null || oCt.value === "") {
      oCt.value = chuThich;
      oCt.font = { italic: true, size: 10 };
    }
  }

  // --- từng dòng: nhãn ở cột A + giá trị khối thêm + tô nền cả dòng ---
  for (const d of dong) {
    if (coCotA) ws.getCell(d.dongFile, COT_KQ).value = d.ketLuan;
    d.them.forEach((v, i) => {
      const o = ws.getCell(d.dongFile, cot1 + i);
      // Công thức sống trỏ thẳng ô gốc: bấm vào là thấy số được TÍNH ra, không phải
      // số chép tay — bằng chứng file xuất không sửa số liệu của thuế.
      if (laCongThuc(v)) o.value = { formula: v.ct.replaceAll("{r}", String(d.dongFile)) };
      else o.value = oXuat(v);
    });
    // nen null = dòng không có gì đáng nói ⇒ để nguyên màu gốc, mắt chỉ dừng ở dòng có vấn đề
    if (d.nen) {
      const nen = to(d.nen);
      for (let c = cotDauTo; c <= cotCuoi; c++) ws.getCell(d.dongFile, c).fill = nen;
    }
  }

  // --- ô người dùng đã bấm Sửa: ghi đè giá trị + đánh dấu vàng để soát lại ---
  for (const e of cotSua) {
    const o = ws.getCell(e.dongFile, cotExcel(goc, e.cot) + dichCot + 1);
    o.value = e.giaTri;
    o.fill = to(NEN.sua);
  }

  // Bộ lọc: nới vùng lọc sẵn có sang hết khối mới, giữ nguyên ô bắt đầu.
  const loc = ws.autoFilter as string | { from?: { row?: number; column?: number } } | undefined;
  const batDau =
    typeof loc === "object" && loc?.from?.row != null && loc.from.column != null
      ? { row: loc.from.row, column: loc.from.column }
      : { row: hangTieuDe, column: cotDauTo };
  ws.autoFilter = { from: batDau, to: { row: hangTieuDe, column: cotCuoi } };
}

const nenHd = (d: DongHoaDon) => (d.trangThai === "KHOP" ? NEN.xanh : d.trangThai === "LECH" ? NEN.vang : NEN.do);

const themHd = (d: DongHoaDon): unknown[] => [
  d.tyGia, d.soChuan, d.khoa, d.chuaThueVnd, d.thueVnd, d.tongTtVnd,
  d.soDongKhopPm, d.tongTtPm, d.chenh, d.ketLuan, d.phieuKe, d.ctgs, d.ngayGhiSo,
  d.tkNoCo, d.dienGiaiPm, d.soTienHachToan, d.bangChung,
];

const themPm = (d: DongPhanMem): unknown[] => [
  d.soChuan, d.khoa, d.soHddtKhop, d.ketLuan, d.nguonHddt, d.dongHddt, d.ngayLapHd,
  d.tenBanHddt, d.tongTtHddt, d.bangChung,
];

/**
 * Tiêu đề khối cột thêm. Hai chỗ đổi theo file để trùng cách gọi của kế toán:
 * tên sheet sổ (mẫu ghi "PMEM" chứ không phải "PMKT") và cặp cột TK — sổ mã máy
 * không có TK Nợ/Có mà là thuế suất / loại.
 */
const headerHd = (tenSo: string, tenTk: string): string[] =>
  HEADER_HD_THEM.map((h) =>
    h === "Số dòng khớp PMKT" ? `Số dòng khớp ${tenSo}`
    : h === "Tổng TT bên PMKT" ? `Tổng TT bên ${tenSo}`
    : h === "TK Nợ / TK Có" ? tenTk
    : h
  );
const HEADER_PM = [...HEADER_PM_THEM];

/** 0-based → chữ cái cột Excel. */
const chuCot = (c0: number): string => {
  let n = c0 + 1, s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
};

/**
 * Ba ô kiểm "chưa thuế + thuế = tổng thanh toán" cho một dòng, viết bằng CÔNG THỨC
 * trỏ vào chính ô gốc (đã dời sang phải `DICH_COT_XUAT` cột). Kế toán dò TRỰC TIẾP
 * trên sheet, không phải lật qua sheet tổng hợp.
 */
function oKiemCong(sh: SheetHoaDon, d: DongHoaDon, dich: number): unknown[] {
  const cd = sh.canDoiCot;
  if (cd.cotChua < 0 || cd.cotTong < 0) return ["", "", ""];
  const A = chuCot(cotExcel(sh.goc, cd.cotChua) + dich);
  const T = chuCot(cotExcel(sh.goc, cd.cotTong) + dich);
  const cong = cd.cotThue >= 0 ? `${A}{r}+${chuCot(cotExcel(sh.goc, cd.cotThue) + dich)}{r}` : `${A}{r}`;
  // exceljs tự thêm dấu "=" — đừng viết sẵn, không là ra "==N3+O3".
  return [
    { ct: cong },
    { ct: `${T}{r}-(${cong})` },
    d.lechCong ? NHAN_LECH_CONG[d.lechCong.loai] : "",
  ];
}

/**
 * Màu dòng khi file CHỈ có bảng kê: CHỈ tô dòng có lệch (đỏ = sai thật, vàng = phí /
 * chiết khấu / làm tròn). Dòng khớp để nguyên — tô xanh 3.000 dòng thì mắt không biết dừng đâu.
 */
const nenKiem = (d: DongHoaDon) =>
  !d.lechCong ? null : d.lechCong.loai === "that" ? NEN.do : NEN.vang;

/** Các ô người dùng bấm Sửa, gom theo sheet (key `edits` = `sheet#soDong#cot`). */
function suaTheoSheet(
  edits: Record<string, number> | undefined,
  dongTheoSoDong: Map<number, number>,
  ten: string
): { dongFile: number; cot: number; giaTri: number }[] {
  if (!edits) return [];
  const ra: { dongFile: number; cot: number; giaTri: number }[] = [];
  for (const [k, v] of Object.entries(edits)) {
    const phan = k.split("#");
    const cot = Number(phan.pop());
    const soDong = Number(phan.pop());
    if (phan.join("#") !== ten) continue;
    const dongFile = dongTheoSoDong.get(soDong);
    if (dongFile != null && Number.isFinite(cot)) ra.push({ dongFile, cot, giaTri: v });
  }
  return ra;
}

function taiVe(bytes: ArrayBuffer, tenFile: string): void {
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = tenFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Xuất workbook đối soát dựa trên **chính file gốc** (base64 người dùng đã tải lên).
 * Ném lỗi nếu không nạp được file — nơi gọi bắt lấy để lùi về bản dựng-mới.
 */
export async function xuatExcelGiuDinhDang(
  kq: KetQuaDoiSoat,
  fileGocB64: string,
  tenFile = "doi-soat-hddt.xlsx",
  edits?: Record<string, number>
): Promise<void> {
  // exceljs là gói CJS: tùy bundler mà nằm ở `default` hay ngay trên namespace.
  const mod = (await import("exceljs")) as unknown as Record<string, unknown>;
  const ExcelJS = ((mod.default as Record<string, unknown> | undefined)?.Workbook ? mod.default : mod) as typeof import("exceljs");
  const wb = new ExcelJS.Workbook();
  // `base64SangXlsx` đổi vỏ .xls → .xlsx: exceljs chỉ đọc được .xlsx, đưa .xls vào
  // là nó trả workbook RỖNG (không ném lỗi) rồi ta báo "không tìm thấy sheet".
  const bytes = base64SangXlsx(fileGocB64);
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

  const timSheet = (ten: string): Worksheet | undefined =>
    wb.worksheets.find((w) => w.name === ten) ?? wb.getWorksheet(ten);

  const thieu: string[] = [];
  for (const sh of [...kq.sheetsHoaDon, kq.sheetPhanMem, ...kq.sheetsPhanMemPhu])
    if (sh && !timSheet(sh.ten)) thieu.push(sh.ten);
  if (thieu.length)
    throw new Error(`Không tìm thấy sheet ${thieu.map((t) => `"${t}"`).join(", ")} trong file gốc.`);

  // --- B1. Dọn khối cột của lần chạy trước, rồi chèn cột "KẾT QUẢ" làm cột A ---
  const dsSheet = [...kq.sheetsHoaDon, kq.sheetPhanMem, ...kq.sheetsPhanMemPhu].filter(
    (x): x is SheetHoaDon | SheetPhanMem => !!x
  );
  // File đã qua một lần xuất thì cột A của nó ĐANG là "KẾT QUẢ": engine gỡ cột
  // đó khỏi dữ liệu đọc vào, nên `cotExcel` của cột gốc đầu tiên lệch sẵn 1.
  // Trường hợp đó chỉ ghi đè cột A, KHÔNG chèn thêm — nếu không mỗi lần xuất lại
  // đẻ thêm một cột "KẾT QUẢ" nữa.
  const daCoCotKq = (sh: SheetHoaDon | SheetPhanMem) => cotExcel(sh.goc, 0) - sh.goc.c0 >= DICH_COT_XUAT;
  // File CHỈ có bảng kê (không sổ) thì KHÔNG chèn cột A (v6.5): kế toán dò theo địa
  // chỉ ô của chính họ (VD Q3049) — dời sang R3049 là họ lạc. File xuất từ bản cũ
  // đã có cột A thì GỠ nó ra để địa chỉ trở về như file gốc.
  const khongCotA = !kq.sheetPhanMem;
  const canChen = khongCotA ? [] : dsSheet.filter((sh) => !daCoCotKq(sh));
  const tenChen = new Set(canChen.map((sh) => sh.ten));
  const tenBo = new Set(khongCotA ? dsSheet.filter(daCoCotKq).map((sh) => sh.ten) : []);

  for (const sh of dsSheet) {
    const ws = timSheet(sh.ten)!;
    // dữ liệu gốc chiếm các cột [lech+1 … lech+rong]; mọi cột sau đó là của lần xuất trước
    const lech = daCoCotKq(sh) ? DICH_COT_XUAT : 0;
    xoaCotDuoi(ws, sh.goc.c0 + lech + sh.rong + 1);
  }
  for (const ws of wb.worksheets)
    if (tenChen.has(ws.name)) chenCotDau(ws, DICH_COT_XUAT, tenChen);
    else if (tenChen.size) dichThamChieuCheoSheet(ws, DICH_COT_XUAT, tenChen);
  for (const ws of wb.worksheets)
    if (tenBo.has(ws.name)) chenCotDau(ws, -DICH_COT_XUAT, tenBo);
    else if (tenBo.size) dichThamChieuCheoSheet(ws, -DICH_COT_XUAT, tenBo);
  /** Cột (0-based) trong FILE RA của cột AOA `c` — cho công thức kiểm + địa chỉ ở sheet kết luận. */
  const dichRa = (sh: SheetHoaDon | SheetPhanMem) =>
    khongCotA ? (daCoCotKq(sh) ? -DICH_COT_XUAT : 0) : daCoCotKq(sh) ? 0 : DICH_COT_XUAT;
  const cotRa = (sh: SheetHoaDon, c: number) => cotExcel(sh.goc, c) + dichRa(sh);

  // --- B2. Ghi khối đối soát ---
  const tenSo = kq.sheetPhanMem?.ten ?? "PMKT";
  const tenTk = kq.sheetPhanMem?.tenTk ?? "TK Nợ / TK Có";
  // File CHỈ có bảng kê thuế, không có sheet sổ ⇒ mọi cột đối soát với sổ đều rỗng,
  // in ra chỉ tổ rối. Khi đó chuyển sang CHẾ ĐỘ KIỂM BẢNG KÊ: cột A và màu dòng nói
  // về phép kiểm "chưa thuế + thuế = tổng thanh toán", khối thêm chỉ 3 cột kiểm.
  const kiemBangKe = !kq.sheetPhanMem;
  // Có sổ: cột kiểm xuống CUỐI khối, giữ nguyên thứ tự cột theo file mẫu kế toán.
  const HEADER_HD = kiemBangKe ? [...HEADER_KIEM] : [...headerHd(tenSo, tenTk), ...HEADER_KIEM];

  const ghiHd = (sh: SheetHoaDon) => {
    const ws = timSheet(sh.ten)!;
    const chuThich = kiemBangKe
      ? `Dòng ĐỎ = chưa thuế + thuế KHÁC tổng thanh toán, phải soát · dòng VÀNG = lệch do phí / chiết khấu / làm tròn, bình thường · dòng không tô = khớp. 3 cột này là công thức tính từ ô gốc, không ô gốc nào bị sửa.`
      : sh.laPhu
        ? `${CHU_THICH} — (SHEET TRÙNG LẶP / TẬP CON: KHÔNG cộng vào tổng)`
        : CHU_THICH;
    ghiKhoiDoiSoat(
      ws, sh.goc, sh.hIdx, sh.rong, chuThich, HEADER_HD,
      sh.dong.map((d) => ({
        dongFile: d.dongFile,
        ketLuan: kiemBangKe ? (d.lechCong ? NHAN_LECH_CONG[d.lechCong.loai] : "khớp") : d.ketLuan,
        nen: kiemBangKe ? nenKiem(d) : nenHd(d),
        them: kiemBangKe
          ? oKiemCong(sh, d, dichRa(sh))
          : [...themHd(d), ...oKiemCong(sh, d, dichRa(sh))],
      })),
      suaTheoSheet(edits, new Map(sh.dong.map((d) => [d.soDong, d.dongFile])), sh.ten),
      kiemBangKe ? "KIỂM CỘNG" : "KẾT QUẢ",
      !khongCotA,
      dichRa(sh)
    );
  };

  const ghiPm = (sh: SheetPhanMem) => {
    const ws = timSheet(sh.ten)!;
    ghiKhoiDoiSoat(
      ws, sh.goc, sh.hIdx, sh.rong,
      sh.laPhu ? `${CHU_THICH_PM} — (SHEET PHỤ / TẬP CON: KHÔNG cộng vào tổng)` : CHU_THICH_PM,
      HEADER_PM,
      sh.dong.map((d) => ({
        dongFile: d.dongFile,
        ketLuan: d.ketLuan,
        nen: d.trangThai === "CO" ? NEN.xanh : NEN.do,
        them: themPm(d),
      })),
      suaTheoSheet(edits, new Map(sh.dong.map((d) => [d.soDong, d.dongFile])), sh.ten),
      "KẾT QUẢ",
      true,
      dichRa(sh)
    );
  };

  for (const sh of kq.sheetsHoaDon) ghiHd(sh);
  if (kq.sheetPhanMem) ghiPm(kq.sheetPhanMem);
  for (const p of kq.sheetsPhanMemPhu) ghiPm(p);

  // --- B3. Sheet phụ trợ: KẾT LUẬN CHUNG (+ danh sách có dữ liệu) lên ĐẦU, nhật ký sửa xuống cuối ---
  if (kq.nhatKySua.length) {
    const ten = "NHẬT KÝ SỬA";
    const cu = timSheet(ten);
    if (cu) wb.removeWorksheet(cu.id);
    const nk = wb.addWorksheet(ten);
    nk.addRow(["NHẬT KÝ SỬA — do người dùng xác nhận, giữ lại giá trị cũ"]);
    nk.addRow(["Vị trí", "Giá trị cũ", "Giá trị mới"]);
    nk.getRow(2).font = { bold: true };
    nk.getRow(2).fill = to(NEN.tieuDe);
    for (const n of kq.nhatKySua) nk.addRow([n.viTri, n.cu, n.moi]);
    nk.columns.forEach((c, i) => (c.width = i === 0 ? 54 : 22));
    (nk as unknown as { orderNo: number }).orderNo = 99;
  }
  themSheetTongHop(wb, kq, (sh, c) => cotRa(sh, c));

  // Công thức trong file đã bị dịch cột ⇒ ép Excel tính lại lúc mở, đừng tin
  // giá trị cache của lần lưu trước.
  wb.calcProperties.fullCalcOnLoad = true;

  taiVe(await wb.xlsx.writeBuffer(), tenFile);
}
