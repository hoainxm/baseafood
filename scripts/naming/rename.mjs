#!/usr/bin/env node
// ============================================================
// Tên file: scripts/naming/rename.mjs
// Tên tiếng Việt tương đương: Codemod đổi tên định danh tiếng Việt (Đợt 1+)
// Description: Rename Vietnamese identifiers with the TypeScript language
// service (same engine as the editor's "Rename Symbol") — never sed.
//   node scripts/naming/rename.mjs collect <out.json> [pathPrefix…]
//        list NON-exported declarations (variables, array-destructured names,
//        functions, parameters, local types) whose name is Vietnamese.
//   node scripts/naming/rename.mjs collect --exported <out.json> [pathPrefix…]
//        same for EXPORTED declarations (Đợt 2) — renamed in every importing file.
//   node scripts/naming/rename.mjs collect --props <out.json> [pathPrefix…]
//        PROPERTY names declared in interfaces / type literals (component props,
//        column definitions…) — Đợt 3. Never use on types that are persisted.
//   node scripts/naming/rename.mjs apply [--exported|--props] <mapping.json> [pathPrefix…]
//        mapping = { "oldName": "newName", "path/file.ts::oldName": "override" }.
//        Skips (and reports) a rename when the new name would collide with any
//        other identifier visible in the declaration's scope, or breaks the
//        identifier's case style. Object shorthand keeps its key
//        (`{ nhan }` → `{ nhan: label }`).
// Spec: docs/spec/quy-uoc-dat-ten.md §5 (Đợt 1).
// ============================================================
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { isVietnamese } from "./lexicon.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

function sourceFiles(dir = path.join(ROOT, "src"), out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

function createService() {
  const cfg = ts.getParsedCommandLineOfConfigFile(path.join(ROOT, "tsconfig.app.json"), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    },
  });
  const files = sourceFiles(); // tests included: they hold locals too
  const texts = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));
  const versions = new Map(files.map((f) => [f, 0]));
  const host = {
    getScriptFileNames: () => files,
    getScriptVersion: (f) => String(versions.get(f) ?? 0),
    getScriptSnapshot: (f) => {
      const t = texts.get(f) ?? (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : undefined);
      return t === undefined ? undefined : ts.ScriptSnapshot.fromString(t);
    },
    getCurrentDirectory: () => ROOT,
    getCompilationSettings: () => ({ ...cfg.options, noEmit: true }),
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: (f) => texts.get(f) ?? ts.sys.readFile(f),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  return {
    files,
    service,
    text: (f) => texts.get(f),
    update(f, t) {
      texts.set(f, t);
      versions.set(f, (versions.get(f) ?? 0) + 1);
    },
  };
}

const SCOPE_KINDS = new Set([
  ts.SyntaxKind.SourceFile,
  ts.SyntaxKind.Block,
  ts.SyntaxKind.ModuleBlock,
  ts.SyntaxKind.CaseBlock,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
]);

/** Smallest node whose subtree holds every use of the declared name. */
function scopeOf(decl) {
  if (ts.isParameter(decl)) return decl.parent;
  let n = ts.isFunctionDeclaration(decl) || ts.isTypeAliasDeclaration(decl) || ts.isInterfaceDeclaration(decl)
    ? decl.parent
    : decl;
  while (n && !SCOPE_KINDS.has(n.kind)) n = n.parent;
  return n ?? decl.getSourceFile();
}

function isExported(decl, exportedSymbols, checker) {
  const stmt = ts.isVariableDeclaration(decl) ? decl.parent?.parent : decl;
  if (stmt && ts.canHaveModifiers(stmt) && ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
    return true;
  const sym = decl.name && checker.getSymbolAtLocation(decl.name);
  return !!sym && exportedSymbols.has(sym);
}

/** Identifier positions that are property NAMES, not variable references. */
function isPropertyName(id) {
  const p = id.parent;
  if (!p) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return true;
  if (ts.isQualifiedName(p) && p.right === id) return true;
  if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) ||
       ts.isMethodDeclaration(p) || ts.isMethodSignature(p) || ts.isEnumMember(p) ||
       ts.isGetAccessor(p) || ts.isSetAccessor(p)) && p.name === id) return true;
  if (ts.isJsxAttribute(p) && p.name === id) return true;
  if (ts.isBindingElement(p) && p.propertyName === id) return true;
  if ((ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) && p.propertyName === id) return true;
  return false;
}

