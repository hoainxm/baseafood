import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { PAGE_GUIDES } from "./guideContent";

/*
 * Canh ba-spec 53 AC-7 (docs/app-map/53-filters.ba-spec.md §6): mọi màn / tab đã thêm bộ lọc dùng khung
 * chung (FilterBar hoặc SearchField, so khớp ở lib/recordFilters), và hộp "?" của trang có mục "Bộ lọc".
 * Ai gỡ khung lọc khỏi một màn ở đây ⇒ test đỏ.
 */
const SRC = new URL("../../", import.meta.url).pathname; // src/

const SCREENS = [
  "features/sales/SalesScreen.tsx",
  "features/sales/SalesReport.tsx",
  "features/orders/SalesOrderScreen.tsx",
  "features/production/WipProductionScreen.tsx",
  "features/packaging/PackagingScreen.tsx",
  "features/reports/NxtReportScreen.tsx",
  "features/reports/WarehouseNxtScreen.tsx",
  "features/imports/MaterialImportScreen.tsx",
  "features/imports/ImportReport.tsx",
  "features/import-planning/ImportViews.tsx",
  "features/export-planning/ContractListView.tsx",
  "features/reports/OrderExportReport.tsx",
  "features/users/UserManagementScreen.tsx",
  "features/my-tasks/MyTasksScreen.tsx",
  "features/monthly-stock/MonthlyStockScreen.tsx",
  "design-system/patterns/CatalogCrudModal.tsx",
];

const GUIDE_PAGES = ["sales", "orders", "wip", "packaging", "nxt", "nxt-warehouse", "imports", "planning-import", "planning-export", "export-report", "my-tasks", "monthly-stock", "catalog"];

describe("ba-spec 53 AC-7 — màn đã thêm lọc dùng khung chung", () => {
  test.each(SCREENS)("%s dùng FilterBar hoặc SearchField", (file) => {
    const src = readFileSync(join(SRC, file), "utf8");
    expect(/<FilterBar\b|<SearchField\b/.test(src)).toBe(true);
  });
  test("hộp \"?\" của các trang có mục Bộ lọc", () => {
    const missing = GUIDE_PAGES.filter((k) => !JSON.stringify(PAGE_GUIDES[k]?.content ?? "", (_key, v) => (typeof v === "function" ? v.name : v)).includes("FilterNote"));
    expect(missing).toEqual([]);
  });
});
