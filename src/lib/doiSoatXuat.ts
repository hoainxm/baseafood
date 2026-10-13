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
import { MAU_NEN as NEN, chuCotExcel as chuCot, nenDac as to, tachKhoaSua } from "./doiSoatChung";
import { chenCotDau, dichThamChieuCheoSheet, xoaCotDuoi } from "./doiSoatXuatShift";
import { themSheetTongHop } from "./doiSoatXuatTongHop";

// exceljs nạp động: chunk /doi-soat đã nặng, không kéo thêm vào bundle chính.
type Worksheet = import("exceljs").Worksheet;

/** 1 cột trống ngăn giữa dữ liệu gốc và khối cột đối soát. */
const SHORT_COL = 1;

/** Ô là công thức sống: `{r}` thay bằng số dòng thật lúc ghi. */
type FormulaCell = { ct: string };
const isFormula = (v: unknown): v is FormulaCell =>
  typeof v === "object" && v !== null && typeof (v as FormulaCell).ct === "string";

function toExportCell(v: unknown): string | number | null {
  if (v instanceof Date) return ngayHienThi(v);
  if (typeof v === "number" || typeof v === "string") return v;
  if (v == null || v === "") return null;
  return String(v);
}

/**
 * Ghi khối đối soát vào một sheet CÓ SẴN của file gốc.
 * @param width  số cột dữ liệu gốc (đã trừ cột đối soát của lần chạy trước)
 */
function writeReconcileBlock(
  ws: Worksheet,
  goc: ToaDoGoc,
  hIdx: number,
  width: number,
  chuThich: string,
  extraHeaders: readonly string[],
  dong: readonly { dongFile: number; ketLuan: string; nen: string | null; them: readonly unknown[] }[],
  editedCells: readonly { dongFile: number; cot: number; giaTri: number }[],
  /** Tiêu đề cột A. */
  columnALabel = "KẾT QUẢ",
  /**
   * false = KHÔNG có cột A chèn thêm (file chỉ có bảng kê — v6.5): địa chỉ mọi ô giữ
   * nguyên như file của kế toán, chỉ nối khối kiểm ở cuối.
   */
  hasColumnA = true,
  /** Cột AOA → cột trong file ra lệch bao nhiêu (tính cả cột A cũ/mới) — để ghi ô Sửa đúng chỗ. */
  columnShift: number = DICH_COT_XUAT
): void {
  const D = hasColumnA ? DICH_COT_XUAT : 0;
  // Dữ liệu gốc đã dời sang phải D cột ⇒ khối thêm bắt đầu sau nó, chừa 1 cột trống.
  const cot1 = goc.c0 + width + D + SHORT_COL + 1; // 1-based
  const lastColumn = cot1 + extraHeaders.length - 1;
  const headerRow = goc.r0 + hIdx + 1;
  const RESULT_COL = 1; // cột "KẾT QUẢ" vừa chèn vào đầu sheet
  const firstShadedColumn = hasColumnA ? RESULT_COL : goc.c0 + 1; // tô nền từ cột này

  // --- tiêu đề: lấy dáng từ chính tiêu đề gốc để nhìn liền mạch ---
  const styleCell = ws.getCell(headerRow, goc.c0 + D + 1);
  const buildHeader = (o: ReturnType<Worksheet["getCell"]>, ten: string) => {
    o.value = ten;
    if (styleCell.font) o.font = { ...styleCell.font, bold: true };
    if (styleCell.border) o.border = { ...styleCell.border };
    o.alignment = { ...(styleCell.alignment ?? {}), vertical: "middle", wrapText: true };
    o.fill = to(NEN.tieuDe);
  };
  if (hasColumnA) {
    buildHeader(ws.getCell(headerRow, RESULT_COL), columnALabel);
    ws.getColumn(RESULT_COL).width = 24;
  }
  extraHeaders.forEach((ten, i) => {
    buildHeader(ws.getCell(headerRow, cot1 + i), ten);
    const c = ws.getColumn(cot1 + i);
    if (!c.width) c.width = Math.min(Math.max(ten.length + 2, 12), 42);
  });

  // --- chú thích màu: ô A ngay trên hàng tiêu đề (đúng chỗ file mẫu đặt) ---
  if (headerRow > 1) {
    const oCt = ws.getCell(headerRow - 1, hasColumnA ? RESULT_COL : cot1);
    if (oCt.value == null || oCt.value === "") {
      oCt.value = chuThich;
      oCt.font = { italic: true, size: 10 };
    }
  }

  // --- từng dòng: nhãn ở cột A + giá trị khối thêm + tô nền cả dòng ---
  for (const d of dong) {
    if (hasColumnA) ws.getCell(d.dongFile, RESULT_COL).value = d.ketLuan;
    d.them.forEach((v, i) => {
      const o = ws.getCell(d.dongFile, cot1 + i);
      // Công thức sống trỏ thẳng ô gốc: bấm vào là thấy số được TÍNH ra, không phải
      // số chép tay — bằng chứng file xuất không sửa số liệu của thuế.
      if (isFormula(v)) o.value = { formula: v.ct.replaceAll("{r}", String(d.dongFile)) };
      else o.value = toExportCell(v);
    });
    // nen null = dòng không có gì đáng nói ⇒ để nguyên màu gốc, mắt chỉ dừng ở dòng có vấn đề
    if (d.nen) {
      const nen = to(d.nen);
      for (let c = firstShadedColumn; c <= lastColumn; c++) ws.getCell(d.dongFile, c).fill = nen;
    }
  }

  // --- ô người dùng đã bấm Sửa: ghi đè giá trị + đánh dấu vàng để soát lại ---
  for (const e of editedCells) {
    const o = ws.getCell(e.dongFile, cotExcel(goc, e.cot) + columnShift + 1);
    o.value = e.giaTri;
    o.fill = to(NEN.sua);
  }

  // Bộ lọc: nới vùng lọc sẵn có sang hết khối mới, giữ nguyên ô bắt đầu.
  const autoFilter = ws.autoFilter as string | { from?: { row?: number; column?: number } } | undefined;
  const batDau =
    typeof autoFilter === "object" && autoFilter?.from?.row != null && autoFilter.from.column != null
      ? { row: autoFilter.from.row, column: autoFilter.from.column }
      : { row: headerRow, column: firstShadedColumn };
  ws.autoFilter = { from: batDau, to: { row: headerRow, column: lastColumn } };
}

