/**
 * Hai việc soát nằm NGOÀI chiều "hóa đơn ⇄ sổ kế toán" của `einvoiceReconciliation.ts`.
 *
 * 1. **So HAI BẢN hóa đơn điện tử với nhau** (`compareTwoInvoiceVersions`). Cơ quan thuế gửi một
 *    bảng kê, kế toán tự tải một bảng kê từ cổng hóa đơn điện tử — lẽ ra y hệt nhau,
 *    thực tế lệch. Thuế bắt kiểm tra lại thì phải chỉ ra ĐÍCH DANH hóa đơn nào chỉ
 *    có một bên, hóa đơn nào có cả hai mà số tiền khác nhau.
 *
 * 2. **Gom hóa đơn cùng MST người bán + cùng ngày** (`groupSameTaxCodeSameDay`). Một nhà
 *    cung cấp xuất nhiều hóa đơn trong cùng một ngày thì hoặc là tách đơn thật, hoặc
 *    là hạch toán trùng. Máy không đoán thay được, chỉ lọc ra cho người soát.
 *
 * Cả hai đều là hàm THUẦN trên `InvoiceSheet[]` đã parse — không đọc file, không đụng
 * engine đối soát, nên bật/tắt không ảnh hưởng các phép tự kiểm đã verify.
 */
import type { InvoiceRow, InvoiceSheet } from "./einvoiceReconciliation";
import { normalizeText as chuan } from "./reconciliationCommon";

export { columnIndexToLetter } from "./reconciliationCommon";

/** Sheet thuộc bản CƠ QUAN THUẾ gửi: tên sheet có chữ "thuế". */
export const isTaxSide = (tenSheet: string): boolean => chuan(tenSheet).includes("thue");

/** Tên sheet đánh dấu bản KẾ TOÁN TỰ TẢI: có chữ "tải" đứng riêng (VD "HDDT-CTY TẢI", "TỰ TẢI"). */
export const isDownloadSide = (tenSheet: string): boolean => /(^|[^a-z0-9])tai([^a-z0-9]|$)/.test(chuan(tenSheet));

/** Cách máy chia hai bên — để màn hình nói rõ vì sao sheet nằm bên nào. */
export type SideSplitMethod = "manual" | "tax-name" | "download-name" | "unknown";

/**
 * Chia các sheet hóa đơn thành bên THUẾ GỬI / bên TỰ TẢI.
 *
 * Thứ tự ưu tiên:
 * 1. `chiDinh` — người dùng tự chọn trên màn (lưu theo bản đối soát).
 * 2. Tên sheet có chữ "thuế" ⇒ bên thuế, còn lại là bản tự tải.
 * 3. Không sheet nào có "thuế" nhưng có sheet mang chữ "tải" ⇒ sheet "tải" là bản tự
 *    tải, còn lại là bên thuế. File thật hay đặt `HDDT` / `MTT` (thuế gửi) cạnh
 *    `HDDT-CTY TẢI` — chỉ dò chữ "thuế" thì không nhận ra hai bản (memory 2026-09-21).
 * 4. Không nhận ra ⇒ tập rỗng (không so hai bản được, màn hình mời người dùng chọn).
 */
export function resolveTaxSideSheets(
  tenSheets: readonly string[],
  specified?: readonly string[] | null
): { taxSide: Set<string>; method: SideSplitMethod } {
  if (specified) {
    const sheetSet = new Set(tenSheets);
    return { taxSide: new Set(specified.filter((t) => sheetSet.has(t))), method: "manual" };
  }
  const taxSheets = tenSheets.filter(isTaxSide);
  if (taxSheets.length) return { taxSide: new Set(taxSheets), method: "tax-name" };
  const downloadSheets = tenSheets.filter(isDownloadSide);
  if (downloadSheets.length && downloadSheets.length < tenSheets.length)
    return { taxSide: new Set(tenSheets.filter((t) => !isDownloadSide(t))), method: "download-name" };
  return { taxSide: new Set(), method: "unknown" };
}

// ---------- 1. So hai bản hóa đơn điện tử ----------

export type VersionPresence = "BOTH" | "SENT_ONLY" | "DOWNLOADED_ONLY";

