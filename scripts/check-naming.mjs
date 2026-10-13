#!/usr/bin/env node
// ============================================================
// Tên file: scripts/check-naming.mjs
// Tên tiếng Việt tương đương: Cổng kiểm tên tiếng Việt không dấu (Đợt 0)
// Description: Naming gate for docs/spec/quy-uoc-dat-ten.md.
//   node scripts/check-naming.mjs            report: debt per layer + per area
//   node scripts/check-naming.mjs --check    CI ratchet: fail if any count grew vs baseline
//   node scripts/check-naming.mjs --update   rewrite scripts/naming-baseline.json
//   node scripts/check-naming.mjs --staged   pre-commit: block NEW Vietnamese names in staged changes
// A line containing `naming-ok` is skipped (deliberate exception — say why on that line).
// ============================================================
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractCss,
  extractDataAttributes,
  extractDeclarations,
  extractFields,
  extractRoutes,
  extractSqlIdentifiers,
  fileStem,
  isVietnamese,
} from "./naming/lexicon.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(ROOT, "scripts/naming-baseline.json");
/** Last migration written before the rule (spec §2). Newer migrations must be English. */
const LAST_LEGACY_MIGRATION = 57;
const ROUTE_FILES = new Set(["src/App.tsx", "src/lib/nav-access.ts", "src/features/shared/AppShell.tsx"]);

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const read = (p) => fs.readFileSync(p, "utf8");
const withoutExceptions = (src) =>
  src
    .split("\n")
    .filter((l) => !l.includes("naming-ok"))
    .join("\n");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function migrationNumber(file) {
  const m = /supabase\/migrations\/(\d{4})_/.exec(file);
  return m ? Number(m[1]) : null;
}

/** Names a source file contributes, grouped by layer. */
function namesOf(file, src) {
  const s = withoutExceptions(src);
  if (/\.(ts|tsx)$/.test(file)) {
    return {
      declarations: extractDeclarations(s),
      fields: extractFields(s),
      routes: ROUTE_FILES.has(file) ? extractRoutes(s).flatMap((r) => r.split("/")) : [],
      css: extractDataAttributes(s).map((a) => `data-${a}`),
    };
  }
  if (file.endsWith(".css")) return { css: extractCss(s) };
  return {};
}

// ---------- report / ratchet ----------
function inventory() {
  const counts = { declarations: 0, fields: 0, routes: 0, css: 0, files: 0 };
  const byArea = {};
  const seenFolders = new Set();
  for (const abs of walk(path.join(ROOT, "src"))) {
    const file = rel(abs);
    const parts = file.split("/");
    const area = parts[1] === "features" ? `features/${parts[2]}` : parts.length > 2 ? parts[1] : "src";
    for (let i = 1; i < parts.length - 1; i++) {
      const dir = parts.slice(0, i + 1).join("/");
      if (!seenFolders.has(dir)) {
        seenFolders.add(dir);
        if (isVietnamese(parts[i])) counts.files++;
      }
    }
    if (isVietnamese(fileStem(parts.at(-1)))) counts.files++;
    const names = namesOf(file, read(abs));
    for (const [layer, list] of Object.entries(names)) {
      const viet = new Set(list.filter(isVietnamese)).size;
      counts[layer] += viet;
      if (layer === "declarations") byArea[area] = (byArea[area] ?? 0) + viet;
    }
  }
  return { counts, byArea };
}

/** Migrations after the rule must not create Vietnamese identifiers or file names. */
function newMigrationViolations(files) {
  const out = [];
  for (const file of files) {
    const n = migrationNumber(file);
    if (n == null || n <= LAST_LEGACY_MIGRATION || !file.endsWith(".sql")) continue;
    if (isVietnamese(fileStem(path.basename(file)))) out.push(`${file}: tên file migration tiếng Việt`);
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) continue;
    for (const id of new Set(extractSqlIdentifiers(withoutExceptions(read(abs))))) {
      if (isVietnamese(id)) out.push(`${file}: định danh SQL "${id}"`);
    }
  }
  return out;
}

