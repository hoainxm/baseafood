import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { PERMISSION_RESOURCES } from "@/lib/permissions";
import { ACTIVITY_LOG_TABLES } from "./activityLog";

/*
 * Canh ba-spec 56 (docs/app-map/56-activity-log-groups.ba-spec.md):
 *  AC-4 — mỗi nhóm trang MỘT bảng nhật ký; tài nguyên của các khu đợt 1 thuộc đúng nhóm có bảng.
 *  AC-5 — ở các màn đợt 1, chỗ nào báo "Đã lưu / Đã xóa" (notify.saved / notify.deleted) đều có ghi nhật ký ngay
 *         trước đó (trong 40 dòng) hoặc trong chính lời gọi (hàm `logged(...)`). Miễn: thêm nhanh danh mục, ánh xạ mã
 *         kế toán, ảnh phiếu / điền phiếu từ ảnh (chưa ghi sổ) — kèm lý do.
 */
const SRC = new URL("../../", import.meta.url).pathname;

const WAVE1: Record<string, readonly string[]> = {
  planning: ["features/import-planning/ImportPlanningScreen.tsx", "features/production-orders/ProductionOrderScreen.tsx", "features/production-orders/ShipmentOrders.tsx"],
  imports: ["features/imports/MaterialImportScreen.tsx", "features/imports/SupplierInvoicePanel.tsx"],
  production: ["features/production/WipProductionScreen.tsx", "features/packaging/PackagingScreen.tsx"],
};

/** Lời báo không phải thao tác trên hồ sơ — miễn, kèm lý do. */
const EXEMPT: { pattern: RegExp; reason: string }[] = [
  { pattern: /vào danh mục|Đã thêm (mặt hàng|thành phẩm|khách hàng|loại nguyên liệu|đại lý)/, reason: "thêm nhanh danh mục — /audit đã có, không thuộc hồ sơ nào" },
  { pattern: /Đã nhớ mã kế toán/, reason: "ánh xạ mã kế toán (danh mục)" },
  { pattern: /(gỡ|thay) ảnh phiếu/, reason: "gỡ / thay ảnh phiếu chỉ sửa phiếu đang mở — nhật ký ghi khi Lưu chuyến (\"· gỡ / thay ảnh phiếu\")" },
];

const LOG_CALL = /\b(logDay|logOrder|logImport|logged|logTripDays|dayLog|onLog|planningLog\.log|importsLog\.log|productionLog\.log)\(/;

describe("ba-spec 56 AC-4 — mỗi nhóm trang một bảng nhật ký", () => {
  test("không có hai nhóm dùng chung bảng, không nhóm nào hai bảng", () => {
    const tables = Object.values(ACTIVITY_LOG_TABLES);
    expect(new Set(tables).size).toBe(tables.length);
  });
  test("tài nguyên của các khu đợt 1 thuộc đúng nhóm có bảng nhật ký", () => {
    const groupOf = (id: string) => PERMISSION_RESOURCES.find((r) => r.id === id)?.group;
    const expected: Record<string, keyof typeof ACTIVITY_LOG_TABLES> = {
      "import-plans": "planning",
      "production-orders": "planning",
      "export-plans": "planning",
      imports: "imports",
      "imports.invoices": "imports",
      wip: "production",
      packaging: "production",
    };
    const wrong = Object.entries(expected).filter(([id, g]) => groupOf(id) !== g);
    expect(wrong).toEqual([]);
  });
});

describe("ba-spec 56 AC-5 — thao tác đợt 1 đều có dòng nhật ký", () => {
  const cases = Object.entries(WAVE1).flatMap(([group, files]) => files.map((f) => [group, f] as const));
  test.each(cases)("%s · %s", (_group, file) => {
    const lines = readFileSync(join(SRC, file), "utf8").split("\n");
    const missing: string[] = [];
    lines.forEach((line, i) => {
      if (!/notify\.(saved|deleted)\(/.test(line)) return;
      const call = lines.slice(i, i + 4).join(" ");
      if (EXEMPT.some((e) => e.pattern.test(call))) return;
      const window = lines.slice(Math.max(0, i - 40), i + 4).join("\n");
      if (!LOG_CALL.test(window)) missing.push(`${file}:${i + 1} ${line.trim().slice(0, 80)}`);
    });
    expect(missing).toEqual([]);
  });
});
