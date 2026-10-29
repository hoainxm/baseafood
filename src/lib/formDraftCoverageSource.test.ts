import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

/*
 * Canh QUY TẮC 17 (CLAUDE.md): mọi form GHI dữ liệu phải tự lưu nháp (lib/formDraft.ts —
 * `useFormDraft` / `useDialogDraft`) để chuyển trang, tải lại, đăng xuất rồi vào lại không
 * mất số đang gõ. Quét mọi file ở features có nút Lưu (`variant="save"`): phải dùng nháp,
 * hoặc nằm trong danh sách MIỄN dưới đây kèm lý do. Màn nhập mới quên nháp ⇒ test đỏ.
 */
const ROOT = new URL("../", import.meta.url).pathname; // src/

/** Miễn nháp — mỗi dòng phải nói rõ vì sao. Thêm vào đây là quyết định có chủ đích. */
const EXEMPT: Record<string, string> = {
  "features/admin/RolePermissionsScreen.tsx": "quản trị phân quyền, không phải sổ nghiệp vụ",
  "features/users/UserManagementScreen.tsx": "quản trị tài khoản có mật khẩu — không lưu nháp xuống máy",
  "features/shared/AccountMenu.tsx": "đổi mật khẩu — KHÔNG được lưu mật khẩu xuống máy",
  "features/auth/SetOwnPasswordScreen.tsx": "đặt mật khẩu riêng sau khi admin đặt lại — KHÔNG lưu mật khẩu xuống máy",
  "features/balancing/MaterialGrid.tsx": "lưới ghi thẳng vào sổ theo từng phím; nút Lưu ở đây là ghi lại sổ kho",
  "features/balancing/gridDialogs.tsx": "hộp chọn tên dòng / dòng nhập — chọn một bước, không có số gõ dở",
  "features/balancing/DepositTargetDialog.tsx": "hộp chọn chỗ gửi một bước, mở từ dòng Gửi đông đã lưu",
  "features/imports/BulkTypeChange.tsx": "đổi loại hàng loạt — một bước xác nhận",
  "features/imports/DailyScrapSection.tsx": "phế liệu đang gõ nằm trong nháp form Nhập hàng (scrapEdit)",
  "features/reconciliation/ReconciliationScreen.tsx": "đối soát chạy trên file tải lên — file là nguồn, chạy lại được",
  "features/reports/WarehouseNxtScreen.tsx": "nạp báo cáo từ file / thêm mã một ô",
  "features/warehouse/ReserveWarehouseScreen.tsx": "xác nhận nhập kho một bước",
  "features/my-tasks/MyTasksScreen.tsx": "nút Xong đánh dấu việc một chạm; form giao việc ở AssignTaskDialog có nháp",
  "features/import-planning/ImportDossier.tsx": "nút Ghi thực nhập chỉ mở QuantityDialog (hộp có nháp ở ImportDialogs.tsx)",
  "features/import-planning/ImportViews.tsx": "nút Ghi thực nhập chỉ mở QuantityDialog (hộp có nháp ở ImportDialogs.tsx)",
};

function listTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listTsx(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("quy tắc 17 — form ghi phải tự lưu nháp", () => {
  const files = listTsx(join(ROOT, "features")).map((p) => ({ rel: relative(ROOT, p), src: readFileSync(p, "utf8") }));
  const withSave = files.filter((f) => f.src.includes('variant="save"'));

  test("mọi file có nút Lưu đều dùng nháp hoặc có lý do miễn", () => {
    const missing = withSave
      .filter((f) => !/use(Form|Dialog)Draft\(/.test(f.src) && !EXEMPT[f.rel])
      .map((f) => f.rel);
    expect(missing).toEqual([]);
  });

  test("danh sách miễn không còn mục thừa (file đã xoá / đã có nháp)", () => {
    const stale = Object.keys(EXEMPT).filter((rel) => {
      const f = files.find((x) => x.rel === rel);
      return !f || !f.src.includes('variant="save"') || /use(Form|Dialog)Draft\(/.test(f.src);
    });
    expect(stale).toEqual([]);
  });
});