/** Every Vietnamese declaration in one file: non-exported ones, or ONLY exported ones. */
function candidatesIn(sf, checker, exportedOnly = false, propsOnly = false) {
  if (propsOnly) return propertyCandidatesIn(sf, propsOnly === "all");
  const moduleSym = checker.getSymbolAtLocation(sf);
  const exported = new Set();
  if (moduleSym) {
    for (const s of checker.getExportsOfModule(moduleSym)) {
      exported.add(s);
      if (s.flags & ts.SymbolFlags.Alias) {
        try {
          exported.add(checker.getAliasedSymbol(s));
        } catch {
          /* unresolved re-export */
        }
      }
    }
  }
  const out = [];
  const visit = (n) => {
    let decl = null;
    let kind = "";
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) [decl, kind] = [n, "variable"];
    else if (ts.isBindingElement(n) && ts.isIdentifier(n.name) && ts.isArrayBindingPattern(n.parent))
      [decl, kind] = [n, "array-binding"];
    else if (ts.isBindingElement(n) && ts.isIdentifier(n.name) && ts.isObjectBindingPattern(n.parent))
      [decl, kind] = [n, n.propertyName ? "object-alias" : "object-binding"];
    else if (ts.isFunctionDeclaration(n) && n.name) [decl, kind] = [n, "function"];
    else if (ts.isParameter(n) && ts.isIdentifier(n.name) && n.name.text !== "this") [decl, kind] = [n, "parameter"];
    else if ((ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isEnumDeclaration(n) ||
              ts.isClassDeclaration(n)) && n.parent === sf && n.name)
      [decl, kind] = [n, "type"];
    if (exportedOnly && kind !== "variable" && kind !== "function" && kind !== "type") decl = null;
    if (exportedOnly && decl && ts.isVariableDeclaration(decl) && decl.parent?.parent?.parent !== sf) decl = null;
    if (decl && (acceptNames?.has(decl.name.text) || isVietnamese(decl.name.text)) &&
        isExported(decl, exported, checker) === exportedOnly) {
      const line = sf.getLineAndCharacterOfPosition(decl.name.getStart(sf)).line;
      out.push({ name: decl.name.text, kind, pos: decl.name.getStart(sf), line: line + 1,
        context: sf.text.split("\n")[line].trim().slice(0, 140), decl });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Tên "chủ" của một thuộc tính: interface / type alias / hằng / hàm gần nhất bao nó. */
function ownerOf(n) {
  for (let p = n.parent; p; p = p.parent) {
    if ((ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p) || ts.isFunctionDeclaration(p) ||
         ts.isClassDeclaration(p)) && p.name) return p.name.text;
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  }
  return "";
}

/** Property names declared in interfaces / type literals of one file. `all` = cả tên không bị
 *  nhận là tiếng Việt (âm tiết ngắn mơ hồ) — chỉ dùng khi apply, lọc theo bảng ánh xạ. */
function propertyCandidatesIn(sf, all = false) {
  const out = [];
  const visit = (n) => {
    if ((ts.isPropertySignature(n) || ts.isMethodSignature(n)) && n.name && ts.isIdentifier(n.name) &&
        (ts.isInterfaceDeclaration(n.parent) || ts.isTypeLiteralNode(n.parent)) && (all || isVietnamese(n.name.text))) {
      const line = sf.getLineAndCharacterOfPosition(n.name.getStart(sf)).line;
      out.push({ name: n.name.text, kind: "property", owner: ownerOf(n), pos: n.name.getStart(sf), line: line + 1,
        context: sf.text.split("\n")[line].trim().slice(0, 140), decl: n });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

function caseStyle(name) {
  if (/^[A-Z][A-Z0-9_]+$/.test(name)) return "UPPER_SNAKE"; // gồm cả hằng một từ: LOAI, RONG
  if (/^[A-Z]/.test(name)) return "Pascal";
  return "camel";
}

const matchesPrefix = (file, prefixes) => !prefixes.length || prefixes.some((p) => rel(file).startsWith(p));

// ---------- main ----------
const argv = process.argv.slice(2);
/** apply: tên có trong bảng ánh xạ là ứng viên kể cả khi lexicon không nhận ra (âm tiết ngắn). */
let acceptNames = null;
const exportedMode = argv.includes("--exported");
const propsMode = argv.includes("--props");
const [cmd, arg, ...prefixes] = argv.filter((a) => a !== "--exported" && a !== "--props");
const ctx = createService();

if (cmd === "collect") {
  const program = ctx.service.getProgram();
  const checker = program.getTypeChecker();
  const rows = [];
  for (const f of ctx.files.filter((f) => matchesPrefix(f, prefixes))) {
    const sf = program.getSourceFile(f);
    for (const c of candidatesIn(sf, checker, exportedMode, propsMode)) {
      const prop = c.kind === "object-alias" && ts.isIdentifier(c.decl.propertyName) ? c.decl.propertyName.text : undefined;
      rows.push({ file: rel(f), name: c.name, kind: c.kind, line: c.line, context: c.context, ...(prop ? { prop } : {}) });
    }
  }
  fs.writeFileSync(arg, `${JSON.stringify(rows, null, 1)}\n`);
  const names = new Set(rows.map((r) => r.name));
  const byKind = rows.reduce((a, r) => ({ ...a, [r.kind]: (a[r.kind] ?? 0) + 1 }), {});
  console.log(`${rows.length} khai báo, ${names.size} tên khác nhau`, byKind);
} else if (cmd === "apply") {
  const mapping = JSON.parse(fs.readFileSync(arg, "utf8"));
  acceptNames = new Set(Object.keys(mapping).map((k) => k.split("::").pop().split(".").pop()));
  const skipped = [];
  const touched = new Set();
  let renamed = 0;
  for (const f of ctx.files.filter((f) => matchesPrefix(f, prefixes))) {
    // One file at a time; positions are recomputed after each rename (fresh program).
    for (;;) {
      const program = ctx.service.getProgram();
      const checker = program.getTypeChecker();
      const sf = program.getSourceFile(f);
      const cands = candidatesIn(sf, checker, exportedMode, propsMode ? "all" : false).filter(
        (c) => !skipped.some((s) => s.file === rel(f) && s.pos === c.pos && s.name === c.name)
      );
      // Tra theo độ cụ thể: file::Chủ.tên → file::tên → tên. Thuộc tính ngắn mơ hồ chỉ nên khai
      // theo file (khóa trơn chỉ áp cho tên bị nhận là tiếng Việt).
      const lookup = (x) =>
        (x.owner && mapping[`${rel(f)}::${x.owner}.${x.name}`]) ??
        mapping[`${rel(f)}::${x.name}`] ??
        (!propsMode || isVietnamese(x.name) ? mapping[x.name] : undefined);
      const c = cands.find((x) => lookup(x));
      if (!c) break;
      const target = lookup(c);
      const skip = (why) => skipped.push({ file: rel(f), pos: c.pos, name: c.name, target, line: c.line, why });

      if (!/^[A-Za-z_$][\w$]*$/.test(target) || ts.stringToToken(target) !== undefined) { skip("tên không hợp lệ / từ khóa"); continue; }
      if (caseStyle(target) !== caseStyle(c.name) && !(caseStyle(c.name) === "UPPER_SNAKE" && /^[A-Z0-9_]+$/.test(target))) {
        skip(`sai kiểu chữ (${caseStyle(c.name)} → ${caseStyle(target)})`);
        continue;
      }
      if (isVietnamese(target)) { skip("tên mới vẫn bị nhận là tiếng Việt"); continue; }

      const sym = checker.getSymbolAtLocation(c.decl.name);
      if (propsMode) {
        // Thuộc tính: không được trùng thành viên khác của CÙNG kiểu, kể cả thành viên kế thừa
        // (vd đổi `tieuDe` → `title` trên props đã extends thuộc tính HTML có sẵn `title`).
        const owner = c.decl.parent;
        const ownerType = ts.isInterfaceDeclaration(owner)
          ? checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(owner.name))
          : checker.getTypeAtLocation(owner);
        if (checker.getPropertiesOfType(ownerType).some((p) => p.name === target)) {
          skip(`va chạm với thuộc tính "${target}" sẵn có của kiểu`);
          continue;
        }
      }
      const scope = propsMode ? sf : scopeOf(c.decl);
      let clash = false;
      const look = (n) => {
        if (clash) return;
        if (ts.isIdentifier(n) && n.text === target && !isPropertyName(n)) {
          const s = checker.getSymbolAtLocation(n);
          if (s !== sym) clash = true;
        }
        ts.forEachChild(n, look);
      };
      if (!propsMode) look(scope);
      if (clash) { skip(`va chạm với "${target}" sẵn có trong phạm vi`); continue; }

      const locs = ctx.service.findRenameLocations(f, c.pos, false, false, { providePrefixAndSuffixTextForRename: true }) ?? [];
      const otherFiles = [...new Set(locs.map((l) => l.fileName))].filter((x) => x !== f);
      if (otherFiles.length && !exportedMode && !propsMode) { skip("được dùng ngoài file (không phải cục bộ)"); continue; }
      if (otherFiles.some((x) => !ctx.files.includes(x))) { skip("được dùng ngoài src"); continue; }
      // Tên export: file NÀO dùng nó cũng không được có sẵn định danh trùng tên mới.
      const clashFile = propsMode ? null : otherFiles.find((x) => {
        let hit = false;
        const walk = (n) => {
          if (hit) return;
          if (ts.isIdentifier(n) && n.text === target && !isPropertyName(n) && checker.getSymbolAtLocation(n) !== sym) hit = true;
          ts.forEachChild(n, walk);
        };
        walk(program.getSourceFile(x));
        return hit;
      });
      if (clashFile) { skip(`va chạm với "${target}" sẵn có ở ${rel(clashFile)}`); continue; }
      const byFile = new Map();
      for (const l of locs) byFile.set(l.fileName, [...(byFile.get(l.fileName) ?? []), l]);
      for (const [file, list] of byFile) {
        let text = ctx.text(file);
        for (const l of list.sort((a, b) => b.textSpan.start - a.textSpan.start)) {
          const repl = `${l.prefixText ?? ""}${target}${l.suffixText ?? ""}`;
          text = text.slice(0, l.textSpan.start) + repl + text.slice(l.textSpan.start + l.textSpan.length);
        }
        ctx.update(file, text);
        touched.add(file);
      }
      renamed++;
    }
    touched.add(f);
  }
  for (const f of touched) if (ctx.text(f) !== fs.readFileSync(f, "utf8")) fs.writeFileSync(f, ctx.text(f));
  const report = path.join(path.dirname(arg), `${path.basename(arg, ".json")}.skipped.json`);
  fs.writeFileSync(report, `${JSON.stringify(skipped.map(({ pos, ...r }) => r), null, 1)}\n`);
  console.log(`Đổi ${renamed} khai báo, bỏ qua ${skipped.length} (xem ${rel(report)})`);
} else if (cmd === "move") {
  // move <moves.json>: {"src/lib/old.ts": "src/lib/new.ts", …} — sửa mọi import (cả import() động)
  // bằng getEditsForFileRename rồi `git mv` để giữ lịch sử file.
  const moves = JSON.parse(fs.readFileSync(arg, "utf8"));
  for (const [from, to] of Object.entries(moves)) {
    const absFrom = path.join(ROOT, from);
    const absTo = path.join(ROOT, to);
    const edits = ctx.service.getEditsForFileRename(absFrom, absTo, {}, {}) ?? [];
    for (const e of edits) {
      let text = ctx.text(e.fileName) ?? fs.readFileSync(e.fileName, "utf8");
      for (const c of [...e.textChanges].sort((a, b) => b.span.start - a.span.start)) {
        text = text.slice(0, c.span.start) + c.newText + text.slice(c.span.start + c.span.length);
      }
      fs.writeFileSync(e.fileName, text);
      ctx.update(e.fileName, text);
    }
    execFileSync("git", ["mv", from, to], { cwd: ROOT });
    // cho các lượt move sau thấy file ở tên MỚI
    const i = ctx.files.indexOf(absFrom);
    if (i >= 0) ctx.files[i] = absTo;
    ctx.update(absTo, fs.readFileSync(absTo, "utf8"));
    console.log(`${from} → ${to} (${edits.length} file sửa import)`);
  }
} else {
  console.log("Dùng: rename.mjs collect [--exported] <out.json> [prefix…] | apply [--exported] <mapping.json> [prefix…] | move <moves.json>");
  process.exit(1);
}
