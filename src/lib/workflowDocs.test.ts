// Oracle: docs/app-map/65-workflow-docs.ba-spec.md — sơ đồ workflow theo module luôn khớp code.
// Ghi lại phần sinh tự động:  UPDATE_WORKFLOW_DOCS=1 npx vitest run src/lib/workflowDocs.test.ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSION_RESOURCES } from "@/lib/permissions";
import { WORKFLOW_MODULES, readGenerated, roleMatrixMarkdown, writeGenerated } from "./workflowDocs";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const update = process.env.UPDATE_WORKFLOW_DOCS === "1";
const withDoc = WORKFLOW_MODULES.filter((m) => m.doc);

describe("ba-spec 65 — sơ đồ workflow theo module", () => {
  it("AC-1: mọi trang có quyền thuộc ĐÚNG một module (thêm trang mới ⇒ phải gán module)", () => {
    const navIds = [...new Set(PERMISSION_RESOURCES.map((r) => r.navId).filter((x): x is string => !!x))];
    const owners = (id: string) => WORKFLOW_MODULES.filter((m) => m.pages.includes(id)).map((m) => m.id);
    expect(navIds.filter((id) => owners(id).length !== 1)).toEqual([]);
  });

  it("AC-2: module có sơ đồ ⇒ file tồn tại, có frontmatter covers / last_verified", () => {
    for (const m of withDoc) {
      const doc = read(m.doc as string);
      expect(doc, m.id).toMatch(/^covers: .+/m);
      expect(doc, m.id).toMatch(/^last_verified: \d{4}-\d{2}-\d{2}$/m);
    }
  });

  it("AC-3: bảng Ai được làm gì khớp ma trận quyền mặc định", () => {
    for (const m of withDoc) {
      const file = path.join(root, m.doc as string);
      const doc = fs.readFileSync(file, "utf8");
      const want = roleMatrixMarkdown(m.resources);
      if (update) fs.writeFileSync(file, writeGenerated(doc, "roles", want));
      expect(readGenerated(fs.readFileSync(file, "utf8"), "roles"), `${m.doc} — chạy UPDATE_WORKFLOW_DOCS=1`).toBe(want);
    }
  });

  it("AC-6: sơ đồ Mermaid không có dấu ; trong lời (Mermaid hiểu ; là ngắt lệnh ⇒ sơ đồ vẽ hỏng trên app và GitHub)", () => {
    for (const m of withDoc) {
      const blocks = read(m.doc as string).match(/```mermaid\n[\s\S]*?```/g) ?? [];
      expect(blocks.filter((b) => b.includes(";")).length, m.id).toBe(0);
    }
  });

  it("AC-7: mỗi sơ đồ khai tours: + guides: có thật; mọi file tour của app thuộc ít nhất một khu", () => {
    const listed = (doc: string, key: string) => (doc.match(new RegExp(`^${key}: (.+)$`, "m"))?.[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const allTours = new Set<string>();
    for (const m of withDoc) {
      const doc = read(m.doc as string);
      const tours = listed(doc, "tours");
      const guides = listed(doc, "guides");
      expect(tours.length, `${m.id} tours`).toBeGreaterThan(0);
      expect(guides.length, `${m.id} guides`).toBeGreaterThan(0);
      for (const f of [...tours, ...guides]) expect(fs.existsSync(path.join(root, f)), f).toBe(true);
      tours.forEach((t) => allTours.add(t));
    }
    const featureTours = fs
      .readdirSync(path.join(root, "src/features"), { recursive: true })
      .map(String)
      .filter((f) => /Tour\.ts$/.test(f))
      .map((f) => `src/features/${f.replace(/\\/g, "/")}`);
    expect(featureTours.filter((t) => !allTours.has(t))).toEqual([]);
  });

  it("AC-4: mọi nhãn trạng thái / bước trong code có mặt trong sơ đồ", () => {
    for (const m of withDoc) {
      const doc = read(m.doc as string);
      expect(m.labels.filter((l) => !doc.includes(l)), m.id).toEqual([]);
    }
  });
});