export interface TwoVersionRow {
  key: string;
  series: string;
  invoiceNumber: string;
  issueDate: string;
  sellerTaxCode: string;
  sellerName: string;
  ben: VersionPresence;
  /** Số tiền bên bản THUẾ gửi (null = bản thuế không có hóa đơn này). */
  preTaxSent: number | null;
  taxSent: number | null;
  totalSent: number | null;
  /** Số tiền bên bản TỰ TẢI. */
  preTaxDownloaded: number | null;
  taxDownloaded: number | null;
  totalDownloaded: number | null;
  /** Chênh = bản thuế − bản tự tải (null nếu một bên không có). */
  preTaxDiff: number | null;
  taxDiff: number | null;
  totalDiff: number | null;
  /** Có cả hai bên nhưng số tiền lệch quá ngưỡng. */
  amountMismatch: boolean;
  /** Một trong hai bên nằm ở dòng lệch bố cục ⇒ số tiền không đem so được. */
  amountUncomparable: boolean;
  sentLocation: string;
  downloadedLocation: string;
  note: string;
}

export interface TwoVersionResult {
  sentSheets: string[];
  downloadedSheets: string[];
  rows: TwoVersionRow[];
  totals: {
    sentCount: number;
    downloadedCount: number;
    bothCount: number;
    sentOnlyCount: number;
    downloadedOnlyCount: number;
    amountMismatchCount: number;
    uncomparableCount: number;
    sentAmount: number;
    downloadedAmount: number;
    sentOnlyAmount: number;
    downloadedOnlyAmount: number;
    totalAmountDiff: number;
  };
}

const locationOf = (d: InvoiceRow): string => `${d.sheet} dòng ${d.fileRow}`;

/**
 * So bản THUẾ gửi với bản TỰ TẢI. Trả `null` nếu file không có đủ hai bên
 * (⇒ nơi gọi biết là không áp dụng chế độ này).
 *
 * Gộp TẤT CẢ sheet của mỗi bên rồi so theo khóa `MST | ký hiệu | số HĐ chuẩn` —
 * khỏi phải ghép đôi sheet theo tên (bản thuế hay gộp "có mã + không mã" vào một
 * sheet trong khi bản tự tải tách ra, ghép đôi theo tên là gãy).
 */
