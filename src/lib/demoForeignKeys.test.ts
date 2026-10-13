// Chế độ demo thêm tiền tố `demo:` cho khóa chính ở ranh giới máy chủ (lib/demoMode.ts).
// Cột KHÓA NGOẠI trỏ tới khóa chính bảng nghiệp vụ khác cũng phải mang tiền tố —
// khai ở `TableMapping.cotThamChieu`. Test này quét mọi migration: thêm khóa ngoại mới
// giữa hai bảng nghiệp vụ mà quên khai ⇒ đỏ (đã lọt một lần: 2026-10-12, period_id).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as repo from "./repo";

const MIGRATIONS_DIR = join(__dirname, "../../supabase/migrations");
/** Bảng đích được phép không khai (site chung — không mang tiền tố). */
const SKIPPED_TABLES = new Set(["sites", "xi_nghiep"]);

function businessForeignKeys(): string[] {
  const ra: string[] = [];
  for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    for (const m of sql.matchAll(/references\s+(?:public\.)?([a-z_]+)\s*\(/gi)) if (!SKIPPED_TABLES.has(m[1])) ra.push(`${f}:${m[1]}`);
  }
  return ra;
}

describe("khóa ngoại giữa bảng nghiệp vụ ⇄ cotThamChieu", () => {
  it("migration chỉ có đúng 3 khóa ngoại (period_id → kỳ cân đối) — thêm mới thì khai cotThamChieu rồi sửa test này", () => {
    // 0001 tạo bằng tên cũ ky_can_doi; 0016 đổi thành balancing_periods.
    expect(businessForeignKeys()).toEqual([
      "0001_baseafood_mes.sql:ky_can_doi",
      "0001_baseafood_mes.sql:ky_can_doi",
      "0001_baseafood_mes.sql:ky_can_doi",
    ]);
  });

  it("ba bảng trỏ tới balancing_periods đã khai period_id", () => {
    for (const b of [repo.BANG_BALANCING_INPUT, repo.BANG_BALANCING_OUTPUT, repo.BANG_SCRAP]) expect(b.cotThamChieu, b.table).toEqual(["period_id"]);
  });
});
