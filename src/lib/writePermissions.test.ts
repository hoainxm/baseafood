import { describe, expect, it } from "vitest";
import * as repo from "./repo";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_RESOURCES, resolvePermissions, type PermissionGrant } from "./permissions";
import { TABLE_WRITE_RULES, checkTableWrite, type RowChange } from "./writePermissions";
import type { Role } from "@/types";

const perms = (roles: string[], grants?: Record<string, PermissionGrant[]>) =>
  resolvePermissions({ roles: roles as Role[], isAdmin: false, rolePermissions: grants ?? DEFAULT_ROLE_PERMISSIONS });
const g = (resource: string, ...actions: PermissionGrant["action"][]): PermissionGrant[] =>
  actions.map((action) => ({ resource, action, scope: "all" }));

const create = (next: Record<string, unknown> = {}): RowChange => ({ kind: "create", next });
const update = (prev: Record<string, unknown>, next: Record<string, unknown>): RowChange => ({ kind: "update", prev, next });
const remove = (prev: Record<string, unknown> = {}): RowChange => ({ kind: "delete", prev });

describe("bảng → luật ghi", () => {
  it("MỌI TableMapping trong repo.ts có luật (kể cả null = không chốt có chủ đích)", () => {
    const tables = Object.values(repo)
      .filter((v): v is { table: string; localKey: string } => typeof v === "object" && v !== null && "table" in v && "localKey" in v)
      .map((m) => m.table);
    expect(tables.length).toBeGreaterThan(30);
    for (const t of tables) expect(Object.prototype.hasOwnProperty.call(TABLE_WRITE_RULES, t), t).toBe(true);
  });

  it("mọi tài nguyên trong luật có thật và có hành động đó", () => {
    const sample: RowChange[] = [create({ isLocked: true }), update({ isLocked: true }, { isLocked: false }), update({ status: "pending" }, { status: "stocked" }), create(), update({}, { a: 1 }), remove()];
    for (const [table, rule] of Object.entries(TABLE_WRITE_RULES)) {
      if (!rule) continue;
      for (const c of sample)
        for (const [r, a] of rule(c)) {
          const res = PERMISSION_RESOURCES.find((x) => x.id === r);
          expect(res, `${table} → ${r}`).toBeDefined();
          expect(res!.actions, `${table} → ${r}:${a}`).toContain(a);
        }
    }
  });
});