const nenHd = (d: DongHoaDon) => (d.trangThai === "KHOP" ? NEN.xanh : d.trangThai === "LECH" ? NEN.vang : NEN.do);

const addInvoiceRow = (d: DongHoaDon): unknown[] => [
  d.tyGia, d.soChuan, d.khoa, d.chuaThueVnd, d.thueVnd, d.tongTtVnd,
  d.soDongKhopPm, d.tongTtPm, d.chenh, d.ketLuan, d.phieuKe, d.ctgs, d.ngayGhiSo,
  d.tkNoCo, d.dienGiaiPm, d.soTienHachToan, d.bangChung,
];

const addLedgerRow = (d: DongPhanMem): unknown[] => [
  d.soChuan, d.khoa, d.soHddtKhop, d.ketLuan, d.nguonHddt, d.dongHddt, d.ngayLapHd,
  d.tenBanHddt, d.tongTtHddt, d.bangChung,
];

/**
 * Tiêu đề khối cột thêm. Hai chỗ đổi theo file để trùng cách gọi của kế toán:
 * tên sheet sổ (mẫu ghi "PMEM" chứ không phải "PMKT") và cặp cột TK — sổ mã máy
 * không có TK Nợ/Có mà là thuế suất / loại.
 */
const headerHd = (ledgerName: string, tenTk: string): string[] =>
  HEADER_HD_THEM.map((h) =>
    h === "Số dòng khớp PMKT" ? `Số dòng khớp ${ledgerName}`
    : h === "Tổng TT bên PMKT" ? `Tổng TT bên ${ledgerName}`
    : h === "TK Nợ / TK Có" ? tenTk
    : h
  );
const HEADER_PM = [...HEADER_PM_THEM];

/**
 * Ba ô kiểm "chưa thuế + thuế = tổng thanh toán" cho một dòng, viết bằng CÔNG THỨC
 * trỏ vào chính ô gốc (đã dời sang phải `DICH_COT_XUAT` cột). Kế toán dò TRỰC TIẾP
 * trên sheet, không phải lật qua sheet tổng hợp.
 */
function sumCheckCells(sh: SheetHoaDon, d: DongHoaDon, shift: number): unknown[] {
  const cd = sh.canDoiCot;
  if (cd.cotChua < 0 || cd.cotTong < 0) return ["", "", ""];
  const A = chuCot(cotExcel(sh.goc, cd.cotChua) + shift);
  const T = chuCot(cotExcel(sh.goc, cd.cotTong) + shift);
  const sumFormula = cd.cotThue >= 0 ? `${A}{r}+${chuCot(cotExcel(sh.goc, cd.cotThue) + shift)}{r}` : `${A}{r}`;
  // exceljs tự thêm dấu "=" — đừng viết sẵn, không là ra "==N3+O3".
  return [
    { ct: sumFormula },
    { ct: `${T}{r}-(${sumFormula})` },
    d.lechCong ? NHAN_LECH_CONG[d.lechCong.loai] : "",
  ];
}

