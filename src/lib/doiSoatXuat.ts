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
 * 1. **CHỈ THÊM, KHÔNG DỜI.** Cột đối soát nằm SAU vùng dữ liệu gốc (chừa 1 cột
 *    trống ngăn cách). Không chèn cột vào giữa ⇒ địa chỉ mọi ô gốc giữ nguyên,
 *    ô gộp không lệch, và nhất là **công thức trong file không bị sai tham chiếu**
 *    (chèn cột sẽ đẩy `=SUM(K7:K469)` sang L mà ruột công thức vẫn trỏ K).
 * 2. Chỉ ghi đè hai thứ: **màu nền dòng** (để nhìn ra khớp/lệch/thiếu) và **ô người
 *    dùng bấm Sửa**. Font, khung, canh lề, định dạng số của ô gốc giữ nguyên.
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
  HEADER_HD_THEM,
  HEADER_PM_THEM,
  cotExcel,
  ngayHienThi,
} from "./doiSoatHddt";

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
  dong: readonly { dongFile: number; nen: string; them: readonly unknown[] }[],
  cotSua: readonly { dongFile: number; cot: number; giaTri: number }[]
): void {
  const cot1 = goc.c0 + rong + COT_NGAN + 1; // 1-based, cột đầu của khối thêm
  const hangTieuDe = goc.r0 + hIdx + 1;

  // --- tiêu đề khối thêm: lấy dáng từ chính tiêu đề gốc để nhìn liền mạch ---
  const mauTieuDe = ws.getCell(hangTieuDe, Math.max(1, goc.c0 + 1));
  headerThem.forEach((ten, i) => {
    const o = ws.getCell(hangTieuDe, cot1 + i);
    o.value = ten;
    if (mauTieuDe.font) o.font = { ...mauTieuDe.font, bold: true };
    if (mauTieuDe.border) o.border = { ...mauTieuDe.border };
    o.alignment = { ...(mauTieuDe.alignment ?? {}), vertical: "middle", wrapText: true };
    o.fill = to(NEN.tieuDe);
    const c = ws.getColumn(cot1 + i);
    if (!c.width) c.width = Math.min(Math.max(ten.length + 2, 12), 42);
  });

  // --- chú thích màu: đặt ngay trên tiêu đề, chỉ khi có chỗ trống ---
  if (hangTieuDe > 1) {
    const oCt = ws.getCell(hangTieuDe - 1, cot1);
    if (oCt.value == null || oCt.value === "") oCt.value = chuThich;
  }

  // --- từng dòng: giá trị khối thêm + tô nền cả dòng ---
  const cotCuoi = cot1 + headerThem.length - 1;
  for (const d of dong) {
    d.them.forEach((v, i) => {
      ws.getCell(d.dongFile, cot1 + i).value = oXuat(v);
    });
    const nen = to(d.nen);
    for (let c = Math.max(1, goc.c0 + 1); c <= cotCuoi; c++) ws.getCell(d.dongFile, c).fill = nen;
  }

  // --- ô người dùng đã bấm Sửa: ghi đè giá trị + đánh dấu vàng để soát lại ---
  for (const e of cotSua) {
    const o = ws.getCell(e.dongFile, cotExcel(goc, e.cot) + 1);
    o.value = e.giaTri;
    o.fill = to(NEN.sua);
  }

  // Bộ lọc: NỚI vùng lọc sẵn có sang hết khối mới (để lọc được cột "KẾT QUẢ"),
  // giữ nguyên ô bắt đầu. Sheet chưa có lọc thì đặt mới trên đúng khối thêm.
  const loc = ws.autoFilter as string | { from?: { row?: number; column?: number } } | undefined;
  const batDau =
    typeof loc === "object" && loc?.from?.row != null && loc.from.column != null
      ? { row: loc.from.row, column: loc.from.column }
      : typeof loc === "string" && /^[A-Z]+\d+:/.test(loc)
        ? null // dạng chuỗi "A6:S469": nới bằng cách giữ đúng ô đầu của chuỗi
        : { row: hangTieuDe, column: cot1 };
  ws.autoFilter =
    batDau != null
      ? { from: batDau, to: { row: hangTieuDe, column: cotCuoi } }
      : { from: (loc as string).split(":")[0]!, to: { row: hangTieuDe, column: cotCuoi } };
}

