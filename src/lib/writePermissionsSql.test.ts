// Phân quyền Đợt 6 (lớp 4): máy chủ chốt ghi bằng trigger ở migration 0065+, dựa trên
// CÙNG ma trận + luật bảng với app (lib/permissions.ts, lib/writePermissions.ts). Test
// này đọc file migration và bắt lệch code ⇄ SQL — đổi ma trận / thêm bảng / đổi luật ở
// code mà quên viết migration mới ⇒ đỏ.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeRole } from "@/types";
import { DEFAULT_ROLE_PERMISSIONS } from "./permissions";
import { TABLE_WRITE_RULES, type RowChange } from "./writePermissions";

const MIGRATIONS_DIR = join(__dirname, "../../supabase/migrations");
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
/** Migration MỚI NHẤT chứa một đoạn — bản đang có hiệu lực của đoạn đó. */
const latestWith = (marker: string) => {
  const f = [...files].reverse().find((x) => readFileSync(join(MIGRATIONS_DIR, x), "utf8").includes(marker));
  if (!f) throw new Error(`Không thấy migration nào có: ${marker}`);
  return readFileSync(join(MIGRATIONS_DIR, f), "utf8");
};
/** Bảng hệ thống đã có RLS chỉ-admin ⇒ không gắn trigger. */
const SYSTEM_TABLES = new Set(["user_profiles", "app_roles", "role_permissions", "user_permissions"]);

describe("máy chủ ⇄ app: cùng ma trận, cùng bảng, cùng luật", () => {
  it("default_role_permissions trong migration = DEFAULT_ROLE_PERMISSIONS", () => {
    const sql = latestWith("insert into public.default_role_permissions");
    const block = sql.slice(sql.indexOf("insert into public.default_role_permissions"));
    const values = block.slice(0, block.indexOf(";"));
    // Slug vai trò trong SQL đi qua `normalizeRole`: migration đổi khóa sau lần chèn ma trận cuối (0087:
    // manager-dong → frozen-workshop-manager…) đổi `role_id` bằng UPDATE, không chèn lại ma trận.
    const fromSql = [...values.matchAll(/\('([^']+)', '([^']+)', '([^']+)', '([^']+)'\)/g)]
      .map((m) => [normalizeRole(m[1]), m[2], m[3], m[4]].join("|"))
      .sort();
    const fromCode = Object.entries(DEFAULT_ROLE_PERMISSIONS)
      .flatMap(([role, grants]) => grants.map((g) => [role, g.resource, g.action, g.scope].join("|")))
      .sort();
    expect(fromSql).toEqual(fromCode);
  });

  it("trigger gắn ĐÚNG các bảng có luật ghi (trừ bảng hệ thống chỉ-admin)", () => {
    const sql = latestWith("_enforce_permission");
    const arr = sql.slice(sql.indexOf("v_tables text[] := array["), sql.indexOf("];", sql.indexOf("v_tables text[] := array[")));
    const fromSql = [...arr.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    const fromCode = Object.entries(TABLE_WRITE_RULES)
      .filter(([t, rule]) => rule && !SYSTEM_TABLES.has(t))
      .map(([t]) => t)
      .sort();
    expect(fromSql).toEqual(fromCode);
  });

  it("luật từng bảng trong SQL nhắc ĐÚNG các tài nguyên như luật ở app", () => {
    const sql = latestWith("function public.required_write_permissions");
    const body = sql.slice(sql.indexOf("function public.required_write_permissions"), sql.indexOf("$$;", sql.indexOf("function public.required_write_permissions")));
    const samples: RowChange[] = [
      { kind: "create", next: { isLocked: true } },
      { kind: "update", prev: { isLocked: true }, next: { isLocked: false } },
      { kind: "update", prev: { status: "pending" }, next: { status: "stocked" } },
      { kind: "update", prev: {}, next: { a: 1 } },
      { kind: "delete", prev: {} },
    ];
    for (const [table, rule] of Object.entries(TABLE_WRITE_RULES)) {
      if (!rule || SYSTEM_TABLES.has(table)) continue;
      const start = body.indexOf(`when '${table}' then`);
      expect(start, `thiếu nhánh SQL cho ${table}`).toBeGreaterThan(-1);
      const next = body.slice(start + 1).search(/\n {4}when '/);
      const branch = body.slice(start, next < 0 ? undefined : start + 1 + next);
      const sqlResources = new Set([...branch.matchAll(/\('([a-z.-]+)',/g)].map((m) => m[1]));
      const codeResources = new Set(samples.flatMap((c) => rule(c).map(([r]) => r)));
      expect([...sqlResources].sort(), table).toEqual([...codeResources].sort());
    }
  });

  it("chuẩn hoá vai trò cũ ở SQL khớp LEGACY_ROLE_MAP (src/types.ts)", () => {
    const types = readFileSync(join(__dirname, "../types.ts"), "utf8");
    const mapSrc = types.slice(types.indexOf("const LEGACY_ROLE_MAP"), types.indexOf("};", types.indexOf("const LEGACY_ROLE_MAP")));
    const fromTs = [...mapSrc.matchAll(/"([a-z-]+)": "([a-z-]+)"/g)].map((m) => `${m[1]}>${m[2]}`).sort();
    const sql = latestWith("function public.normalize_role_slug");
    const fromSql = [...sql.matchAll(/when '([a-z-]+)' then '([a-z-]+)'/g)]
      .filter((m) => sql.indexOf(m[0]) > sql.indexOf("function public.normalize_role_slug"))
      .filter((m) => sql.indexOf(m[0]) < sql.indexOf("$$;", sql.indexOf("function public.normalize_role_slug")))
      .map((m) => `${m[1]}>${m[2]}`)
      .sort();
    expect(fromSql).toEqual(fromTs);
  });

  it("công tắc mặc định là 'log' (không chặn ai khi vừa chạy migration)", () => {
    const sql = latestWith("permission_enforcement");
    expect(sql).toMatch(/insert into public\.permission_enforcement \(id, mode\) values \(1, 'log'\)/);
  });
});