/**
 * Màu dòng khi file CHỈ có bảng kê: CHỈ tô dòng có lệch (đỏ = sai thật, vàng = phí /
 * chiết khấu / làm tròn). Dòng khớp để nguyên — tô xanh 3.000 dòng thì mắt không biết dừng đâu.
 */
const shouldCheck = (d: DongHoaDon) =>
  !d.lechCong ? null : d.lechCong.loai === "that" ? NEN.do : NEN.vang;

/** Các ô người dùng bấm Sửa, gom theo sheet (key `edits` = `sheet#soDong#cot`). */
function editsBySheet(
  edits: Record<string, number> | undefined,
  rowByLineNo: Map<number, number>,
  ten: string
): { dongFile: number; cot: number; giaTri: number }[] {
  if (!edits) return [];
  const ra: { dongFile: number; cot: number; giaTri: number }[] = [];
  for (const [k, v] of Object.entries(edits)) {
    const { sheet, soDong, cot } = tachKhoaSua(k);
    if (sheet !== ten) continue;
    const dongFile = rowByLineNo.get(soDong);
    if (dongFile != null && Number.isFinite(cot)) ra.push({ dongFile, cot, giaTri: v });
  }
  return ra;
}

function downloadFile(bytes: ArrayBuffer, tenFile: string): void {
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

  const findSheet = (ten: string): Worksheet | undefined =>
    wb.worksheets.find((w) => w.name === ten) ?? wb.getWorksheet(ten);

  const thieu: string[] = [];
  for (const sh of [...kq.sheetsHoaDon, kq.sheetPhanMem, ...kq.sheetsPhanMemPhu])
    if (sh && !findSheet(sh.ten)) thieu.push(sh.ten);
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
  const hasResultColumn = (sh: SheetHoaDon | SheetPhanMem) => cotExcel(sh.goc, 0) - sh.goc.c0 >= DICH_COT_XUAT;
  // File CHỈ có bảng kê (không sổ) thì KHÔNG chèn cột A (v6.5): kế toán dò theo địa
  // chỉ ô của chính họ (VD Q3049) — dời sang R3049 là họ lạc. File xuất từ bản cũ
  // đã có cột A thì GỠ nó ra để địa chỉ trở về như file gốc.
  const hasNoColumnA = !kq.sheetPhanMem;
  const canChen = hasNoColumnA ? [] : dsSheet.filter((sh) => !hasResultColumn(sh));
  const tenChen = new Set(canChen.map((sh) => sh.ten));
  const skippedNames = new Set(hasNoColumnA ? dsSheet.filter(hasResultColumn).map((sh) => sh.ten) : []);

  for (const sh of dsSheet) {
    const ws = findSheet(sh.ten)!;
    // dữ liệu gốc chiếm các cột [lech+1 … lech+rong]; mọi cột sau đó là của lần xuất trước
    const lech = hasResultColumn(sh) ? DICH_COT_XUAT : 0;
    xoaCotDuoi(ws, sh.goc.c0 + lech + sh.rong + 1);
  }
  for (const ws of wb.worksheets)
    if (tenChen.has(ws.name)) chenCotDau(ws, DICH_COT_XUAT, tenChen);
    else if (tenChen.size) dichThamChieuCheoSheet(ws, DICH_COT_XUAT, tenChen);
  for (const ws of wb.worksheets)
    if (skippedNames.has(ws.name)) chenCotDau(ws, -DICH_COT_XUAT, skippedNames);
    else if (skippedNames.size) dichThamChieuCheoSheet(ws, -DICH_COT_XUAT, skippedNames);
  /** Cột (0-based) trong FILE RA của cột AOA `c` — cho công thức kiểm + địa chỉ ở sheet kết luận. */
  const outputShift = (sh: SheetHoaDon | SheetPhanMem) =>
    hasNoColumnA ? (hasResultColumn(sh) ? -DICH_COT_XUAT : 0) : hasResultColumn(sh) ? 0 : DICH_COT_XUAT;
  const outputColumn = (sh: SheetHoaDon, c: number) => cotExcel(sh.goc, c) + outputShift(sh);

  // --- B2. Ghi khối đối soát ---
  const ledgerName = kq.sheetPhanMem?.ten ?? "PMKT";
  const tenTk = kq.sheetPhanMem?.tenTk ?? "TK Nợ / TK Có";
  // File CHỈ có bảng kê thuế, không có sheet sổ ⇒ mọi cột đối soát với sổ đều rỗng,
  // in ra chỉ tổ rối. Khi đó chuyển sang CHẾ ĐỘ KIỂM BẢNG KÊ: cột A và màu dòng nói
  // về phép kiểm "chưa thuế + thuế = tổng thanh toán", khối thêm chỉ 3 cột kiểm.
  const checkListing = !kq.sheetPhanMem;
  // Có sổ: cột kiểm xuống CUỐI khối, giữ nguyên thứ tự cột theo file mẫu kế toán.
  const HEADER_HD = checkListing ? [...HEADER_KIEM] : [...headerHd(ledgerName, tenTk), ...HEADER_KIEM];

  const writeInvoiceSheet = (sh: SheetHoaDon) => {
    const ws = findSheet(sh.ten)!;
    const chuThich = checkListing
      ? `Dòng ĐỎ = chưa thuế + thuế KHÁC tổng thanh toán, phải soát · dòng VÀNG = lệch do phí / chiết khấu / làm tròn, bình thường · dòng không tô = khớp. 3 cột này là công thức tính từ ô gốc, không ô gốc nào bị sửa.`
      : sh.laPhu
        ? `${CHU_THICH} — (SHEET TRÙNG LẶP / TẬP CON: KHÔNG cộng vào tổng)`
        : CHU_THICH;
    writeReconcileBlock(
      ws, sh.goc, sh.hIdx, sh.rong, chuThich, HEADER_HD,
      sh.dong.map((d) => ({
        dongFile: d.dongFile,
        ketLuan: checkListing ? (d.lechCong ? NHAN_LECH_CONG[d.lechCong.loai] : "khớp") : d.ketLuan,
        nen: checkListing ? shouldCheck(d) : nenHd(d),
        them: checkListing
          ? sumCheckCells(sh, d, outputShift(sh))
          : [...addInvoiceRow(d), ...sumCheckCells(sh, d, outputShift(sh))],
      })),
      editsBySheet(edits, new Map(sh.dong.map((d) => [d.soDong, d.dongFile])), sh.ten),
      checkListing ? "KIỂM CỘNG" : "KẾT QUẢ",
      !hasNoColumnA,
      outputShift(sh)
    );
  };

  const writeLedgerSheet = (sh: SheetPhanMem) => {
    const ws = findSheet(sh.ten)!;
    writeReconcileBlock(
      ws, sh.goc, sh.hIdx, sh.rong,
      sh.laPhu ? `${CHU_THICH_PM} — (SHEET PHỤ / TẬP CON: KHÔNG cộng vào tổng)` : CHU_THICH_PM,
      HEADER_PM,
      sh.dong.map((d) => ({
        dongFile: d.dongFile,
        ketLuan: d.ketLuan,
        nen: d.trangThai === "CO" ? NEN.xanh : NEN.do,
        them: addLedgerRow(d),
      })),
      editsBySheet(edits, new Map(sh.dong.map((d) => [d.soDong, d.dongFile])), sh.ten),
      "KẾT QUẢ",
      true,
      outputShift(sh)
    );
  };

  for (const sh of kq.sheetsHoaDon) writeInvoiceSheet(sh);
  if (kq.sheetPhanMem) writeLedgerSheet(kq.sheetPhanMem);
  for (const p of kq.sheetsPhanMemPhu) writeLedgerSheet(p);

  // --- B3. Sheet phụ trợ: KẾT LUẬN CHUNG (+ danh sách có dữ liệu) lên ĐẦU, nhật ký sửa xuống cuối ---
  if (kq.nhatKySua.length) {
    const ten = "NHẬT KÝ SỬA";
    const prev = findSheet(ten);
    if (prev) wb.removeWorksheet(prev.id);
    const nk = wb.addWorksheet(ten);
    nk.addRow(["NHẬT KÝ SỬA — do người dùng xác nhận, giữ lại giá trị cũ"]);
    nk.addRow(["Vị trí", "Giá trị cũ", "Giá trị mới"]);
    nk.getRow(2).font = { bold: true };
    nk.getRow(2).fill = to(NEN.tieuDe);
    for (const n of kq.nhatKySua) nk.addRow([n.viTri, n.cu, n.moi]);
    nk.columns.forEach((c, i) => (c.width = i === 0 ? 54 : 22));
    (nk as unknown as { orderNo: number }).orderNo = 99;
  }
  themSheetTongHop(wb, kq, (sh, c) => outputColumn(sh, c));

  // Công thức trong file đã bị dịch cột ⇒ ép Excel tính lại lúc mở, đừng tin
  // giá trị cache của lần lưu trước.
  wb.calcProperties.fullCalcOnLoad = true;

  downloadFile(await wb.xlsx.writeBuffer(), tenFile);
}