describe("checkTableWrite", () => {
  it("ma trận Đợt 4: bộ phận ghi được màn của mình, không ghi được màn khác; giám đốc không ghi gì", () => {
    const keeper = perms(["warehouse-keeper"]);
    expect(checkTableWrite(keeper, "import_shipments", [create()])).toBeNull();
    expect(checkTableWrite(keeper, "suppliers", [create()])).toBeNull(); // thêm nhanh đại lý
    expect(checkTableWrite(keeper, "products", [create()])?.resource).toBe("catalog.products");
    expect(checkTableWrite(keeper, "balancing_periods", [create()])?.resource).toBe("balancing");
    const director = perms(["director"]);
    for (const t of Object.keys(TABLE_WRITE_RULES).filter((t) => TABLE_WRITE_RULES[t]))
      expect(checkTableWrite(director, t, [create()]), t).not.toBeNull();
  });

  it("kế toán (người nhập liệu): ghi + chốt ngày nhập / SX được; xóa chuyến / mở lại thì không; bỏ dòng khi sửa chuyến = Sửa", () => {
    const acc = perms(["accountant"]);
    expect(checkTableWrite(acc, "import_shipments", [create()])).toBeNull();
    expect(checkTableWrite(acc, "material_imports", [create(), update({ kg: 1 }, { kg: 2 }), remove()])).toBeNull();
    expect(checkTableWrite(acc, "daily_locks", [create({ isLocked: true })])).toBeNull();
    expect(checkTableWrite(acc, "production_locks", [create({ isLocked: true })])).toBeNull();
    expect(checkTableWrite(acc, "production_wips", [create({ status: "pending" })])).toBeNull();
    expect(checkTableWrite(acc, "import_shipments", [remove()])?.action).toBe("delete");
    expect(checkTableWrite(acc, "daily_locks", [update({ isLocked: true }, { isLocked: false })])?.action).toBe("unlock");
  });

  it("admin luôn được; bảng không chốt luôn được; không có dòng đổi ⇒ được", () => {
    const admin = resolvePermissions({ roles: ["admin"], isAdmin: true });
    expect(checkTableWrite(admin, "app_roles", [create()])).toBeNull();
    expect(checkTableWrite(perms(["team-leader"]), "row_marks", [create()])).toBeNull();
    expect(checkTableWrite(perms([]), "import_shipments", [])).toBeNull();
  });

  it("người thường không ghi được bảng hệ thống (chỉ admin)", () => {
    expect(checkTableWrite(perms(["director"]), "user_profiles", [update({}, { roles: ["admin"] })])?.resource).toBe("users");
    expect(checkTableWrite(perms(["chief-accountant"]), "role_permissions", [create()])?.resource).toBe("roles");
  });

  it("bảng chốt: chuyển sang chốt cần Chốt, mở ra / xóa cần Mở lại, sửa khi vẫn chốt cần Sửa", () => {
    const lockOnly = perms(["warehouse-keeper"], { "warehouse-keeper": g("imports", "view", "lock") });
    expect(checkTableWrite(lockOnly, "daily_locks", [create({ isLocked: true })])).toBeNull();
    expect(checkTableWrite(lockOnly, "daily_locks", [update({ isLocked: true }, { isLocked: false })])?.action).toBe("unlock");
    expect(checkTableWrite(lockOnly, "daily_locks", [remove({ isLocked: true })])?.action).toBe("unlock");
    expect(checkTableWrite(lockOnly, "daily_locks", [update({ isLocked: true, note: "a" }, { isLocked: true, note: "b" })])?.action).toBe("update");
    const unlockOnly = perms(["chief-accountant"], { "chief-accountant": g("balancing", "view", "unlock") });
    expect(checkTableWrite(unlockOnly, "balancing_periods", [update({ isLocked: true }, { isLocked: false })])).toBeNull();
    expect(checkTableWrite(unlockOnly, "balancing_periods", [update({ isLocked: false }, { isLocked: true })])?.action).toBe("lock");
  });

  it("Kho dự trữ: duyệt (chờ → đã nhập) cần Duyệt; sửa sản lượng cần Sửa ở /wip / Cân đối / Kho", () => {
    const approver = perms(["warehouse-keeper"], { "warehouse-keeper": g("warehouse", "view", "approve") });
    expect(checkTableWrite(approver, "production_wips", [update({ status: "pending" }, { status: "stocked" })])).toBeNull();
    expect(checkTableWrite(approver, "production_wips", [update({ status: "pending", kg: 1 }, { status: "pending", kg: 2 })])).not.toBeNull();
    expect(checkTableWrite(approver, "production_wips", [create({ status: "pending" })])).not.toBeNull();
  });

  it("có quyền ở MỘT màn trong các màn ghi bảng là đủ (Cân đối ghi lại sổ kho tháng)", () => {
    const bal = perms(["accountant"], { accountant: g("balancing", "view", "create", "update") });
    expect(checkTableWrite(bal, "monthly_stock_ledger", [create()])).toBeNull();
    expect(checkTableWrite(bal, "monthly_stock_ledger", [remove()])?.action).toBe("delete");
  });

  it("một dòng thiếu quyền ⇒ cả lượt bị từ chối, câu báo nêu đúng việc + màn", () => {
    const p = perms(["accountant"], { accountant: g("sales", "view", "create") });
    const denial = checkTableWrite(p, "sales_items", [create(), remove()]);
    expect(denial).toMatchObject({ table: "sales_items", resource: "sales", action: "delete" });
    expect(denial?.message).toContain("xóa ở Bán hàng");
  });
});
