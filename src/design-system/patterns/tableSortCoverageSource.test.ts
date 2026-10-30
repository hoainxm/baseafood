import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

/*
 * Canh QUY TẮC 19 (CLAUDE.md · README § Sắp xếp cột): mọi bảng nghiệp vụ bấm tên cột để sắp.
 * `SummaryTable` / `RecordTable` / `CatalogCrud` tự có (mặc định bật). Bảng TỰ DỰNG ở features
 * (`<table>` / `<Table>`) phải dùng `useTableSort`, hoặc nằm trong danh sách MIỄN kèm lý do.
 * Bảng mới quên sắp xếp ⇒ test đỏ.
 */
const ROOT = new URL("../../", import.meta.url).pathname; // src/

/** Miễn sắp — mỗi dòng phải nói rõ vì sao. Thêm vào đây là quyết định có chủ đích. */
const EXEMPT: Record<string, string> = {
  "features/shared/BlankSlipPrint.tsx": "bản in phiếu trắng A4",
  "features/production-orders/OrderPrint.tsx": "bản in lệnh sản xuất A4 — thứ tự dòng như mẫu QTI-KH-01-04",
  "features/imports/DailyImportInvoice.tsx": "bản in phiếu nhập trong ngày — thứ tự như tờ phiếu giấy",
  "features/balancing/BalancingTable.tsx": "bản in A4 bảng cân đối — thứ tự 3 khối cố định",
  "features/reports/WarehouseNxtScreen.tsx": "bảng tự dựng chỉ là bản in A4 + dòng tổng của lưới; bảng xem là SummaryTable (tự sắp)",
  "features/imports/OcrReviewPanel.tsx": "nháp OCR chưa lưu — đối chiếu ô trên phiếu ↔ ô điền, thứ tự theo phiếu",
  "features/production/ProductionLinesTable.tsx": "dòng phiếu đang gõ (nhập liệu) — sắp làm dòng nhảy khi đang gõ",
  "features/imports/BulkTypeChange.tsx": "bảng chọn dòng trong hộp thoại đổi loại",
  "features/balancing/gridDialogs.tsx": "bảng chọn dòng trong hộp thoại",
  "features/balancing/EditImportTripsDialog.tsx": "bảng chuyến trong hộp thoại sửa",
  "features/balancing/DepositTargetDialog.tsx": "bảng lô trong hộp chọn chỗ gửi",
  "features/balancing/TripPriceList.tsx": "bảng tóm tắt nhỏ trong ô chuyến",
  "features/monthly-stock/MonthlyStockScreen.tsx": "bảng tự dựng là hộp xem trước nạp Excel / đối chiếu dồn kỳ; sổ chính là SummaryTable (tự sắp)",
  "features/production/WipProductionScreen.tsx": "bảng tóm tắt nhỏ (bột tẩm · báo cáo theo người thao tác)",
  "features/reconciliation/ReconciliationModeView.tsx": "bảng tóm tắt nhỏ 'phần lệch do…' (vài dòng)",
  "features/admin/AdminHomeScreen.tsx": "bảng tóm tắt vài vai trò",
  "features/admin/RolePermissionsScreen.tsx": "ma trận phân quyền — thứ tự màn theo cây điều hướng",
  "features/import-planning/SampleChecks.tsx": "bảng kiểm mẫu theo khuôn báo cáo của kho — hàng là chỉ số, cột là mẫu, thứ tự như tờ báo cáo (sắp theo cột vô nghĩa)",
};

function listTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listTsx(path);
    return path.endsWith(".tsx") && !path.endsWith(".test.tsx") ? [path] : [];
  });
}

const HAS_OWN_TABLE = /<table[\s>]|<Table[\s>]/;
const USES_SORT = /useTableSort\(/;

describe("quy tắc 19 — bảng nghiệp vụ sắp được theo cột", () => {
  const files = listTsx(join(ROOT, "features")).map((p) => ({ rel: relative(ROOT, p), src: readFileSync(p, "utf8") }));
  const ownTables = files.filter((f) => HAS_OWN_TABLE.test(f.src));

  test("mọi bảng tự dựng dùng useTableSort hoặc có lý do miễn", () => {
    const missing = ownTables.filter((f) => !USES_SORT.test(f.src) && !EXEMPT[f.rel]).map((f) => f.rel);
    expect(missing).toEqual([]);
  });

  test("danh sách miễn không còn mục thừa (file đã xoá / đã có sắp / hết bảng tự dựng)", () => {
    const stale = Object.keys(EXEMPT).filter((rel) => {
      const f = files.find((x) => x.rel === rel);
      return !f || !HAS_OWN_TABLE.test(f.src) || USES_SORT.test(f.src);
    });
    expect(stale).toEqual([]);
  });

  test("không bảng chung nào bị tắt sắp mà không ghi lý do ngay trên dòng", () => {
    const offs = files.flatMap((f) =>
      f.src
        .split("\n")
        .map((line, i) => ({ line, prev: f.src.split("\n")[i - 1] ?? "", at: `${f.rel}:${i + 1}` }))
        .filter((x) => /\bsortable=\{false\}/.test(x.line) && !/\/\/|\{\/\*/.test(x.prev + x.line))
        .map((x) => x.at)
    );
    expect(offs).toEqual([]);
  });
});