export function compareTwoInvoiceVersions(
  sheets: readonly InvoiceSheet[],
  threshold = 1,
  taxSides: ReadonlySet<string> = resolveTaxSideSheets(sheets.map((s) => s.name)).taxSide
): TwoVersionResult | null {
  const benT = sheets.filter((s) => taxSides.has(s.name));
  const benX = sheets.filter((s) => !taxSides.has(s.name));
  if (!benT.length || !benX.length) return null;

  /** Gộp theo khóa: một khóa có thể xuất hiện nhiều dòng (hóa đơn bị kê hai lần). */
  const groupInvoices = (items: readonly InvoiceSheet[]) => {
    const m = new Map<string, InvoiceRow[]>();
    for (const sh of items)
      for (const d of sh.rows) {
        const a = m.get(d.key);
        if (a) a.push(d);
        else m.set(d.key, [d]);
      }
    return m;
  };
  const mT = groupInvoices(benT);
  const mX = groupInvoices(benX);

  const sum = (items: InvoiceRow[] | undefined, take: (d: InvoiceRow) => number) =>
    items?.length ? items.reduce((s, d) => s + take(d), 0) : null;

  const row: TwoVersionRow[] = [];
  for (const key of new Set([...mT.keys(), ...mX.keys()])) {
    const t = mT.get(key);
    const x = mX.get(key);
    const sample = (t ?? x)![0]!;
    const taxSideTotal = sum(t, (d) => d.totalVnd);
    const downloadSideTotal = sum(x, (d) => d.totalVnd);
    const totalDiff = taxSideTotal != null && downloadSideTotal != null ? taxSideTotal - downloadSideTotal : null;
    const ben: VersionPresence = t && x ? "BOTH" : t ? "SENT_ONLY" : "DOWNLOADED_ONLY";
    // Dòng lệch bố cục thì cột tiền đọc sai chỗ — so tiền là kết luận bừa.
    const isAmountIncomparable =
      ben === "BOTH" && [...(t ?? []), ...(x ?? [])].some((d) => d.layoutMismatch);
    const hasAmountMismatch = !isAmountIncomparable && totalDiff != null && Math.abs(totalDiff) > threshold;
    row.push({
      key,
      series: sample.series,
      invoiceNumber: sample.invoiceNumber,
      issueDate: sample.issueDate,
      sellerTaxCode: sample.sellerTaxCode,
      sellerName: sample.sellerName,
      ben,
      preTaxSent: sum(t, (d) => d.preTaxVnd),
      taxSent: sum(t, (d) => d.taxVnd),
      totalSent: taxSideTotal,
      preTaxDownloaded: sum(x, (d) => d.preTaxVnd),
      taxDownloaded: sum(x, (d) => d.taxVnd),
      totalDownloaded: downloadSideTotal,
      preTaxDiff:
        t && x ? sum(t, (d) => d.preTaxVnd)! - sum(x, (d) => d.preTaxVnd)! : null,
      taxDiff: t && x ? sum(t, (d) => d.taxVnd)! - sum(x, (d) => d.taxVnd)! : null,
      totalDiff,
      amountMismatch: hasAmountMismatch,
      amountUncomparable: isAmountIncomparable,
      sentLocation: t?.map(locationOf).join("; ") ?? "",
      downloadedLocation: x?.map(locationOf).join("; ") ?? "",
      note: isAmountIncomparable
        ? "Có ở cả hai bản. KHÔNG so được số tiền: dòng bên bản tự tải nằm ở bố cục cột khác (sheet bị dán hai bản xuất vào làm một) nên cột tiền lệch ô. Tách sheet ra rồi chạy lại mới so được."
        : ben === "SENT_ONLY"
          ? "CHỈ có ở bản cơ quan thuế gửi — bản tự tải THIẾU hóa đơn này. Tải lại từ cổng hóa đơn điện tử rồi kê bổ sung."
          : ben === "DOWNLOADED_ONLY"
            ? "CHỈ có ở bản tự tải — bản thuế gửi KHÔNG có. Kiểm tra lại: có thể tải nhầm kỳ, hoặc hóa đơn chưa lên hệ thống thuế."
            : hasAmountMismatch
              ? `Có ở cả hai bản nhưng SỐ TIỀN LỆCH ${Math.round(totalDiff ?? 0).toLocaleString("vi-VN")} đ (thuế − tự tải). Đây là chỗ thuế bắt kiểm tra.`
              : (t?.length ?? 0) > 1 || (x?.length ?? 0) > 1
                ? "Khớp tiền, nhưng hóa đơn này xuất hiện NHIỀU DÒNG — xem cột vị trí, coi chừng kê hai lần."
                : "Khớp cả hai bản.",
    });
  }

  // Thiếu ở bản tự tải xếp lên trước — đó là việc phải đi làm ngay.
  const priority: Record<VersionPresence, number> = { SENT_ONLY: 0, DOWNLOADED_ONLY: 1, BOTH: 2 };
  row.sort(
    (a, b) =>
      priority[a.ben] - priority[b.ben] ||
      Number(b.amountMismatch) - Number(a.amountMismatch) ||
      Math.abs(b.totalDiff ?? 0) - Math.abs(a.totalDiff ?? 0) ||
      (b.totalSent ?? b.totalDownloaded ?? 0) - (a.totalSent ?? a.totalDownloaded ?? 0)
  );

  const rowsOfSide = (b: VersionPresence) => row.filter((d) => d.ben === b);
  const sumAmount = (items: TwoVersionRow[], take: (d: TwoVersionRow) => number | null) =>
    items.reduce((s, d) => s + (take(d) ?? 0), 0);

  return {
    sentSheets: benT.map((s) => s.name),
    downloadedSheets: benX.map((s) => s.name),
    rows: row,
    totals: {
      sentCount: benT.reduce((s, sh) => s + sh.rows.length, 0),
      downloadedCount: benX.reduce((s, sh) => s + sh.rows.length, 0),
      bothCount: rowsOfSide("BOTH").length,
      sentOnlyCount: rowsOfSide("SENT_ONLY").length,
      downloadedOnlyCount: rowsOfSide("DOWNLOADED_ONLY").length,
      amountMismatchCount: row.filter((d) => d.amountMismatch).length,
      uncomparableCount: row.filter((d) => d.amountUncomparable).length,
      sentAmount: sumAmount(row, (d) => d.totalSent),
      downloadedAmount: sumAmount(row, (d) => d.totalDownloaded),
      sentOnlyAmount: sumAmount(rowsOfSide("SENT_ONLY"), (d) => d.totalSent),
      downloadedOnlyAmount: sumAmount(rowsOfSide("DOWNLOADED_ONLY"), (d) => d.totalDownloaded),
      totalAmountDiff: sumAmount(row, (d) => d.totalSent) - sumAmount(row, (d) => d.totalDownloaded),
    },
  };
}

