#!/usr/bin/env node
// ============================================================
// Tên file: scripts/naming/rename.mjs
// Tên tiếng Việt tương đương: Codemod đổi tên định danh tiếng Việt (Đợt 1+)
// Description: Rename Vietnamese identifiers with the TypeScript language
// service (same engine as the editor's "Rename Symbol") — never sed.
//   node scripts/naming/rename.mjs collect <out.json> [pathPrefix…]
//        list NON-exported declarations (variables, array-destructured names,
//        functions, parameters, local types) whose name is Vietnamese.
//   node scripts/naming/rename.mjs apply <mapping.json> [pathPrefix…]
//        mapping = { "oldName": "newName", "path/file.ts::oldName": "override" }.
//        Skips (and reports) a rename when the new name would collide with any
//        other identifier visible in the declaration's scope, or breaks the
//        identifier's case style. Object shorthand keeps its key
//        (`{ nhan }` → `{ nhan: label }`).
// Spec: docs/spec/quy-uoc-dat-ten.md §5 (Đợt 1).
// ============================================================
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

/** Every Vietnamese, non-exported declaration in one file. */
function candidatesIn(sf, checker) {
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
    else if (ts.isFunctionDeclaration(n) && n.name) [decl, kind] = [n, "function"];
    else if (ts.isParameter(n) && ts.isIdentifier(n.name) && n.name.text !== "this") [decl, kind] = [n, "parameter"];
    else if ((ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)) && n.parent === sf)
      [decl, kind] = [n, "type"];
    if (decl && isVietnamese(decl.name.text) && !isExported(decl, exported, checker)) {
      const line = sf.getLineAndCharacterOfPosition(decl.name.getStart(sf)).line;
      out.push({ name: decl.name.text, kind, pos: decl.name.getStart(sf), line: line + 1,
        context: sf.text.split("\n")[line].trim().slice(0, 140), decl });
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
const [cmd, arg, ...prefixes] = process.argv.slice(2);
const ctx = createService();

if (cmd === "collect") {
  const program = ctx.service.getProgram();
  const checker = program.getTypeChecker();
  const rows = [];
  for (const f of ctx.files.filter((f) => matchesPrefix(f, prefixes))) {
    const sf = program.getSourceFile(f);
    for (const c of candidatesIn(sf, checker)) {
      rows.push({ file: rel(f), name: c.name, kind: c.kind, line: c.line, context: c.context });
    }
  }
  fs.writeFileSync(arg, `${JSON.stringify(rows, null, 1)}\n`);
  const names = new Set(rows.map((r) => r.name));
  const byKind = rows.reduce((a, r) => ({ ...a, [r.kind]: (a[r.kind] ?? 0) + 1 }), {});
  console.log(`${rows.length} khai báo, ${names.size} tên khác nhau`, byKind);
} else if (cmd === "apply") {
  const mapping = JSON.parse(fs.readFileSync(arg, "utf8"));
  const skipped = [];
  let renamed = 0;
  for (const f of ctx.files.filter((f) => matchesPrefix(f, prefixes))) {
    // One file at a time; positions are recomputed after each rename (fresh program).
    for (;;) {
      const program = ctx.service.getProgram();
      const checker = program.getTypeChecker();
      const sf = program.getSourceFile(f);
      const cands = candidatesIn(sf, checker).filter(
        (c) => !skipped.some((s) => s.file === rel(f) && s.pos === c.pos && s.name === c.name)
      );
      const c = cands.find((x) => mapping[`${rel(f)}::${x.name}`] ?? mapping[x.name]);
      if (!c) break;
      const target = mapping[`${rel(f)}::${c.name}`] ?? mapping[c.name];
      const skip = (why) => skipped.push({ file: rel(f), pos: c.pos, name: c.name, target, line: c.line, why });

      if (!/^[A-Za-z_$][\w$]*$/.test(target) || ts.stringToToken(target) !== undefined) { skip("tên không hợp lệ / từ khóa"); continue; }
      if (caseStyle(target) !== caseStyle(c.name) && !(caseStyle(c.name) === "UPPER_SNAKE" && /^[A-Z0-9_]+$/.test(target))) {
        skip(`sai kiểu chữ (${caseStyle(c.name)} → ${caseStyle(target)})`);
        continue;
      }
      if (isVietnamese(target)) { skip("tên mới vẫn bị nhận là tiếng Việt"); continue; }

      const scope = scopeOf(c.decl);
      const sym = checker.getSymbolAtLocation(c.decl.name);
      let clash = false;
      const look = (n) => {
        if (clash) return;
        if (ts.isIdentifier(n) && n.text === target && !isPropertyName(n)) {
          const s = checker.getSymbolAtLocation(n);
          if (s !== sym) clash = true;
        }
        ts.forEachChild(n, look);
      };
      look(scope);
      if (clash) { skip(`va chạm với "${target}" sẵn có trong phạm vi`); continue; }

      const locs = ctx.service.findRenameLocations(f, c.pos, false, false, { providePrefixAndSuffixTextForRename: true }) ?? [];
      if (locs.some((l) => l.fileName !== f)) { skip("được dùng ngoài file (không phải cục bộ)"); continue; }
      let text = ctx.text(f);
      for (const l of [...locs].sort((a, b) => b.textSpan.start - a.textSpan.start)) {
        const repl = `${l.prefixText ?? ""}${target}${l.suffixText ?? ""}`;
        text = text.slice(0, l.textSpan.start) + repl + text.slice(l.textSpan.start + l.textSpan.length);
      }
      ctx.update(f, text);
      renamed++;
    }
    if (ctx.text(f) !== fs.readFileSync(f, "utf8")) fs.writeFileSync(f, ctx.text(f));
  }
  const report = path.join(path.dirname(arg), `${path.basename(arg, ".json")}.skipped.json`);
  fs.writeFileSync(report, `${JSON.stringify(skipped.map(({ pos, ...r }) => r), null, 1)}\n`);
  console.log(`Đổi ${renamed} khai báo, bỏ qua ${skipped.length} (xem ${rel(report)})`);
} else {
  console.log("Dùng: rename.mjs collect <out.json> [prefix…] | apply <mapping.json> [prefix…]");
  process.exit(1);
}
