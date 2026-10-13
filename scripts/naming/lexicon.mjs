// ============================================================
// Tên file: scripts/naming/lexicon.mjs
// Tên tiếng Việt tương đương: Bộ nhận diện tên tiếng Việt không dấu
// Description: Pure helpers that tell whether a technical identifier is
// Vietnamese-without-diacritics. Used by scripts/check-naming.mjs
// (pre-commit block + CI ratchet). Rule: docs/spec/quy-uoc-dat-ten.md §2.
// ============================================================

/**
 * Syllables that are clearly Vietnamese and rare as English identifier words.
 * One of these in an identifier ⇒ Vietnamese.
 */
export const STRONG_SYLLABLES = new Set(
  `
  nhap xuat ton kho ngay thang chot ghi bu cot luoi khoi khung nut nhan hien thi
  sua xoa them luu tai tim loc chon gia tien loai nguyen lieu thanh pham khach dai
  chuyen phieu hoa lenh xuong phan tong cong tru tinh soat kiem truy tem quet canh
  nguoi dung vai tro quyen dang muc danh noi dia ngoai giai doan trang thai nguon
  dich vi tri tieu chi tiet xe cu moi cuoi truoc sau hom nay tuan buoc nhom cha
  cay rong hep thap dinh trai phai tren duoi giua chan mau toi dam nhat
  hoan tac xac thong huong dan khoi tao thiet lap cai hop sai chua roi
  vua giam tang uoc luong mot hai bon muoi nghin trieu gom tach gan
  thoat vao quay chay tat lam duyet khong duoc dat cuon ghim xem rau khop vien
  `
    .split(/\s+/)
    .filter(Boolean)
);

/**
 * Syllables that are also English words / abbreviations. They count as Vietnamese
 * only when TWO of them appear together (`moTa`, `banHang`) or next to a strong
 * syllable. Very common English code words (`to`, `map`, `top`, `tab`, `lot`, `day`,
 * `can`) are left out on purpose: a false block on English code is worse than
 * missing a few Vietnamese names (the count is a lower bound).
 */
export const AMBIGUOUS_SYLLABLES = new Set(
  `
  an do go the con tin hop me bo sang lay ten ma le mat ban
  dong tam chu co da di ra ve len lo so nam hang cao gap ly mai qua bay
  ho tu mo bot dau lai bang bien doi loi goi ky ta de nhom bao ca du cat lap
  `
    .split(/\s+/)
    .filter(Boolean)
);
for (const s of AMBIGUOUS_SYLLABLES) STRONG_SYLLABLES.delete(s);

/** Vietnamese abbreviations the spec says to translate (`nl` → material, `hddt` → einvoice…). */
for (const s of ["nl", "tp", "btp", "hddt", "sx", "bc", "ncc"]) STRONG_SYLLABLES.add(s);

/** Business acronyms allowed as identifier words (spec §2). */
export const ALLOWED_ACRONYMS = new Set(["nxt", "wip", "qc", "qr", "sscc", "bsf", "bsf1"]);

/** Split camelCase / PascalCase / snake_case / kebab-case / dotted into lowercase words. */
export function splitIdentifier(ident) {
  return String(ident)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 1 && !/^\d+$/.test(t));
}

/** true when the identifier reads as Vietnamese without diacritics. */
export function isVietnamese(ident) {
  const words = splitIdentifier(ident).filter((w) => !ALLOWED_ACRONYMS.has(w));
  let strong = 0;
  let ambiguous = 0;
  for (const w of words) {
    if (STRONG_SYLLABLES.has(w)) strong++;
    else if (AMBIGUOUS_SYLLABLES.has(w)) ambiguous++;
  }
  return strong >= 1 || ambiguous >= 2;
}

// ---------- Extractors (regex, line based — good enough for a ratchet) ----------

const DECL_PATTERNS = [
  /\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g,
  /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/g,
  /\b(?:export\s+)?(?:declare\s+)?(?:type|interface|enum|class)\s+([A-Za-z_$][\w$]*)/g,
];

/** Names declared in TS/TSX source (functions, variables, types, classes). */
export function extractDeclarations(source) {
  const out = [];
  for (const re of DECL_PATTERNS) {
    for (const m of source.matchAll(re)) out.push(m[1]);
  }
  return out;
}

/** Property names at the start of an indented line (`  name?: …`): type fields + object keys. */
export function extractFields(source) {
  return [...source.matchAll(/^\s{2,}([a-z][A-Za-z0-9]*)\??\s*:/gm)].map((m) => m[1]);
}

/** Route paths declared in the router / nav (`path: "/x"`, `<Route path="/x">`). */
export function extractRoutes(source) {
  return [...source.matchAll(/\bpath\s*[:=]\s*\{?\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
}

/** CSS utilities, custom variants and `data-*` attribute names. */
export function extractCss(source) {
  return [
    ...[...source.matchAll(/@utility\s+([a-z0-9-]+)/g)].map((m) => m[1]),
    ...[...source.matchAll(/@custom-variant\s+([a-z0-9-]+)/g)].map((m) => m[1]),
  ];
}

export function extractDataAttributes(source) {
  return [...source.matchAll(/\bdata-([a-z][a-z0-9-]+)/g)].map((m) => m[1]);
}

/** Identifiers a SQL migration creates: tables, columns, functions, triggers, policies, indexes. */
export function extractSqlIdentifiers(sql) {
  const res = [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)/gi,
    /add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)/gi,
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z_][a-z0-9_]*)/gi,
    /create\s+(?:or\s+replace\s+)?trigger\s+"?([a-z_][a-z0-9_]*)/gi,
    /create\s+policy\s+"?([a-z_][a-z0-9_]*)/gi,
    /create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)/gi,
    /rename\s+(?:column\s+[a-z_0-9]+\s+)?to\s+"?([a-z_][a-z0-9_]*)/gi,
    /^\s+"?([a-z_][a-z0-9_]*)"?\s+(?:text|uuid|numeric|integer|int|bigint|boolean|date|timestamptz|timestamp|jsonb|real|double)\b/gim,
  ];
  const out = [];
  for (const re of res) for (const m of sql.matchAll(re)) out.push(m[1]);
  return out;
}

/** File / folder name without extension, test suffix and migration number. */
export function fileStem(name) {
  return name
    .replace(/\.(test|e2e\.test|spec)(?=\.[a-z]+$)/, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/^\d{4}_/, "");
}