// ---------- 2. Hóa đơn cùng MST người bán + cùng ngày ----------

export interface SameDayRow {
  sheet: string;
  fileRow: number;
  series: string;
  invoiceNumber: string;
  totalVnd: number;
  conclusion: string;
}

export interface SameDayGroup {
  sellerTaxCode: string;
  sellerName: string;
  date: string;
  invoiceCount: number;
  totalAmount: number;
  /** Trong nhóm có ≥2 hóa đơn TRÙNG KHÍT số tiền — dấu hiệu nghi trùng mạnh nhất. */
  sameAmount: boolean;
  /** Mô tả các cụm trùng tiền, VD "2 hóa đơn cùng 1.200.000 đ". */
  duplicateNote: string;
  rows: SameDayRow[];
}

/**
 * Gom hóa đơn theo **MST người bán + ngày lập**, chỉ giữ nhóm từ 2 hóa đơn trở lên.
 *
 * Nhiều hóa đơn cùng nhà cung cấp trong một ngày là chuyện bình thường (xăng dầu,
 * siêu thị…), nên KHÔNG kết luận là sai. Việc của hàm này là lọc ra để người soát
 * nhìn, và đánh dấu riêng nhóm có hóa đơn **trùng khít số tiền** — chỗ dễ kê hai lần nhất.
 */
export function groupSameTaxCodeSameDay(
  sheets: readonly InvoiceSheet[],
  taxSides: ReadonlySet<string> = resolveTaxSideSheets(sheets.map((s) => s.name)).taxSide
): SameDayGroup[] {
  const m = new Map<string, { taxCode: string; name: string; date: string; items: InvoiceRow[] }>();
  // File có HAI BẢN (thuế gửi + tự tải) thì mỗi hóa đơn hiện hai lần — một ở mỗi
  // bản. Đếm cả hai là nhóm nào cũng "trùng khít số tiền" (HDONDT 6 tháng: 1790/1923
  // nhóm), danh sách thành vô dụng. Cùng khóa mà KHÁC bên thì chỉ lấy một lần.
  const replacedSide = new Map<string, boolean>();
  for (const sh of sheets)
    for (const d of sh.rows) {
      const taxCode = chuan(d.sellerTaxCode);
      if (!taxCode || !d.issueDate) continue;
      const ben = taxSides.has(sh.name);
      const replaced = replacedSide.get(d.key);
      if (replaced !== undefined && replaced !== ben) continue;
      replacedSide.set(d.key, ben);
      const k = `${taxCode}#${d.issueDate}`;
      const o = m.get(k);
      if (o) o.items.push(d);
      else m.set(k, { taxCode: d.sellerTaxCode, name: d.sellerName, date: d.issueDate, items: [d] });
    }

  const result: SameDayGroup[] = [];
  for (const { taxCode, name, date, items } of m.values()) {
    if (items.length < 2) continue;
    // cụm trùng khít số tiền trong cùng nhóm
    const byAmount = new Map<number, number>();
    for (const d of items) byAmount.set(d.totalVnd, (byAmount.get(d.totalVnd) ?? 0) + 1);
    const duplicateAmounts = [...byAmount].filter(([, n]) => n > 1);
    result.push({
      sellerTaxCode: taxCode,
      sellerName: name,
      date,
      invoiceCount: items.length,
      totalAmount: items.reduce((s, d) => s + d.totalVnd, 0),
      sameAmount: duplicateAmounts.length > 0,
      duplicateNote: duplicateAmounts
        .map(([amount, n]) => `${n} hóa đơn cùng ${Math.round(amount).toLocaleString("vi-VN")} đ`)
        .join("; "),
      rows: items.map((d) => ({
        sheet: d.sheet,
        fileRow: d.fileRow,
        series: d.series,
        invoiceNumber: d.invoiceNumber,
        totalVnd: d.totalVnd,
        conclusion: d.conclusion,
      })),
    });
  }

  // Nghi trùng tiền lên đầu, rồi tới nhóm đông hóa đơn / nhiều tiền.
  return result.sort(
    (a, b) =>
      Number(b.sameAmount) - Number(a.sameAmount) ||
      b.invoiceCount - a.invoiceCount ||
      b.totalAmount - a.totalAmount
  );
}