const nenHd = (d: DongHoaDon) => (d.trangThai === "KHOP" ? NEN.xanh : d.trangThai === "LECH" ? NEN.vang : NEN.do);

const themHd = (d: DongHoaDon): unknown[] => [
  d.ketLuan, d.tyGia, d.soChuan, d.khoa, d.chuaThueVnd, d.thueVnd, d.tongTtVnd,
  d.soDongKhopPm, d.tongTtPm, d.chenh, d.phieuKe, d.ctgs, d.ngayGhiSo, d.tkNoCo,
  d.dienGiaiPm, d.soTienHachToan, d.bangChung,
];

const themPm = (d: DongPhanMem): unknown[] => [
  d.ketLuan, d.soChuan, d.khoa, d.soHddtKhop, d.nguonHddt, d.dongHddt, d.ngayLapHd,
  d.tenBanHddt, d.tongTtHddt, d.bangChung,
];

/** "KẾT QUẢ" dẫn đầu khối thêm — nhãn đọc trước, phần chi tiết theo sau. */
const HEADER_HD = ["KẾT QUẢ", ...HEADER_HD_THEM.filter((h) => h !== "KẾT LUẬN")] as const;
const HEADER_PM = ["KẾT QUẢ", ...HEADER_PM_THEM.filter((h) => h !== "KẾT LUẬN")] as const;

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

function base64SangBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
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
  await wb.xlsx.load(base64SangBytes(fileGocB64).buffer as ArrayBuffer);

  const timSheet = (ten: string): Worksheet | undefined =>
    wb.worksheets.find((w) => w.name === ten) ?? wb.getWorksheet(ten);

  const thieu: string[] = [];

  const ghiHd = (sh: SheetHoaDon) => {
    const ws = timSheet(sh.ten);
    if (!ws) return void thieu.push(sh.ten);
    ghiKhoiDoiSoat(
      ws, sh.goc, sh.hIdx, sh.rong,
      sh.laPhu ? `${CHU_THICH} — (SHEET TRÙNG LẶP / TẬP CON: KHÔNG cộng vào tổng)` : CHU_THICH,
      HEADER_HD,
      sh.dong.map((d) => ({ dongFile: d.dongFile, nen: nenHd(d), them: themHd(d) })),
      suaTheoSheet(edits, new Map(sh.dong.map((d) => [d.soDong, d.dongFile])), sh.ten)
    );
  };

  const ghiPm = (sh: SheetPhanMem) => {
    const ws = timSheet(sh.ten);
    if (!ws) return void thieu.push(sh.ten);
    ghiKhoiDoiSoat(
      ws, sh.goc, sh.hIdx, sh.rong,
      sh.laPhu ? `${CHU_THICH_PM} — (SHEET PHỤ / TẬP CON: KHÔNG cộng vào tổng)` : CHU_THICH_PM,
      HEADER_PM,
      sh.dong.map((d) => ({
        dongFile: d.dongFile,
        nen: d.trangThai === "CO" ? NEN.xanh : NEN.do,
        them: themPm(d),
      })),
      suaTheoSheet(edits, new Map(sh.dong.map((d) => [d.soDong, d.dongFile])), sh.ten)
    );
  };

  for (const sh of kq.sheetsHoaDon) ghiHd(sh);
  if (kq.sheetPhanMem) ghiPm(kq.sheetPhanMem);
  for (const p of kq.sheetsPhanMemPhu) ghiPm(p);

  if (thieu.length)
    throw new Error(`Không tìm thấy sheet ${thieu.map((t) => `"${t}"`).join(", ")} trong file gốc.`);

  // Sheet phụ trợ: THÊM ở cuối, không đụng sheet gốc.
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
  }

  taiVe(await wb.xlsx.writeBuffer(), tenFile);
}