function printReport({ counts, byArea }) {
  console.log("Nợ tên tiếng Việt không dấu (docs/spec/quy-uoc-dat-ten.md):");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(13)} ${v}`);
  console.log("Khai báo theo khu:");
  for (const [k, v] of Object.entries(byArea).sort((a, b) => b[1] - a[1]))
    if (v) console.log(`  ${k.padEnd(28)} ${v}`);
}

// ---------- staged (pre-commit) ----------
function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"], // file mới chưa có ở HEAD: git show báo lỗi, ta tự xử
  });
}

function headVersion(file) {
  try {
    return git(["show", `HEAD:${file}`]);
  } catch {
    return "";
  }
}

function stagedViolations() {
  const out = [];
  const lines = git(["diff", "--cached", "--name-status", "-M", "--diff-filter=ACMR"]).trim();
  if (!lines) return out;
  // File thêm mới cùng lúc với file bị xóa = thường là đổi tên mà git không nhận ra (file nhỏ,
  // sửa nhiều ⇒ dưới ngưỡng giống). Tên có sẵn trong các file bị xóa không tính là "mới".
  const deleted = git(["diff", "--cached", "--name-only", "--diff-filter=D"]).trim().split("\n").filter(Boolean);
  const namesDeleted = new Set(
    deleted.filter((d) => /\.(ts|tsx|css)$/.test(d)).flatMap((d) => Object.values(namesOf(d, headVersion(d))).flat())
  );
  const migrations = [];
  for (const line of lines.split("\n")) {
    const cols = line.split("\t");
    const status = cols[0];
    const file = cols.at(-1);
    const isNew = status.startsWith("A") || status.startsWith("R");
    if (file.startsWith("supabase/migrations/")) migrations.push(file);
    if (!file.startsWith("src/") && !file.startsWith("scripts/")) continue;

    if (isNew) {
      const parts = file.split("/");
      const bad = [...parts.slice(1, -1), fileStem(parts.at(-1))].filter(isVietnamese);
      if (bad.length) out.push(`${file}: tên file/thư mục mới tiếng Việt (${bad.join(", ")})`);
    }
    if (!/\.(ts|tsx|css)$/.test(file)) continue;

    // File đổi tên (git mv): tên cũ nằm ở HEAD dưới đường dẫn CŨ — không thì mọi tên Việt
    // sẵn có trong file bị coi là "mới" (đã dính khi Đợt 2 đổi tên 30 file lib).
    const headPath = status.startsWith("R") ? cols[1] : file;
    const before = namesOf(file, headVersion(headPath));
    const known = new Set([...Object.values(before).flat(), ...(status.startsWith("A") ? namesDeleted : [])]);
    const added = git(["diff", "--cached", "-U0", "--", file])
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .map((l) => l.slice(1))
      .join("\n");
    const after = namesOf(file, added);
    // Fields are NOT blocked: existing design-system APIs still take Vietnamese keys (`nhan:`) until Đợt 3.
    for (const layer of ["declarations", "routes", "css"]) {
      for (const name of new Set(after[layer] ?? [])) {
        if (isVietnamese(name) && !known.has(name)) out.push(`${file}: ${layer} mới "${name}"`);
      }
    }
  }
  out.push(...newMigrationViolations(migrations));
  return out;
}

// ---------- main ----------
const mode = process.argv[2] ?? "--report";

if (mode === "--staged") {
  const v = stagedViolations();
  if (v.length) {
    console.log("Tên tiếng Việt không dấu MỚI (luật: docs/spec/quy-uoc-dat-ten.md §2, từ điển §2b):");
    for (const x of v) console.log(`  ${x}`);
    console.log("Đặt tên tiếng Anh. Ngoại lệ có chủ đích: thêm comment `naming-ok: <lý do>` trên cùng dòng.");
    process.exit(1);
  }
  process.exit(0);
}

const inv = inventory();
const sqlViolations = newMigrationViolations(walk(path.join(ROOT, "supabase/migrations")).map(rel));

if (mode === "--update") {
  fs.writeFileSync(BASELINE, `${JSON.stringify(inv.counts, null, 2)}\n`);
  printReport(inv);
  console.log(`Đã ghi ${rel(BASELINE)}.`);
} else if (mode === "--check") {
  const base = JSON.parse(read(BASELINE));
  const grew = Object.entries(inv.counts).filter(([k, v]) => v > (base[k] ?? 0));
  const shrank = Object.entries(inv.counts).filter(([k, v]) => v < (base[k] ?? 0));
  printReport(inv);
  for (const x of sqlViolations) console.log(`✘ ${x}`);
  for (const [k, v] of grew) console.log(`✘ ${k}: ${base[k]} → ${v} (tăng — đặt tên tiếng Anh)`);
  for (const [k, v] of shrank)
    console.log(`▲ ${k}: ${base[k]} → ${v} (giảm — chạy \`npm run naming:update\` để siết baseline)`);
  process.exit(grew.length || sqlViolations.length ? 1 : 0);
} else {
  printReport(inv);
  for (const x of sqlViolations) console.log(`✘ ${x}`);
}
