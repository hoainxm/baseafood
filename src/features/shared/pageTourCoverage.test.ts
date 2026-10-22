import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import type { PageTourSpec } from "@/lib/guidedTour";
import { PAGE_GUIDES } from "./guideContent";

/*
 * Canh QUY TẮC 18 (CLAUDE.md) — ba-spec 43 v4 R13–R16: MỌI trang nghiệp vụ có route phải có
 * (1) "Hướng dẫn thao tác" (tour từng bước — file `<trang>Tour.ts` export `tourSpec`, màn gọi
 * `usePageTour`) và (2) hộp "Hướng dẫn: <trang>" (PAGE_GUIDES). Trang mới quên ⇒ test đỏ, trừ khi
 * nằm trong danh sách MIỄN kèm lý do. Lời tour sai văn phong / mốc `data-tour` không có trên trang
 * ⇒ đỏ.
 */
const SRC = new URL("../../", import.meta.url).pathname; // src/

/** Trang có route nhưng KHÔNG cần tour — mỗi dòng phải nói rõ vì sao. */
const PAGE_TOUR_EXEMPT: Record<string, string> = {
  users: "quản trị tài khoản — chỉ admin, không phải trang nghiệp vụ",
  admin: "trang quản trị — chỉ admin",
  roles: "quản trị vai trò & quyền — chỉ admin",
  audit: "nhật ký thao tác — trang tra cứu của quản trị",
  kit: "trang mẫu giao diện cho người phát triển",
};

function listFiles(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listFiles(path, ext);
    return ext.test(path) ? [path] : [];
  });
}

/** Đoạn đầu đường dẫn của mọi route trang (bỏ route chuyển hướng `<Navigate>` một dòng, route có tham số). */
function routeSegments(): string[] {
  const app = readFileSync(join(SRC, "App.tsx"), "utf8");
  const segs = new Set<string>();
  for (const line of app.split("\n")) {
    const m = line.match(/path="\/([a-z][a-z-]*)"/);
    if (!m || /<Navigate\b/.test(line)) continue;
    segs.add(m[1]);
  }
  return [...segs].sort();
}

const tourModules = import.meta.glob<{ tourSpec?: PageTourSpec }>("../**/*Tour.ts", { eager: true });
const specs = Object.entries(tourModules)
  .filter(([, m]) => m.tourSpec)
  .map(([path, m]) => ({ path, file: basename(path, ".ts"), spec: m.tourSpec as PageTourSpec }));

const tsx = [...listFiles(join(SRC, "features"), /\.tsx$/), ...listFiles(join(SRC, "design-system"), /\.tsx$/)].map((p) => ({
  rel: relative(SRC, p),
  src: readFileSync(p, "utf8"),
}));

describe("quy tắc 18 — mọi trang nghiệp vụ có hướng dẫn thao tác + hộp hướng dẫn", () => {
  const routes = routeSegments();
  const pages = routes.filter((r) => !PAGE_TOUR_EXEMPT[r]);

  test("đọc được danh sách route (khỏi test xanh vì quét hụt)", () => {
    expect(pages.length).toBeGreaterThanOrEqual(15);
  });

  test("mỗi trang có tour (tourSpec.pageId == đoạn đường dẫn)", () => {
    const missing = pages.filter((p) => !specs.some((s) => s.spec.pageId === p));
    expect(missing).toEqual([]);
  });

  test('mỗi trang có hộp "Hướng dẫn: <trang>" (PAGE_GUIDES)', () => {
    expect(pages.filter((p) => !PAGE_GUIDES[p])).toEqual([]);
  });

  test("không có tour / miễn thừa (trang đã xoá route)", () => {
    expect(specs.filter((s) => !routes.includes(s.spec.pageId)).map((s) => s.spec.pageId)).toEqual([]);
    expect(Object.keys(PAGE_TOUR_EXEMPT).filter((r) => !routes.includes(r))).toEqual([]);
    const ids = specs.map((s) => s.spec.pageId);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  test("màn có gọi usePageTour với tour của file", () => {
    const unused = specs.filter((s) => !tsx.some((f) => f.src.includes("usePageTour(") && f.src.includes(`/${s.file}"`))).map((s) => s.file);
    expect(unused).toEqual([]);
  });
});

describe.each(specs.map((s) => [s.spec.pageId, s] as const))("tour trang %s (R9 · R15)", (_id, s) => {
  const tour = s.spec.build();
  const steps = tour.steps;

  test("3 ≤ số bước ≤ 22, id không trùng, bước 1 là lời giới thiệu giữa trang", () => {
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.length).toBeLessThanOrEqual(22);
    const ids = steps.map((x) => x.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    expect(steps[0].target ?? "").toBe("");
  });

  test("văn phong: tiêu đề không chấm cuối, lời kết bằng dấu chấm, không bấm / nhấn / click", () => {
    expect(steps.filter((x) => x.title.trim().endsWith(".")).map((x) => x.id)).toEqual([]);
    expect(steps.filter((x) => !x.body.trim().endsWith(".")).map((x) => x.id)).toEqual([]);
    const banned = /(^|[^\p{L}])(bấm|nhấn|click)(?!\p{L})/iu;
    expect(steps.filter((x) => banned.test(x.title) || banned.test(x.body)).map((x) => x.id)).toEqual([]);
  });

  test('mốc data-tour của mọi bước có trên trang (chuỗi "<mốc>" trong file .tsx có data-tour)', () => {
    const targets = [...new Set(steps.map((x) => x.target).filter((t): t is string => !!t))];
    const missing = targets.filter((t) => !tsx.some((f) => f.src.includes("data-tour") && f.src.includes(`"${t}"`)));
    expect(missing).toEqual([]);
  });
});
